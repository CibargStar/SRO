/**
 * Middleware для Express приложения
 * 
 * Централизованный экспорт всех middleware:
 * - securityMiddleware: Helmet.js для безопасности
 * - corsMiddleware: CORS для взаимодействия с frontend
 * - rateLimiter: глобальное ограничение количества запросов
 * - authRateLimiter: строгое ограничение для /auth/login
 * - requestLogger: логирование HTTP запросов
 * - errorHandler: глобальный обработчик ошибок
 * - notFoundHandler: обработчик 404 ошибок
 * - validate: валидация запросов с express-validator
 * - validateBody: валидация тела запроса с Zod
 */

export { securityMiddleware, corsMiddleware, rateLimiter, authRateLimiter } from './security';
export { requestLogger } from './logger';
export { errorHandler, type AppError } from './errorHandler';
export { notFoundHandler } from './notFound';
export { validate } from './validation';
export { validateBody, type ValidatedRequest } from './zodValidate';
