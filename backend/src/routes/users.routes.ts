/**
 * Маршруты управления пользователями
 * 
 * Определяет API endpoints для управления пользователями:
 * - POST /api/users - создание пользователя (только ROOT)
 * - GET /api/users - список пользователей (только ROOT)
 * - PATCH /api/users/:id - обновление пользователя (только ROOT)
 * - GET /api/users/me - данные текущего пользователя (любой авторизованный)
 * 
 * @module routes/users.routes
 */

import { Router } from 'express';
import { authMiddleware, requireAuth, requireRoot, validateBody } from '../middleware';
import { createUserSchema, updateUserSchema } from '../modules/users/user.schemas';
import {
  createUserHandler,
  listUsersHandler,
  updateUserHandler,
  getMeHandler,
} from '../modules/users/users.controller';

const router = Router();

/**
 * @swagger
 * /api/users/me:
 *   get:
 *     summary: Получение данных текущего пользователя
 *     description: |
 *       Возвращает данные авторизованного пользователя.
 *       Доступно для всех авторизованных пользователей (ROOT и USER).
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Данные пользователя
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *             example:
 *               id: 123e4567-e89b-12d3-a456-426614174000
 *               email: user@example.com
 *               role: USER
 *               name: John Doe
 *               isActive: true
 *               createdAt: 2024-01-01T00:00:00.000Z
 *               updatedAt: 2024-01-01T00:00:00.000Z
 *       401:
 *         description: Не авторизован
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               message: Unauthorized
 */
router.get('/me', authMiddleware, requireAuth, getMeHandler);

/**
 * @swagger
 * /api/users:
 *   post:
 *     summary: Создание нового пользователя
 *     description: |
 *       Создает нового пользователя с ролью USER.
 *       Доступно только для ROOT пользователей.
 *       
 *       **Ограничения:**
 *       - Нельзя создать ROOT через API (всегда создается с role: USER)
 *       - Email должен быть уникальным
 *       - Пароль должен соответствовать требованиям сложности (мин. 12 символов)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateUserInput'
 *           example:
 *             email: newuser@example.com
 *             password: SecurePassword123!
 *             name: New User
 *     responses:
 *       201:
 *         description: Пользователь успешно создан
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *             example:
 *               id: 123e4567-e89b-12d3-a456-426614174001
 *               email: newuser@example.com
 *               role: USER
 *               name: New User
 *               isActive: true
 *               createdAt: 2024-01-01T00:00:00.000Z
 *               updatedAt: 2024-01-01T00:00:00.000Z
 *       400:
 *         description: Ошибка валидации входных данных
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationError'
 *       401:
 *         description: Не авторизован
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Недостаточно прав (требуется ROOT)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               message: Forbidden
 *       409:
 *         description: Email уже используется
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               message: Email already in use
 */
router.post('/', authMiddleware, requireAuth, requireRoot, validateBody(createUserSchema), createUserHandler);

/**
 * @swagger
 * /api/users:
 *   get:
 *     summary: Получение списка всех пользователей
 *     description: |
 *       Возвращает список всех пользователей в системе.
 *       Доступно только для ROOT пользователей.
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Список пользователей
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UsersListResponse'
 *             example:
 *               users:
 *                 - id: 123e4567-e89b-12d3-a456-426614174000
 *                   email: admin@example.com
 *                   role: ROOT
 *                   name: Admin
 *                   isActive: true
 *                   createdAt: 2024-01-01T00:00:00.000Z
 *                   updatedAt: 2024-01-01T00:00:00.000Z
 *                 - id: 123e4567-e89b-12d3-a456-426614174001
 *                   email: user@example.com
 *                   role: USER
 *                   name: User
 *                   isActive: true
 *                   createdAt: 2024-01-01T00:00:00.000Z
 *                   updatedAt: 2024-01-01T00:00:00.000Z
 *       401:
 *         description: Не авторизован
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Недостаточно прав (требуется ROOT)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               message: Forbidden
 */
router.get('/', authMiddleware, requireAuth, requireRoot, listUsersHandler);

/**
 * @swagger
 * /api/users/{id}:
 *   patch:
 *     summary: Обновление пользователя
 *     description: |
 *       Обновляет данные пользователя по ID.
 *       Доступно только для ROOT пользователей.
 *       
 *       **Ограничения:**
 *       - Нельзя обновить ROOT пользователя через API (403)
 *       - Нельзя установить role в ROOT через API (403)
 *       - При смене пароля все токены пользователя инвалидируются (passwordVersion)
 *       - Email должен быть уникальным (если обновляется)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID пользователя
 *         example: 123e4567-e89b-12d3-a456-426614174000
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateUserInput'
 *           examples:
 *             updateEmail:
 *               summary: Обновление email
 *               value:
 *                 email: updated@example.com
 *             updatePassword:
 *               summary: Обновление пароля
 *               value:
 *                 password: NewSecurePassword123!
 *             updateName:
 *               summary: Обновление имени
 *               value:
 *                 name: Updated Name
 *             deactivate:
 *               summary: Деактивация пользователя
 *               value:
 *                 isActive: false
 *             multiple:
 *               summary: Обновление нескольких полей
 *               value:
 *                 email: updated@example.com
 *                 name: Updated Name
 *                 isActive: true
 *     responses:
 *       200:
 *         description: Пользователь успешно обновлен
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/User'
 *             example:
 *               id: 123e4567-e89b-12d3-a456-426614174000
 *               email: updated@example.com
 *               role: USER
 *               name: Updated Name
 *               isActive: true
 *               createdAt: 2024-01-01T00:00:00.000Z
 *               updatedAt: 2024-01-02T00:00:00.000Z
 *       400:
 *         description: Ошибка валидации входных данных
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationError'
 *       401:
 *         description: Не авторизован
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       403:
 *         description: Недостаточно прав или попытка обновить ROOT
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             examples:
 *               forbidden:
 *                 summary: Недостаточно прав
 *                 value:
 *                   message: Forbidden
 *               rootUpdate:
 *                 summary: Попытка обновить ROOT
 *                 value:
 *                   message: Operation not allowed for ROOT user
 *       404:
 *         description: Пользователь не найден
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               message: User not found
 *       409:
 *         description: Email уже используется
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               message: Email already in use
 */
router.patch('/:id', authMiddleware, requireAuth, requireRoot, validateBody(updateUserSchema), updateUserHandler);

export default router;

