/**
 * Контроллер авторизации
 * 
 * Обрабатывает HTTP запросы для авторизации:
 * - POST /auth/login - вход в систему
 * - POST /auth/refresh - обновление токенов
 * - POST /auth/logout - выход из системы
 * 
 * @module modules/auth/auth.controller
 */

import { Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { ValidatedRequest } from '../../middleware/zodValidate';
import { LoginInput, RefreshInput } from './auth.schemas';
import { verifyPassword } from './password.service';
import {
  generateTokens,
  verifyRefreshToken,
  revokeRefreshToken,
} from './token.service';
import { prisma } from '../../config';
import logger from '../../config/logger';

/**
 * Обработчик входа в систему
 * 
 * POST /auth/login
 * 
 * Логика:
 * 1. Находит пользователя по email
 * 2. Проверяет isActive
 * 3. Проверяет пароль через passwordService.verifyPassword
 * 4. Генерирует access и refresh токены
 * 5. Возвращает токены и данные пользователя
 * 
 * Безопасность:
 * - При любой ошибке возвращает общее сообщение "Invalid credentials" (401)
 * - Не раскрывает, существует ли пользователь, активен ли он, верен ли пароль
 * - Не логирует пароли или токены
 * - Не возвращает чувствительные поля (passwordHash, isActive и т.п.)
 * 
 * @param req - Express Request с валидированным body (LoginInput)
 * @param res - Express Response
 * @param next - Express NextFunction
 */
export async function loginHandler(
  req: ValidatedRequest<LoginInput>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { email, password } = req.body;

    // Поиск пользователя по email
    const user = await prisma.user.findUnique({
      where: { email },
    });

    // ВАЖНО: Общее сообщение об ошибке для всех случаев
    // Не раскрываем, существует ли пользователь, активен ли он, верен ли пароль
    if (!user) {
      logger.warn('Login attempt failed: user not found', { email });
      res.status(401).json({ message: 'Invalid credentials' });
      return;
    }

    // Проверка активности пользователя
    if (!user.isActive) {
      logger.warn('Login attempt failed: user is inactive', { userId: user.id, email });
      res.status(401).json({ message: 'Invalid credentials' });
      return;
    }

    // Проверка пароля
    const isPasswordValid = await verifyPassword(password, user.passwordHash);
    if (!isPasswordValid) {
      logger.warn('Login attempt failed: invalid password', { userId: user.id, email });
      res.status(401).json({ message: 'Invalid credentials' });
      return;
    }

    // Генерация токенов
    const { accessToken, refreshToken } = await generateTokens(user, prisma);

    // Логирование успешного входа (без паролей и токенов)
    logger.info('User logged in successfully', {
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    // Возврат токенов и данных пользователя (без чувствительных полей)
    res.status(200).json({
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        name: user.name,
      },
    });
  } catch (error) {
    // Обработка неожиданных ошибок
    logger.error('Unexpected error during login', {
      error: error instanceof Error ? error.message : 'Unknown error',
      email: req.body.email,
    });

    // Возвращаем общее сообщение об ошибке
    res.status(401).json({ message: 'Invalid credentials' });
  }
}

/**
 * Обработчик обновления токенов
 * 
 * POST /auth/refresh
 * 
 * Логика:
 * 1. Верифицирует refresh токен через tokenService.verifyRefreshToken
 * 2. Проверяет isActive пользователя
 * 3. Проверяет passwordVersion (выполняется в verifyRefreshToken)
 *    - Если passwordVersion изменился (пароль был изменен), токен инвалидируется
 *    - Все старые refresh токены перестают работать при смене пароля
 * 4. Генерирует новые access и refresh токены с актуальным passwordVersion
 * 5. Возвращает новые токены
 * 
 * Безопасность:
 * - При невалидном токене возвращает 401 с единым сообщением "Invalid refresh token"
 * - Не логирует токены
 * - Не раскрывает деталей, почему токен невалиден (истек, неверный passwordVersion, неактивен и т.д.)
 * - Проверка passwordVersion гарантирует инвалидацию всех токенов при смене пароля
 * 
 * @param req - Express Request с валидированным body (RefreshInput)
 * @param res - Express Response
 * @param next - Express NextFunction
 */
export async function refreshHandler(
  req: ValidatedRequest<RefreshInput>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { refreshToken } = req.body;

    // Верификация refresh токена
    const verificationResult = await verifyRefreshToken(prisma, refreshToken);

    if (!verificationResult) {
      logger.warn('Refresh token verification failed');
      res.status(401).json({ message: 'Invalid refresh token' });
      return;
    }

    const { user } = verificationResult;

    // Проверка активности пользователя
    // verifyRefreshToken уже проверил isActive, но для дополнительной безопасности
    // проверяем еще раз
    if (!user.isActive) {
      logger.warn('Refresh attempt failed: user is inactive', { userId: user.id });
      res.status(401).json({ message: 'Invalid refresh token' });
      return;
    }

    // ВАЖНО: passwordVersion проверяется в verifyRefreshToken
    // Если passwordVersion изменился (пароль был изменен), verifyRefreshToken вернет null
    // и все старые refresh токены перестанут работать.
    // Это гарантирует, что при смене пароля все старые токены инвалидируются.

    // Генерация новых токенов
    const { accessToken, refreshToken: newRefreshToken } = await generateTokens(user, prisma);

    // Логирование успешного обновления (без токенов)
    logger.info('Tokens refreshed successfully', {
      userId: user.id,
      email: user.email,
    });

    // Возврат новых токенов
    res.status(200).json({
      accessToken,
      refreshToken: newRefreshToken,
    });
  } catch (error) {
    // Обработка неожиданных ошибок
    logger.error('Unexpected error during token refresh', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    // Возвращаем общее сообщение об ошибке
    res.status(401).json({ message: 'Invalid refresh token' });
  }
}

/**
 * Обработчик выхода из системы
 * 
 * POST /auth/logout
 * 
 * Логика:
 * 1. Отзывает refresh токен через tokenService.revokeRefreshToken
 *    - revokeRefreshToken идемпотентна (безопасно вызывать даже если токен не существует)
 *    - Использует deleteMany, который не выбрасывает ошибку если токен не найден
 * 2. Возвращает 204 No Content
 * 
 * Безопасность:
 * - Не раскрывает, существовал ли токен
 * - Всегда возвращает успешный ответ (204) при любых ошибках
 * - Детали ошибок логируются, но не возвращаются клиенту
 * - Не логирует токены
 * 
 * @param req - Express Request с валидированным body (RefreshInput)
 * @param res - Express Response
 * @param next - Express NextFunction
 */
export async function logoutHandler(
  req: ValidatedRequest<RefreshInput>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { refreshToken } = req.body;

    // Отзыв refresh токена
    // revokeRefreshToken идемпотентна - безопасно вызывать даже если токен не существует
    await revokeRefreshToken(prisma, refreshToken);

    // Логирование выхода (без токена)
    logger.info('User logged out successfully');

    // Возврат 204 No Content (успешный ответ без тела)
    res.status(204).send();
  } catch (error) {
    // Обработка неожиданных ошибок
    // Даже при ошибке возвращаем успешный ответ, чтобы не раскрывать детали
    logger.error('Unexpected error during logout', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    // Всегда возвращаем успешный ответ
    res.status(204).send();
  }
}

/**
 * Типичные ошибки безопасности при реализации контроллеров авторизации:
 * 
 * 1. ❌ Разные сообщения об ошибке для разных случаев (email не найден, пароль неверен, пользователь неактивен)
 *    ✅ Всегда возвращать общее сообщение "Invalid credentials" (401)
 * 
 * 2. ❌ Логирование паролей или токенов
 *    ✅ Никогда не логировать пароли, токены или другие чувствительные данные
 * 
 * 3. ❌ Возврат passwordHash, isActive и других чувствительных полей в ответе
 *    ✅ Возвращать только необходимые данные (id, email, role, name)
 * 
 * 4. ❌ Раскрытие деталей при ошибке logout (токен не существует, токен истек)
 *    ✅ Всегда возвращать успешный ответ (204) при logout
 * 
 * 5. ❌ Отсутствие проверки isActive при логине и refresh
 *    ✅ Всегда проверять isActive перед генерацией токенов
 * 
 * 6. ❌ Отсутствие проверки passwordVersion при refresh
 *    ✅ Проверять passwordVersion в verifyRefreshToken для инвалидации токенов при смене пароля
 *    ✅ passwordVersion включен в payload refresh токена и проверяется при верификации
 * 
 * 7. ❌ Разные HTTP статусы для разных ошибок авторизации
 *    ✅ Использовать 401 для всех ошибок авторизации
 * 
 * 8. ❌ Логирование успешных операций с чувствительными данными
 *    ✅ Логировать только факт операции, без деталей (userId, email, но не пароли/токены)
 * 
 * 9. ❌ Отсутствие обработки неожиданных ошибок
 *    ✅ Всегда обрабатывать ошибки и возвращать безопасные ответы
 * 
 * 10. ❌ Возврат stack trace в production
 *     ✅ Возвращать только сообщения об ошибках, без деталей реализации
 */

