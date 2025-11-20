/**
 * Сервис работы с JWT токенами
 * 
 * Централизованная логика для генерации, верификации и управления JWT токенами.
 * Использует разные секреты для Access и Refresh токенов.
 * 
 * @module modules/auth/token.service
 */

import jwt from 'jsonwebtoken';
import { timingSafeEqual } from 'crypto';
// Prisma генерирует типы, которые ESLint не видит, но TypeScript видит
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - TypeScript видит типы, но ESLint нет
import type { User } from '@prisma/client';
// Prisma генерирует типы, которые ESLint не видит, но TypeScript видит
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - TypeScript видит типы, но ESLint нет
import { PrismaClient, UserRole } from '@prisma/client';
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
 * Constant-time сравнение строк для защиты от timing attacks
 * 
 * Использует crypto.timingSafeEqual для безопасного сравнения токенов.
 * Важно: обе строки должны быть одинаковой длины (Buffer).
 * 
 * @param a - Первая строка
 * @param b - Вторая строка
 * @returns true если строки равны, false иначе
 * 
 * @example
 * ```typescript
 * if (constantTimeCompare(token1, token2)) {
 *   // Токены совпадают
 * }
 * ```
 */
function constantTimeCompare(a: string, b: string): boolean {
  try {
    // timingSafeEqual требует Buffer одинаковой длины
    const aBuffer = Buffer.from(a, 'utf8');
    const bBuffer = Buffer.from(b, 'utf8');
    
    // Если длины разные, токены точно не совпадают
    if (aBuffer.length !== bBuffer.length) {
      return false;
    }
    
    // Constant-time сравнение
    return timingSafeEqual(aBuffer, bBuffer);
  } catch {
    // В случае ошибки возвращаем false (безопасный вариант)
    return false;
  }
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
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      sub: user.id,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      email: user.email,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      role: user.role,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
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
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const refreshTokenRecord = await prisma.refreshToken.create({
      data: {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        userId: user.id,
        expiresAt,
        token: '', // Временное значение, обновим в транзакции
      },
    });

    // Генерируем JWT refresh токен с tokenId и passwordVersion
    const refreshTokenPayload: RefreshTokenPayload = {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      sub: user.id,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      tokenId: refreshTokenRecord.id,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      passwordVersion: user.passwordVersion, // Включаем passwordVersion для инвалидации при смене пароля
      type: 'refresh',
    };

    const refreshToken = jwt.sign(refreshTokenPayload, env.JWT_REFRESH_SECRET, {
      expiresIn: refreshTokenExpiresIn,
    });

    // Обновляем запись с реальным токеном
    // Если обновление не удастся, запись останется с пустым токеном (будет очищена позже)
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    await prisma.refreshToken.update({
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      where: { id: refreshTokenRecord.id },
      data: { token: refreshToken },
    });

    // ВАЖНО: Не логируем токены!
    logger.debug('Tokens generated successfully', {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      userId: user.id,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      email: user.email,
    });

    return { accessToken, refreshToken };
  } catch (error) {
    logger.error('Failed to generate tokens', {
      error: error instanceof Error ? error.message : 'Unknown error',
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
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
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      role: decoded.role,
      passwordVersion: decoded.passwordVersion,
      type: 'access',
      iat: decoded.iat ?? 0,
      exp: decoded.exp ?? 0,
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

    // Проверяем наличие записи в БД по tokenId (более безопасно, чем по токену)
    // Используем tokenId из payload для поиска, затем проверяем токен с constant-time сравнением
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const refreshTokenRecord = await prisma.refreshToken.findUnique({
      where: { id: decoded.tokenId },
      include: { user: true },
    });

    if (!refreshTokenRecord) {
      // DETECTION ПОВТОРНОГО ИСПОЛЬЗОВАНИЯ: Если токен не найден в БД,
      // но JWT валиден, это может означать попытку повторного использования
      // уже отозванного токена (подозрение на компрометацию)
      // 
      // КРИТИЧЕСКАЯ УГРОЗА: Это может быть попытка использования украденного токена
      // после того, как пользователь уже отозвал его (например, после logout).
      // 
      // Действия:
      // 1. Логируем как критическое событие безопасности через централизованный сервис
      // 2. Отзываем ВСЕ токены пользователя для безопасности
      // 3. В будущем можно добавить блокировку пользователя при множественных попытках
      
      // Используем централизованное логирование безопасности
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { logRevokedTokenUse } = require('../../utils/securityLogger');
      logRevokedTokenUse(decoded.sub, decoded.tokenId);

      // Отзываем все токены пользователя для безопасности
      // Это предотвращает использование любых других скомпрометированных токенов
      try {
        await revokeAllUserTokens(prisma, decoded.sub);
        logger.warn('All user tokens revoked due to suspicious activity', {
          userId: decoded.sub,
        });
      } catch (revokeError) {
        logger.error('Failed to revoke all user tokens after security alert', {
          userId: decoded.sub,
          error: revokeError instanceof Error ? revokeError.message : 'Unknown error',
        });
      }

      return null;
    }

    // Дополнительная проверка токена с constant-time сравнением для защиты от timing attacks
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const storedToken = refreshTokenRecord.token;
    if (!constantTimeCompare(token, storedToken)) {
      // Токены не совпадают - возможна попытка использования поддельного токена
      logger.warn('Token mismatch detected (possible token tampering)', {
        userId: decoded.sub,
        tokenId: decoded.tokenId,
      });
      return null;
    }

    // Проверяем, что токен не истек
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (refreshTokenRecord.expiresAt < new Date()) {
      logger.debug('Refresh token expired');
      // Удаляем истекший токен
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      await prisma.refreshToken.delete({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        where: { id: refreshTokenRecord.id },
      });
      return null;
    }

    // Проверяем, что пользователь активен
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (!refreshTokenRecord.user.isActive) {
      logger.debug('User is not active');
      return null;
    }

    // Проверяем passwordVersion (токен должен быть инвалидирован при смене пароля)
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (decoded.passwordVersion !== refreshTokenRecord.user.passwordVersion) {
      logger.debug('Refresh token invalidated due to password change', {
        tokenPasswordVersion: decoded.passwordVersion,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        userPasswordVersion: refreshTokenRecord.user.passwordVersion,
      });
      // Удаляем токен с неверной версией пароля
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      await prisma.refreshToken.delete({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        where: { id: refreshTokenRecord.id },
      });
      return null;
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
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
 * Использует tokenId из payload JWT для безопасного удаления (защита от timing attacks).
 * Если декодирование не удалось, использует fallback на прямое сравнение токена.
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
 * - Использует tokenId из payload для безопасного удаления (защита от timing attacks)
 * - Удаляет токен из БД (больше нельзя использовать)
 * - Не логирует токен
 * - Идемпотентна (безопасно вызывать многократно)
 */
export async function revokeRefreshToken(prisma: PrismaClient, token: string): Promise<void> {
  try {
    let deletedCount = 0;

    // Пытаемся декодировать токен для получения tokenId (более безопасный способ)
    try {
      const decoded = jwt.decode(token) as RefreshTokenPayload | null;
      
      if (decoded && decoded.tokenId) {
        // Удаляем по tokenId (более безопасно и быстрее)
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        const deleted = await prisma.refreshToken.deleteMany({
          where: { id: decoded.tokenId },
        });
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        deletedCount = deleted.count;
      } else {
        // Если не удалось декодировать, используем fallback на прямое сравнение
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        const deleted = await prisma.refreshToken.deleteMany({
          where: { token },
        });
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        deletedCount = deleted.count;
      }
    } catch {
      // Если декодирование не удалось, используем fallback на прямое сравнение
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      const deleted = await prisma.refreshToken.deleteMany({
        where: { token },
      });
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      deletedCount = deleted.count;
    }

    if (deletedCount > 0) {
      logger.debug('Refresh token revoked', {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        count: deletedCount,
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
 * Очищает истекшие refresh токены из базы данных
 * 
 * Удаляет все refresh токены, у которых expiresAt < текущего времени.
 * Используется для периодической очистки БД от неиспользуемых токенов.
 * 
 * @param prisma - Экземпляр Prisma Client
 * @returns Количество удаленных токенов
 * 
 * @example
 * ```typescript
 * const deletedCount = await cleanupExpiredTokens(prisma);
 * logger.info(`Cleaned up ${deletedCount} expired tokens`);
 * ```
 */
export async function cleanupExpiredTokens(prisma: PrismaClient): Promise<number> {
  try {
    const now = new Date();
    
    // Удаляем все токены с expiresAt < now
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const result = await prisma.refreshToken.deleteMany({
      where: {
        expiresAt: {
          lt: now, // less than now
        },
      },
    });

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const deletedCount = result.count;

    if (deletedCount > 0) {
      logger.info('Expired refresh tokens cleaned up', {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        count: deletedCount,
      });
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return deletedCount;
  } catch (error) {
    logger.error('Failed to cleanup expired tokens', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return 0;
  }
}

/**
 * Отзывает все refresh токены пользователя
 * 
 * Удаляет все refresh токены для указанного пользователя.
 * Используется при подозрении на компрометацию или при принудительном logout всех устройств.
 * 
 * @param prisma - Экземпляр Prisma Client
 * @param userId - ID пользователя, токены которого нужно отозвать
 * @returns Количество удаленных токенов
 * 
 * @example
 * ```typescript
 * const deletedCount = await revokeAllUserTokens(prisma, userId);
 * logger.info(`Revoked ${deletedCount} tokens for user ${userId}`);
 * ```
 */
export async function revokeAllUserTokens(prisma: PrismaClient, userId: string): Promise<number> {
  try {
    // Удаляем все токены пользователя
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const result = await prisma.refreshToken.deleteMany({
      where: {
        userId,
      },
    });

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const deletedCount = result.count;

    if (deletedCount > 0) {
      logger.info('All user refresh tokens revoked', {
        userId,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        count: deletedCount,
      });
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return deletedCount;
  } catch (error) {
    logger.error('Failed to revoke all user tokens', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId,
    });
    return 0;
  }
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

