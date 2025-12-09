/**
 * Middleware для безопасности
 * 
 * Настраивает:
 * - Helmet.js для защиты от распространенных уязвимостей
 * - CORS для безопасного взаимодействия с frontend
 * - Rate limiting для защиты от brute force и DDoS атак
 * 
 * @module middleware/security
 */

import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { env } from '../config/env';

/**
 * Helmet middleware - устанавливает безопасные HTTP заголовки
 * 
 * Настройки:
 * - contentSecurityPolicy: защита от XSS атак
 * - crossOriginEmbedderPolicy: защита от изоляции ресурсов
 * - crossOriginOpenerPolicy: защита от изоляции окон
 * - crossOriginResourcePolicy: защита от изоляции ресурсов
 * - dnsPrefetchControl: отключение DNS prefetch
 * - frameguard: защита от clickjacking (X-Frame-Options)
 * - hidePoweredBy: скрытие информации о сервере
 * - hsts: HTTP Strict Transport Security
 * - ieNoOpen: защита от открытия в IE
 * - noSniff: защита от MIME type sniffing
 * - originAgentCluster: изоляция агентов
 * - permittedCrossDomainPolicies: политика cross-domain
 * - referrerPolicy: контроль referrer
 * - xssFilter: XSS фильтр (устаревший, но оставлен для совместимости)
 * 
 * Безопасность:
 * - Все заголовки безопасности включены по умолчанию
 * - Настроены для production и development окружений
 */
export const securityMiddleware = helmet({
  // Content Security Policy - защита от XSS
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"], // Для MUI и других CSS-in-JS библиотек
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'", env.FRONTEND_URL],
      fontSrc: ["'self'", 'data:'],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  // Cross-Origin Embedder Policy
  crossOriginEmbedderPolicy: false, // Отключен для совместимости с некоторыми библиотеками
  // Cross-Origin Opener Policy
  crossOriginOpenerPolicy: { policy: 'same-origin' },
  // Cross-Origin Resource Policy
  crossOriginResourcePolicy: { policy: 'same-origin' },
  // DNS Prefetch Control
  dnsPrefetchControl: true,
  // Frame Guard (X-Frame-Options)
  frameguard: { action: 'deny' },
  // Hide Powered-By
  hidePoweredBy: true,
  // HTTP Strict Transport Security
  hsts: {
    maxAge: 31536000, // 1 год
    includeSubDomains: true,
    preload: true,
  },
  // IE No Open
  ieNoOpen: true,
  // No Sniff (X-Content-Type-Options)
  noSniff: true,
  // Origin Agent Cluster
  originAgentCluster: true,
  // Permitted Cross-Domain Policies
  permittedCrossDomainPolicies: false,
  // Referrer Policy
  referrerPolicy: { policy: 'no-referrer' },
  // XSS Filter (устаревший, но оставлен для совместимости)
  xssFilter: true,
});

/**
 * CORS middleware - настройка Cross-Origin Resource Sharing
 * 
 * Настройки:
 * - origin: разрешенный origin (из env.FRONTEND_URL)
 * - credentials: разрешены cookies и авторизационные заголовки
 * - methods: разрешенные HTTP методы
 * - allowedHeaders: разрешенные заголовки
 * 
 * Безопасность:
 * - Разрешен только конкретный origin (не *)
 * - credentials разрешены только для конкретного origin
 * - Preflight запросы обрабатываются корректно
 */
export const corsMiddleware = cors({
  origin: env.FRONTEND_URL,
  credentials: true, // Разрешаем cookies и авторизационные заголовки
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['RateLimit-*', 'X-Filename', 'Content-Disposition'], // Экспортируем заголовки rate limiting и имя файла
  maxAge: 86400, // 24 часа для preflight запросов
});

/**
 * Глобальный rate limiter - ограничивает количество запросов с одного IP
 * 
 * Настройки:
 * - windowMs: 15 минут (900000 мс)
 * - max: 100 запросов за окно времени
 * - standardHeaders: возвращает заголовки RateLimit-* (RFC 7231)
 * - legacyHeaders: отключает устаревшие заголовки X-RateLimit-*
 * 
 * Применяется ко всем маршрутам, кроме тех, где используется более строгий лимитер.
 */
