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
import { authRateLimiter, refreshRateLimiter, validateBody, authMiddleware, requireAuth } from '../middleware';
import { loginSchema, refreshSchema } from '../modules/auth/auth.schemas';
import { loginHandler, refreshHandler, logoutHandler, revokeAllHandler } from '../modules/auth/auth.controller';

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
 *               expiresIn: 900
 *               refreshExpiresIn: 604800
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
router.post('/login', authRateLimiter, validateBody(loginSchema), loginHandler);

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
 *       
 *       **Rate Limiting:** 10 запросов / 1 минута с одного IP
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
 *               expiresIn: 900
 *               refreshExpiresIn: 604800
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
router.post('/refresh', refreshRateLimiter, validateBody(refreshSchema), refreshHandler);

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
router.post('/logout', validateBody(refreshSchema), logoutHandler);

/**
 * @swagger
 * /api/auth/revoke-all:
 *   post:
 *     summary: Отзыв всех токенов пользователя
 *     description: |
 *       Отзывает все refresh токены текущего пользователя.
 *       ROOT может отозвать токены другого пользователя, указав userId в body.
 *       
 *       **Безопасность:** Требует авторизации (access token).
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               userId:
 *                 type: string
 *                 description: ID пользователя (только для ROOT)
 *           example:
 *             userId: "123e4567-e89b-12d3-a456-426614174000"
 *     responses:
 *       204:
 *         description: Все токены успешно отозваны
 *       401:
 *         description: Не авторизован
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               message: Unauthorized
 */
router.post('/revoke-all', authMiddleware, requireAuth, revokeAllHandler);

export default router;

