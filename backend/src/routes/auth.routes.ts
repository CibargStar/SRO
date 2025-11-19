/**
 * Маршруты авторизации
 * 
 * Определяет API endpoints для авторизации:
 * - POST /auth/login - вход в систему
 * - POST /auth/refresh - обновление токенов
 * - POST /auth/logout - выход из системы
 * 
 * @module routes/auth.routes
 */

import { Router } from 'express';
import { authRateLimiter, validateBody } from '../middleware';
import { loginSchema, refreshSchema } from '../modules/auth/auth.schemas';
import { loginHandler, refreshHandler, logoutHandler } from '../modules/auth/auth.controller';

const router = Router();

/**
 * POST /auth/login
 * 
 * Вход в систему.
 * 
 * Middleware:
 * - authRateLimiter: строгий rate limiting (5 попыток / 15 минут)
 * - validateBody(loginSchema): валидация входных данных
 * 
 * @route POST /auth/login
 */
router.post('/login', authRateLimiter, validateBody(loginSchema), loginHandler);

/**
 * POST /auth/refresh
 * 
 * Обновление access и refresh токенов.
 * 
 * Middleware:
 * - validateBody(refreshSchema): валидация входных данных
 * 
 * @route POST /auth/refresh
 */
router.post('/refresh', validateBody(refreshSchema), refreshHandler);

/**
 * POST /auth/logout
 * 
 * Выход из системы (отзыв refresh токена).
 * 
 * Middleware:
 * - validateBody(refreshSchema): валидация входных данных
 * 
 * @route POST /auth/logout
 */
router.post('/logout', validateBody(refreshSchema), logoutHandler);

export default router;

