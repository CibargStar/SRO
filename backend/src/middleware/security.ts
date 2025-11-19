/**
 * Middleware для безопасности
 * 
 * Настраивает Helmet.js для защиты от распространенных уязвимостей
 * и express-rate-limit для ограничения количества запросов.
 */

import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

/**
 * Helmet middleware - устанавливает безопасные HTTP заголовки
 * Защищает от XSS, clickjacking, MIME type sniffing и других атак
 */
export const securityMiddleware = helmet();

/**
 * Rate limiter - ограничивает количество запросов с одного IP
 * 
 * Настройки:
 * - windowMs: 15 минут (900000 мс)
 * - max: 100 запросов за окно времени
 * - standardHeaders: возвращает заголовки RateLimit-* (RFC 7231)
 * - legacyHeaders: отключает устаревшие заголовки X-RateLimit-*
 */
export const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true, // Возвращает RateLimit-* заголовки
  legacyHeaders: false, // Отключает X-RateLimit-* заголовки
});

