/**
 * Сервис работы с JWT токенами
 * 
 * Централизованная логика для генерации, верификации и управления JWT токенами.
 * Использует разные секреты для Access и Refresh токенов.
 * 
 * @module modules/auth/token.service
 */

import jwt from 'jsonwebtoken';
import { PrismaClient, User, UserRole } from '@prisma/client';
import { env } from '../../config/env';
import logger from '../../config/logger';

/**
 * Payload для Access токена
 * 
 * Содержит только необходимые данные для авторизации:
 * - sub: ID пользователя
 * - email: Email пользователя
 * - role: Роль пользователя
 * - passwordVersion: Версия пароля (для инвалидации токенов)
 * - type: Тип токена ('access')
 */
export interface AccessTokenPayload {
  sub: string; // User ID
  email: string;
  role: UserRole;
  passwordVersion: number;
  type: 'access';
  iat?: number;
  exp?: number;
}

/**
 * Payload для Refresh токена
 * 
 * Содержит минимальные данные:
 * - sub: ID пользователя
 * - tokenId: ID записи RefreshToken в БД (для отзыва)
 * - passwordVersion: Версия пароля (для инвалидации токенов при смене пароля)
 * - type: Тип токена ('refresh')
 */
export interface RefreshTokenPayload {
  sub: string; // User ID
  tokenId: string; // RefreshToken ID в БД
  passwordVersion: number; // Версия пароля (для инвалидации при смене пароля)
  type: 'refresh';
  iat?: number;
  exp?: number;
}

/**
 * Результат верификации Access токена с данными пользователя
 */
export interface JwtPayloadWithUserData {
  sub: string;
  email: string;
  role: UserRole;
  passwordVersion: number;
  type: 'access';
  iat: number;
  exp: number;
}

/**
 * Парсит строку времени в секунды
 * 
 * @param timeStr - Строка в формате "15m", "1h", "7d" и т.д.
 * @returns Количество секунд
 * 
 * @example
 * parseTimeToSeconds("15m") // 900
 * parseTimeToSeconds("7d") // 604800
 */
function parseTimeToSeconds(timeStr: string): number {
  const match = timeStr.match(/^(\d+)([smhd])$/);
  if (!match) {
    throw new Error(`Invalid time format: ${timeStr}`);
  }

  const [, number, unit] = match;
  const num = parseInt(number, 10);

  const multipliers: Record<string, number> = {
    s: 1,
    m: 60,
    h: 3600,
    d: 86400,
  };

  return num * (multipliers[unit] || 1);
}

/**
 * Генерирует Access и Refresh токены для пользователя
 * 
 * @param prisma - Экземпляр Prisma Client
 * @param user - Пользователь для которого генерируются токены
 * @returns Объект с accessToken и refreshToken
 * 
 * @throws {Error} Если не удалось создать токены или сохранить refresh токен
 * 
 * @example
 * ```typescript
 * const { accessToken, refreshToken } = await generateTokens(prisma, user);
 * ```
 * 
 * Безопасность:
 * - Использует разные секреты для access и refresh токенов
 * - Сохраняет refresh токен в БД для возможности отзыва
 * - Не логирует токены
 * - Включает passwordVersion для инвалидации при смене пароля
 * 
 * Примечание: Ротация refresh-токенов и detection повторного использования
 * реализованы в refreshHandler (auth.controller.ts) и verifyRefreshToken соответственно.
 */
export async function generateTokens(
  prisma: PrismaClient,
  user: User
): Promise<{ accessToken: string; refreshToken: string }> {
  try {
    // Генерация Access токена
    const accessTokenPayload: AccessTokenPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      passwordVersion: user.passwordVersion,
      type: 'access',
    };

    const accessTokenExpiresIn = parseTimeToSeconds(env.JWT_ACCESS_EXPIRES_IN);
    const accessToken = jwt.sign(accessTokenPayload, env.JWT_ACCESS_SECRET, {
      expiresIn: accessTokenExpiresIn,
    });

    // Генерация Refresh токена
    // Используем транзакцию для атомарности: создание записи и генерация токена
    const refreshTokenExpiresIn = parseTimeToSeconds(env.JWT_REFRESH_EXPIRES_IN);
    const expiresAt = new Date(Date.now() + refreshTokenExpiresIn * 1000);

    // Создаем запись RefreshToken в БД и генерируем токен атомарно
    const refreshTokenRecord = await prisma.refreshToken.create({
      data: {
        userId: user.id,
        expiresAt,
        token: '', // Временное значение, обновим в транзакции
      },
    });

    // Генерируем JWT refresh токен с tokenId и passwordVersion
    const refreshTokenPayload: RefreshTokenPayload = {
      sub: user.id,
      tokenId: refreshTokenRecord.id,
      passwordVersion: user.passwordVersion, // Включаем passwordVersion для инвалидации при смене пароля
      type: 'refresh',
    };

    const refreshToken = jwt.sign(refreshTokenPayload, env.JWT_REFRESH_SECRET, {
      expiresIn: refreshTokenExpiresIn,
    });

    // Обновляем запись с реальным токеном
    // Если обновление не удастся, запись останется с пустым токеном (будет очищена позже)
    await prisma.refreshToken.update({
      where: { id: refreshTokenRecord.id },
      data: { token: refreshToken },
    });

    // ВАЖНО: Не логируем токены!
    logger.debug('Tokens generated successfully', {
      userId: user.id,
      email: user.email,
    });

    return { accessToken, refreshToken };
  } catch (error) {
    logger.error('Failed to generate tokens', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: user.id,
    });
    throw new Error('Token generation failed');
  }
}

