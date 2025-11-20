/**
 * Централизованное логирование подозрительной активности
 * 
 * Сервис для логирования и мониторинга подозрительных действий:
 * - Множественные неудачные попытки входа
 * - Использование отозванных токенов
 * - Попытки доступа с неавторизованных origin
 * - Другие аномалии безопасности
 * 
 * @module utils/securityLogger
 */

import logger from '../config/logger';

/**
 * Типы подозрительных событий
 */
export enum SecurityEventType {
  REVOKED_TOKEN_USE = 'REVOKED_TOKEN_USE', // Попытка использования отозванного токена
  INVALID_ORIGIN = 'INVALID_ORIGIN', // Запрос с неавторизованного origin
  MULTIPLE_FAILED_LOGINS = 'MULTIPLE_FAILED_LOGINS', // Множественные неудачные попытки входа
  SUSPICIOUS_ACTIVITY = 'SUSPICIOUS_ACTIVITY', // Другая подозрительная активность
}

/**
 * Уровни серьезности событий
 */
export enum SecuritySeverity {
  LOW = 'LOW', // Низкая серьезность (информация)
  MEDIUM = 'MEDIUM', // Средняя серьезность (предупреждение)
  HIGH = 'HIGH', // Высокая серьезность (критическое)
  CRITICAL = 'CRITICAL', // Критическая серьезность (требует немедленного внимания)
}

/**
 * Метаданные для события безопасности
 */
export interface SecurityEventMetadata {
  userId?: string;
  email?: string;
  ip?: string;
  userAgent?: string;
  origin?: string;
  tokenId?: string;
  [key: string]: unknown;
}

/**
 * Логирует событие безопасности
 * 
 * @param type - Тип события
 * @param severity - Уровень серьезности
 * @param message - Сообщение о событии
 * @param metadata - Дополнительные метаданные
 * 
 * @example
 * ```typescript
 * logSecurityEvent(
 *   SecurityEventType.REVOKED_TOKEN_USE,
 *   SecuritySeverity.HIGH,
 *   'Attempt to use revoked refresh token',
 *   { userId: '123', ip: '192.168.1.1' }
 * );
 * ```
 */
export function logSecurityEvent(
  type: SecurityEventType,
  severity: SecuritySeverity,
  message: string,
  metadata: SecurityEventMetadata = {}
): void {
  const logData = {
    type,
    severity,
    message,
    timestamp: new Date().toISOString(),
    ...metadata,
  };

  // Логируем в зависимости от уровня серьезности
  switch (severity) {
    case SecuritySeverity.CRITICAL:
    case SecuritySeverity.HIGH:
      logger.error(`[SECURITY] ${message}`, logData);
      break;
    case SecuritySeverity.MEDIUM:
      logger.warn(`[SECURITY] ${message}`, logData);
      break;
    case SecuritySeverity.LOW:
      logger.info(`[SECURITY] ${message}`, logData);
      break;
    default:
      logger.warn(`[SECURITY] ${message}`, logData);
  }
}

/**
 * Логирует попытку использования отозванного токена
 * 
 * @param userId - ID пользователя
 * @param tokenId - ID токена
 * @param metadata - Дополнительные метаданные
 */
export function logRevokedTokenUse(
  userId: string,
  tokenId: string,
  metadata: SecurityEventMetadata = {}
): void {
  logSecurityEvent(
    SecurityEventType.REVOKED_TOKEN_USE,
    SecuritySeverity.HIGH,
    'Attempt to use revoked refresh token (possible token theft)',
    {
      userId,
      tokenId,
      ...metadata,
    }
  );
}

/**
 * Логирует запрос с неавторизованного origin
 * 
 * @param origin - Origin запроса
 * @param allowedOrigin - Разрешенный origin
 * @param metadata - Дополнительные метаданные
 */
export function logInvalidOrigin(
  origin: string,
  allowedOrigin: string,
  metadata: SecurityEventMetadata = {}
): void {
  logSecurityEvent(
    SecurityEventType.INVALID_ORIGIN,
    SecuritySeverity.MEDIUM,
    'Request from unauthorized origin',
    {
      origin,
      allowedOrigin,
      ...metadata,
    }
  );
}

/**
 * Логирует множественные неудачные попытки входа
 * 
 * @param email - Email пользователя
 * @param attemptCount - Количество попыток
 * @param metadata - Дополнительные метаданные
 */
export function logMultipleFailedLogins(
  email: string,
  attemptCount: number,
  metadata: SecurityEventMetadata = {}
): void {
  const severity = attemptCount >= 5 ? SecuritySeverity.HIGH : SecuritySeverity.MEDIUM;
  
  logSecurityEvent(
    SecurityEventType.MULTIPLE_FAILED_LOGINS,
    severity,
    `Multiple failed login attempts detected (${attemptCount} attempts)`,
    {
      email,
      attemptCount,
      ...metadata,
    }
  );
}

/**
 * Логирует общую подозрительную активность
 * 
 * @param message - Сообщение о событии
 * @param severity - Уровень серьезности
 * @param metadata - Дополнительные метаданные
 */
export function logSuspiciousActivity(
  message: string,
  severity: SecuritySeverity = SecuritySeverity.MEDIUM,
  metadata: SecurityEventMetadata = {}
): void {
  logSecurityEvent(
    SecurityEventType.SUSPICIOUS_ACTIVITY,
    severity,
    message,
    metadata
  );
}

