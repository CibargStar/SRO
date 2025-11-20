/**
 * Middleware для Express приложения
 * 
 * Централизованный экспорт всех middleware:
 * - securityMiddleware: Helmet.js для безопасности
 * - corsMiddleware: CORS для взаимодействия с frontend
 * - rateLimiter: глобальное ограничение количества запросов
 * - authRateLimiter: строгое ограничение для /auth/login
 * - refreshRateLimiter: ограничение для /auth/refresh
 * - requestLogger: логирование HTTP запросов
 * - errorHandler: глобальный обработчик ошибок
 * - notFoundHandler: обработчик 404 ошибок
 * - validate: валидация запросов с express-validator
 * - validateBody: валидация тела запроса с Zod
 * - authMiddleware: проверка access токена и подтягивание пользователя
 * - requireAuth: проверка наличия авторизованного пользователя
 * - requireRoot: проверка прав доступа ROOT
 */

export { securityMiddleware, corsMiddleware, rateLimiter, authRateLimiter, refreshRateLimiter } from './security';
export { requestLogger } from './logger';
export { errorHandler, type AppError } from './errorHandler';
export { notFoundHandler } from './notFound';
export { validate } from './validation';
export { validateBody, type ValidatedRequest } from './zodValidate';
export {
  authMiddleware,
  requireAuth,
  requireRoot,
  type AuthenticatedUser,
  type AuthenticatedRequest,
} from './auth';
