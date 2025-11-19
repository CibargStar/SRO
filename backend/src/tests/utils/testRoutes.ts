/**
 * Тестовые роуты без rate limiting
 * 
 * Создает роуты для тестов без rate limiter, чтобы избежать блокировок.
 * 
 * @module tests/utils/testRoutes
 */

import { Router } from 'express';
import { validateBody } from '../../middleware';
import { loginSchema, refreshSchema } from '../../modules/auth/auth.schemas';
import { loginHandler, refreshHandler, logoutHandler } from '../../modules/auth/auth.controller';
import { authMiddleware, requireAuth, requireRoot } from '../../middleware';
import { createUserSchema, updateUserSchema } from '../../modules/users/user.schemas';
import {
  createUserHandler,
  listUsersHandler,
  updateUserHandler,
  getMeHandler,
} from '../../modules/users/users.controller';

/**
 * Создает роуты авторизации для тестов (без rate limiter)
 */
export function createTestAuthRoutes(): Router {
  const router = Router();

  // POST /auth/login - без authRateLimiter для тестов
  router.post('/login', validateBody(loginSchema), loginHandler);
  router.post('/refresh', validateBody(refreshSchema), refreshHandler);
  router.post('/logout', validateBody(refreshSchema), logoutHandler);

  return router;
}

/**
 * Создает роуты управления пользователями для тестов
 */
export function createTestUsersRoutes(): Router {
  const router = Router();

  router.get('/me', authMiddleware, requireAuth, getMeHandler);
  router.post('/', authMiddleware, requireAuth, requireRoot, validateBody(createUserSchema), createUserHandler);
  router.get('/', authMiddleware, requireAuth, requireRoot, listUsersHandler);
  router.patch('/:id', authMiddleware, requireAuth, requireRoot, validateBody(updateUserSchema), updateUserHandler);

  return router;
}