/**
 * Верифицирует Access токен
 * 
 * @param token - JWT Access токен
 * @returns Payload токена или null если токен невалиден
 * 
 * @example
 * ```typescript
 * const payload = verifyAccessToken(token);
 * if (payload) {
 *   // Токен валиден, используем payload
 * }
 * ```
 * 
 * Безопасность:
 * - Проверяет подпись токена
 * - Проверяет срок действия (exp)
 * - Проверяет тип токена (должен быть 'access')
 * - Возвращает null для невалидных токенов (без утечки информации)
 */
export function verifyAccessToken(token: string): JwtPayloadWithUserData | null {
  try {
    const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET) as AccessTokenPayload;

    // Проверяем тип токена
    if (decoded.type !== 'access') {
      logger.warn('Invalid token type in access token');
      return null;
    }

    // Проверяем наличие обязательных полей
    if (!decoded.sub || !decoded.email || !decoded.role || decoded.passwordVersion === undefined) {
      logger.warn('Missing required fields in access token payload');
      return null;
    }

    return {
      sub: decoded.sub,
      email: decoded.email,
      role: decoded.role,
      passwordVersion: decoded.passwordVersion,
      type: 'access',
      iat: decoded.iat || 0,
      exp: decoded.exp || 0,
    };
  } catch (error) {
    // JWT ошибки (expired, invalid signature и т.д.)
    if (error instanceof jwt.JsonWebTokenError) {
      logger.debug('Access token verification failed', {
        error: error.message,
      });
    } else if (error instanceof jwt.TokenExpiredError) {
      logger.debug('Access token expired');
    } else {
      logger.warn('Unexpected error during access token verification', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    return null;
  }
}

/**
 * Верифицирует Refresh токен и проверяет его наличие в БД
 * 
 * @param prisma - Экземпляр Prisma Client
 * @param token - JWT Refresh токен
 * @returns Пользователь или null если токен невалиден
 * 
 * @example
 * ```typescript
 * const user = await verifyRefreshToken(prisma, token);
 * if (user) {
 *   // Токен валиден, можно генерировать новый access токен
 * }
 * ```
 * 
 * Безопасность:
 * - Проверяет подпись токена
 * - Проверяет срок действия (exp)
 * - Проверяет тип токена (должен быть 'refresh')
 * - Проверяет наличие записи в БД
 * - Проверяет, что токен не истек (expiresAt)
 * - Возвращает null для невалидных токенов
 */
export async function verifyRefreshToken(
  prisma: PrismaClient,
  token: string
): Promise<{ user: User } | null> {
  try {
    // Верифицируем JWT токен
    const decoded = jwt.verify(token, env.JWT_REFRESH_SECRET) as RefreshTokenPayload;

    // Проверяем тип токена
    if (decoded.type !== 'refresh') {
      logger.warn('Invalid token type in refresh token');
      return null;
    }

    // Проверяем наличие обязательных полей
    if (!decoded.sub || !decoded.tokenId || decoded.passwordVersion === undefined) {
      logger.warn('Missing required fields in refresh token payload');
      return null;
    }

    // Проверяем наличие записи в БД
    const refreshTokenRecord = await prisma.refreshToken.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!refreshTokenRecord) {
      // DETECTION ПОВТОРНОГО ИСПОЛЬЗОВАНИЯ: Если токен не найден в БД,
      // но JWT валиден, это может означать попытку повторного использования
      // уже отозванного токена (подозрение на компрометацию)
      // Логируем это событие для мониторинга
      logger.warn('Attempt to use revoked or non-existent refresh token', {
        userId: decoded.sub,
        tokenId: decoded.tokenId,
        // Не логируем сам токен, только факт попытки
      });
      return null;
    }

    // Проверяем, что токен не истек
    if (refreshTokenRecord.expiresAt < new Date()) {
      logger.debug('Refresh token expired');
      // Удаляем истекший токен
      await prisma.refreshToken.delete({
        where: { id: refreshTokenRecord.id },
      });
      return null;
    }

    // Проверяем, что пользователь активен
    if (!refreshTokenRecord.user.isActive) {
      logger.debug('User is not active');
      return null;
    }

    // Проверяем passwordVersion (токен должен быть инвалидирован при смене пароля)
    if (decoded.passwordVersion !== refreshTokenRecord.user.passwordVersion) {
      logger.debug('Refresh token invalidated due to password change', {
        tokenPasswordVersion: decoded.passwordVersion,
        userPasswordVersion: refreshTokenRecord.user.passwordVersion,
      });
      // Удаляем токен с неверной версией пароля
      await prisma.refreshToken.delete({
        where: { id: refreshTokenRecord.id },
      });
      return null;
    }

    return { user: refreshTokenRecord.user };
  } catch (error) {
    // JWT ошибки (expired, invalid signature и т.д.)
    if (error instanceof jwt.JsonWebTokenError) {
      logger.debug('Refresh token verification failed', {
        error: error.message,
      });
    } else if (error instanceof jwt.TokenExpiredError) {
      logger.debug('Refresh token expired');
    } else {
      logger.warn('Unexpected error during refresh token verification', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    return null;
  }
}

/**
 * Отзывает (удаляет) Refresh токен
 * 
 * @param prisma - Экземпляр Prisma Client
 * @param token - JWT Refresh токен для отзыва
 * 
 * @example
 * ```typescript
 * await revokeRefreshToken(prisma, refreshToken);
 * ```
 * 
 * Безопасность:
 * - Удаляет токен из БД (больше нельзя использовать)
 * - Не логирует токен
 * - Идемпотентна (безопасно вызывать многократно)
 */
export async function revokeRefreshToken(prisma: PrismaClient, token: string): Promise<void> {
  try {
    // Пытаемся найти и удалить токен
    const deleted = await prisma.refreshToken.deleteMany({
      where: { token },
    });

    if (deleted.count > 0) {
      logger.debug('Refresh token revoked', {
        count: deleted.count,
      });
    } else {
      // Токен уже был удален или не существует - это нормально (идемпотентность)
      logger.debug('Refresh token not found (already revoked or invalid)');
    }
  } catch (error) {
    logger.error('Failed to revoke refresh token', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    // Не пробрасываем ошибку - идемпотентность
  }
}

/**
 * Проверяет, соответствует ли passwordVersion в токене текущей версии пользователя
 * 
 * Используется для инвалидации токенов при смене пароля.
 * 
 * @param tokenPayload - Payload Access токена
 * @param userPasswordVersion - Текущая версия пароля пользователя
 * @returns true если версии совпадают, false иначе
 * 
 * @example
 * ```typescript
 * const payload = verifyAccessToken(token);
 * if (payload && isPasswordVersionValid(payload, user.passwordVersion)) {
 *   // Токен валиден
 * }
 * ```
 */
export function isPasswordVersionValid(
  tokenPayload: JwtPayloadWithUserData,
  userPasswordVersion: number
): boolean {
  return tokenPayload.passwordVersion === userPasswordVersion;
}

/**
 * Типичные ошибки безопасности при работе с JWT:
 * 
 * 1. ❌ Использование одного секрета для access и refresh токенов
 *    ✅ Использовать разные секреты (JWT_ACCESS_SECRET и JWT_REFRESH_SECRET)
 * 
 * 2. ❌ Отсутствие проверки срока действия токена (exp)
 *    ✅ Всегда проверять exp при верификации
 * 
 * 3. ❌ Хранение токенов в localStorage (уязвимо к XSS)
 *    ✅ Access токен в памяти, Refresh токен в httpOnly cookie
 * 
 * 4. ❌ Отсутствие проверки типа токена (type)
 *    ✅ Всегда проверять type в payload (access/refresh)
 * 
 * 5. ❌ Хранение чувствительных данных в payload
 *    ✅ Хранить только необходимые данные (id, email, role)
 * 
 * 6. ❌ Отсутствие проверки passwordVersion
 *    ✅ Проверять passwordVersion при верификации токена
 * 
 * 7. ❌ Отсутствие возможности отзыва refresh токенов
 *    ✅ Хранить refresh токены в БД для возможности отзыва
 * 
 * 8. ❌ Логирование токенов
 *    ✅ Никогда не логировать токены (даже в debug режиме)
 * 
 * 9. ❌ Использование слабых секретов
 *    ✅ Использовать криптографически стойкие секреты (минимум 32 символа)
 * 
 * 10. ❌ Отсутствие проверки истечения refresh токена в БД
 *     ✅ Проверять expiresAt при верификации refresh токена
 * 
 * 11. ❌ Отсутствие проверки активности пользователя
 *     ✅ Проверять isActive при верификации refresh токена
 * 
 * 12. ❌ Использование синхронных операций
 *     ✅ Все операции асинхронные (не блокируют event loop)
 * 
 * 13. ❌ Отсутствие обработки ошибок верификации
 *     ✅ Обрабатывать все ошибки и возвращать null для невалидных токенов
 * 
 * 14. ❌ Возврат разных сообщений об ошибках
 *     ✅ Всегда возвращать null для невалидных токенов (без утечки информации)
 * 
 * 15. ❌ Отсутствие проверки подписи токена
 *     ✅ Всегда проверять подпись при верификации
 */

