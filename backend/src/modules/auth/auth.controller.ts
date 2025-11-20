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
import { ValidatedRequest } from '../../middleware/zodValidate';
import { AuthenticatedRequest } from '../../middleware/auth';
import { LoginInput, RefreshInput } from './auth.schemas';
import { verifyPassword } from './password.service';
import {
  generateTokens,
  verifyRefreshToken,
  revokeRefreshToken,
  revokeAllUserTokens,
} from './token.service';
import { prisma, env } from '../../config';
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
  _next: NextFunction
): Promise<void> {
  try {
    const { email, password } = req.body;

    // Поиск пользователя по email
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
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

    // После проверки на null TypeScript знает, что user не null
    // Типы Prisma правильно выведены, но TypeScript строгий линтер не может их вывести из-за строгих правил
    // Используем user напрямую после проверки на null

    // Проверка активности пользователя
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (!user.isActive) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
      logger.warn('Login attempt failed: user is inactive', { userId: user.id, email });
      res.status(401).json({ message: 'Invalid credentials' });
      return;
    }

    // Проверка пароля
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
    const isPasswordValid: boolean = await verifyPassword(password, user.passwordHash);
    if (!isPasswordValid) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
      logger.warn('Login attempt failed: invalid password', { userId: user.id, email });
      res.status(401).json({ message: 'Invalid credentials' });
      return;
    }

    // Генерация токенов
    const { accessToken, refreshToken } = await generateTokens(prisma, user);

    // Логирование успешного входа (без паролей и токенов)
    logger.info('User logged in successfully', {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      userId: user.id,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      email: user.email,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      role: user.role,
    });

    // Вычисляем время истечения токенов (в секундах)
    const parseTimeToSeconds = (timeStr: string): number => {
      const match = timeStr.match(/^(\d+)([smhd])$/);
      if (!match) return 0;
      const [, number, unit] = match;
      const num = parseInt(number, 10);
      const multipliers: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
      return num * (multipliers[unit] || 1);
    };

    const accessExpiresIn = parseTimeToSeconds(env.JWT_ACCESS_EXPIRES_IN);
    const refreshExpiresIn = parseTimeToSeconds(env.JWT_REFRESH_EXPIRES_IN);

    // Возврат токенов и данных пользователя (без чувствительных полей)
    res.status(200).json({
      accessToken,
      refreshToken,
      expiresIn: accessExpiresIn, // Время жизни access token в секундах
      refreshExpiresIn, // Время жизни refresh token в секундах
      user: {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        id: user.id,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        email: user.email,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        role: user.role,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
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
  _next: NextFunction
): Promise<void> {
  try {
    // Проверка origin для дополнительной защиты от использования украденных токенов
    const origin = req.headers.origin || req.headers.referer;
    const frontendUrl = new URL(env.FRONTEND_URL);
    const allowedOrigin = frontendUrl.origin;

    if (origin) {
      try {
        const requestOrigin = new URL(origin).origin;
        if (requestOrigin !== allowedOrigin) {
          // Используем централизованное логирование безопасности
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          const { logInvalidOrigin } = require('../../utils/securityLogger');
          logInvalidOrigin(requestOrigin, allowedOrigin, {
            ip: req.ip,
            userAgent: req.headers['user-agent'],
          });
          res.status(401).json({ message: 'Invalid refresh token' });
          return;
        }
      } catch {
        // Если origin невалидный URL, продолжаем (может быть отсутствует в некоторых случаях)
        // Но логируем для мониторинга
        logger.debug('Invalid origin format in refresh request', { origin });
      }
    }

    const { refreshToken } = req.body;

    // Верификация refresh токена
    const verificationResult = await verifyRefreshToken(prisma, refreshToken);

    if (!verificationResult) {
      logger.warn('Refresh token verification failed');
      res.status(401).json({ message: 'Invalid refresh token' });
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const { user } = verificationResult;
    // После проверки на null TypeScript знает, что verificationResult не null
    // и user имеет правильный тип из Prisma

    // Проверка активности пользователя
    // verifyRefreshToken уже проверил isActive, но для дополнительной безопасности
    // проверяем еще раз
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (!user.isActive) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
      logger.warn('Refresh attempt failed: user is inactive', { userId: user.id });
      res.status(401).json({ message: 'Invalid refresh token' });
      return;
    }

    // ВАЖНО: passwordVersion проверяется в verifyRefreshToken
    // Если passwordVersion изменился (пароль был изменен), verifyRefreshToken вернет null
    // и все старые refresh токены перестанут работать.
    // Это гарантирует, что при смене пароля все старые токены инвалидируются.

    // РОТАЦИЯ REFRESH ТОКЕНОВ: Инвалидируем старый refresh токен перед выдачей нового
    // Это обеспечивает более быструю инвалидацию скомпрометированных токенов
    // и ограничивает время жизни refresh токена
    try {
      await revokeRefreshToken(prisma, refreshToken);
    } catch (error) {
      // Если не удалось отозвать токен (уже удален или не существует),
      // логируем предупреждение, но продолжаем (возможно, race condition)
      logger.warn('Failed to revoke old refresh token during rotation', {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        userId: user.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    // Генерация новых токенов
    const { accessToken, refreshToken: newRefreshToken } = await generateTokens(prisma, user);

    // Вычисляем время истечения токенов (в секундах)
    const parseTimeToSeconds = (timeStr: string): number => {
      const match = timeStr.match(/^(\d+)([smhd])$/);
      if (!match) return 0;
      const [, number, unit] = match;
      const num = parseInt(number, 10);
      const multipliers: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
      return num * (multipliers[unit] || 1);
    };

    const accessExpiresIn = parseTimeToSeconds(env.JWT_ACCESS_EXPIRES_IN);
    const refreshExpiresIn = parseTimeToSeconds(env.JWT_REFRESH_EXPIRES_IN);

    // Логирование успешного обновления (без токенов)
    logger.info('Tokens refreshed successfully (with rotation)', {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      userId: user.id,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      email: user.email,
    });

    // Возврат новых токенов
    res.status(200).json({
      accessToken,
      refreshToken: newRefreshToken,
      expiresIn: accessExpiresIn, // Время жизни access token в секундах
      refreshExpiresIn, // Время жизни refresh token в секундах
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
  _next: NextFunction
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
 * Обработчик отзыва всех токенов пользователя
 * 
 * POST /auth/revoke-all
 * 
 * Логика:
 * 1. Проверяет авторизацию (требуется access token)
 * 2. Отзывает все refresh токены текущего пользователя
 * 3. ROOT может отозвать токены другого пользователя, указав userId в body
 * 
 * Безопасность:
 * - Только авторизованные пользователи могут отозвать свои токены
 * - ROOT может отозвать токены любого пользователя
 * - Всегда возвращает успешный ответ (204)
 * - Логирует действие для аудита
 * 
 * @param req - Express Request (должен быть AuthenticatedRequest после authMiddleware)
 * @param res - Express Response
 * @param next - Express NextFunction
 */
export async function revokeAllHandler(
  req: AuthenticatedRequest,
  res: Response,
  _next: NextFunction
): Promise<void> {
  try {
    const authenticatedReq = req as AuthenticatedRequest;
    const currentUser = authenticatedReq.user;

    if (!currentUser) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    // ROOT может отозвать токены другого пользователя, указав userId
    // Обычные пользователи могут отозвать только свои токены
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const targetUserId = (req.body as { userId?: string })?.userId;
    
    let userIdToRevoke: string;
    
    if (targetUserId && currentUser.role === 'ROOT') {
      // ROOT отзывает токены другого пользователя
      userIdToRevoke = targetUserId;
      logger.info('ROOT revoking all tokens for another user', {
        rootUserId: currentUser.id,
        targetUserId: userIdToRevoke,
      });
    } else {
      // Пользователь отзывает свои токены
      userIdToRevoke = currentUser.id;
      logger.info('User revoking all their tokens', {
        userId: userIdToRevoke,
      });
    }

    // Отзываем все токены
    await revokeAllUserTokens(prisma, userIdToRevoke);

    // Возвращаем успешный ответ
    res.status(204).send();
  } catch (error) {
    // Обработка неожиданных ошибок
    logger.error('Unexpected error during revoke all', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    // Всегда возвращаем успешный ответ (безопасность)
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