export const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true, // Возвращает RateLimit-* заголовки
  legacyHeaders: false, // Отключает X-RateLimit-* заголовки
  skipSuccessfulRequests: false, // Считаем все запросы, включая успешные
  skipFailedRequests: false, // Считаем все запросы, включая неудачные
});

/**
 * Строгий rate limiter для /auth/login - защита от brute force атак
 * 
 * Настройки:
 * - windowMs: 15 минут (900000 мс)
 * - max: 5 попыток за окно времени
 * - message: сообщение об ошибке
 * 
 * Безопасность:
 * - Очень строгий лимит для защиты от brute force
 * - Применяется только к маршруту /auth/login
 * - Блокирует IP после превышения лимита
 * 
 * @example
 * ```typescript
 * router.post('/auth/login', authRateLimiter, loginHandler);
 * ```
 */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 login attempts per windowMs
  message: {
    error: 'Too many login attempts from this IP, please try again later.',
    retryAfter: '15 minutes',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Не считаем успешные попытки входа
  skipFailedRequests: false, // Считаем неудачные попытки
});

/**
 * Rate limiter для /auth/refresh - защита от brute force на refresh токены
 * 
 * Настройки:
 * - windowMs: 1 минута (60000 мс)
 * - max: 10 запросов за окно времени
 * - message: сообщение об ошибке
 * 
 * Безопасность:
 * - Строгий лимит для защиты от brute force атак на refresh токены
 * - Применяется только к маршруту /auth/refresh
 * - Блокирует IP после превышения лимита
 * - Более строгий, чем глобальный лимит, но менее строгий, чем для login
 * 
 * @example
 * ```typescript
 * router.post('/auth/refresh', refreshRateLimiter, refreshHandler);
 * ```
 */
export const refreshRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // limit each IP to 10 refresh attempts per minute
  message: {
    error: 'Too many refresh attempts from this IP, please try again later.',
    retryAfter: '1 minute',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false, // Считаем все запросы (и успешные, и неудачные)
  skipFailedRequests: false, // Считаем неудачные попытки
});

/**
 * Лимитер для чувствительных действий с кампаниями (создание/старт/управление)
 * Более строгий, чем глобальный, чтобы избежать flood операций.
 */
export const campaignActionRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 минута
  max: 30, // максимум 30 действий в минуту с одного IP
  message: {
    error: 'Too many campaign actions, please slow down.',
    retryAfter: '1 minute',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  skipFailedRequests: false,
});

/**
 * Типичные ошибки безопасности при настройке middleware:
 * 
 * 1. ❌ CORS с origin: '*' и credentials: true
 *    ✅ Использовать конкретный origin и credentials только для него
 * 
 * 2. ❌ Отключенный Helmet
 *    ✅ Всегда использовать Helmet с разумными настройками
 * 
 * 3. ❌ Отсутствие rate limiting для /auth/login
 *    ✅ Использовать отдельный, более строгий rate limiter
 * 
 * 4. ❌ Слишком мягкий rate limit для login
 *    ✅ Использовать строгий лимит (5 попыток за 15 минут)
 * 
 * 5. ❌ CORS с origin: '*' в production
 *    ✅ Всегда использовать конкретный origin
 * 
 * 6. ❌ Отсутствие проверки credentials в CORS
 *    ✅ Разрешать credentials только для конкретного origin
 * 
 * 7. ❌ Отключенный HSTS
 *    ✅ Всегда включать HSTS для production
 * 
 * 8. ❌ Слишком мягкий CSP
 *    ✅ Использовать строгий Content Security Policy
 * 
 * 9. ❌ Отсутствие rate limiting вообще
 *    ✅ Всегда использовать rate limiting
 * 
 * 10. ❌ Одинаковый rate limit для всех маршрутов
 *     ✅ Использовать разные лимиты для разных маршрутов
 * 
 * 11. ❌ Отсутствие skipSuccessfulRequests для auth rate limiter
 *     ✅ Не считать успешные попытки входа
 * 
 * 12. ❌ Отсутствие обработки preflight запросов
 *     ✅ Настроить maxAge для OPTIONS запросов
 * 
 * 13. ❌ Отсутствие rate limiting для /auth/refresh
 *     ✅ Использовать отдельный rate limiter для refresh endpoint (10 запросов/минуту)
 */

