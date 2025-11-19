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

import { Router, RequestHandler } from 'express';
import { authRateLimiter, validateBody } from '../middleware';
import { loginSchema, refreshSchema } from '../modules/auth/auth.schemas';
import { loginHandler, refreshHandler, logoutHandler } from '../modules/auth/auth.controller';

const router = Router();

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Вход в систему
 *     description: |
 *       Аутентификация пользователя по email и паролю.
 *       При успешном входе возвращает access и refresh токены.
 *       
 *       **Rate Limiting:** 5 попыток / 15 минут с одного IP
 *       
 *       **Безопасность:** При любой ошибке возвращает общее сообщение "Invalid credentials" (401)
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginInput'
 *           examples:
 *             root:
 *               summary: Вход root пользователя
 *               value:
 *                 email: admin@example.com
 *                 password: AdminPassword123!
 *             user:
 *               summary: Вход обычного пользователя
 *               value:
 *                 email: user@example.com
 *                 password: UserPassword123!
 *     responses:
 *       200:
 *         description: Успешный вход
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LoginResponse'
 *             example:
 *               accessToken: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *               refreshToken: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *               user:
 *                 id: 123e4567-e89b-12d3-a456-426614174000
 *                 email: user@example.com
 *                 role: USER
 *                 name: John Doe
 *                 isActive: true
 *                 createdAt: 2024-01-01T00:00:00.000Z
 *                 updatedAt: 2024-01-01T00:00:00.000Z
 *       400:
 *         description: Ошибка валидации входных данных
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationError'
 *             example:
 *               errors:
 *                 - field: email
 *                   message: Invalid email format
 *       401:
 *         description: Неверные учетные данные
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               message: Invalid credentials
 *       429:
 *         description: Слишком много попыток входа (rate limit)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               message: Too many login attempts, please try again later.
 */
// eslint-disable-next-line @typescript-eslint/no-unsafe-call
router.post('/login', authRateLimiter as RequestHandler, validateBody(loginSchema) as RequestHandler, loginHandler);

/**
 * @swagger
 * /api/auth/refresh:
 *   post:
 *     summary: Обновление токенов
 *     description: |
 *       Обновляет access и refresh токены.
 *       При успешном обновлении старый refresh токен инвалидируется (ротация токенов).
 *       
 *       **Важно:** После смены пароля все refresh токены инвалидируются через passwordVersion.
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RefreshInput'
 *           example:
 *             refreshToken: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *     responses:
 *       200:
 *         description: Токены успешно обновлены
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/RefreshResponse'
 *             example:
 *               accessToken: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *               refreshToken: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *       400:
 *         description: Ошибка валидации входных данных
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationError'
 *       401:
 *         description: Невалидный или отозванный refresh токен
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               message: Invalid refresh token
 */
// eslint-disable-next-line @typescript-eslint/no-unsafe-call
router.post('/refresh', validateBody(refreshSchema) as RequestHandler, refreshHandler);

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: Выход из системы
 *     description: |
 *       Отзывает refresh токен. После выхода refresh токен больше не может быть использован.
 *       
 *       **Идемпотентность:** Можно вызывать несколько раз с одним и тем же токеном.
 *       Не раскрывает, существовал ли токен.
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RefreshInput'
 *           example:
 *             refreshToken: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *     responses:
 *       204:
 *         description: Выход выполнен успешно (токен отозван)
 *       400:
 *         description: Ошибка валидации входных данных
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationError'
 */
// eslint-disable-next-line @typescript-eslint/no-unsafe-call
router.post('/logout', validateBody(refreshSchema) as RequestHandler, logoutHandler);

export default router;

