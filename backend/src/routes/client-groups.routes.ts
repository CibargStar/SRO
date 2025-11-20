/**
 * Маршруты управления группами клиентов
 * 
 * Определяет API endpoints для управления группами клиентов:
 * - POST /api/client-groups - создание группы
 * - GET /api/client-groups - список групп текущего пользователя
 * - GET /api/client-groups/:id - получение группы по ID
 * - PATCH /api/client-groups/:id - обновление группы
 * - DELETE /api/client-groups/:id - удаление группы
 * 
 * Безопасность:
 * - Все endpoints требуют авторизации (authMiddleware + requireAuth)
 * - Каждый пользователь видит и управляет только своими группами
 * 
 * @module routes/client-groups.routes
 */

import { Router } from 'express';
import { authMiddleware, requireAuth, validateBody } from '../middleware';
import { createClientGroupSchema, updateClientGroupSchema } from '../modules/clients/client-group.schemas';
import {
  createClientGroupHandler,
  listClientGroupsHandler,
  getClientGroupHandler,
  updateClientGroupHandler,
  deleteClientGroupHandler,
} from '../modules/clients/client-groups.controller';

const router = Router();

/**
 * @swagger
 * /api/client-groups:
 *   post:
 *     summary: Создание новой группы клиентов
 *     description: |
 *       Создает новую группу клиентов для текущего пользователя.
 *       Название группы должно быть уникальным для пользователя.
 *       Доступно для всех авторизованных пользователей.
 *     tags: [ClientGroups]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateClientGroupInput'
 *           example:
 *             name: VIP клиенты
 *             description: Группа для важных клиентов
 *             color: #FF5733
 *             orderIndex: 1
 *     responses:
 *       201:
 *         description: Группа успешно создана
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ClientGroup'
 *       400:
 *         description: Ошибка валидации входных данных
 *       401:
 *         description: Не авторизован
 *       409:
 *         description: Группа с таким названием уже существует
 */
router.post('/', authMiddleware, requireAuth, validateBody(createClientGroupSchema), createClientGroupHandler);

/**
 * @swagger
 * /api/client-groups:
 *   get:
 *     summary: Получение списка групп клиентов
 *     description: |
 *       Возвращает список всех групп клиентов текущего пользователя.
 *       Группы отсортированы по orderIndex (если указан) или по дате создания.
 *       Доступно для всех авторизованных пользователей.
 *     tags: [ClientGroups]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Список групп клиентов
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/ClientGroup'
 *       401:
 *         description: Не авторизован
 */
router.get('/', authMiddleware, requireAuth, listClientGroupsHandler);

/**
 * @swagger
 * /api/client-groups/{id}:
 *   get:
 *     summary: Получение группы клиентов по ID
 *     description: |
 *       Возвращает данные группы клиентов по ID.
 *       Доступно только для групп текущего пользователя.
 *     tags: [ClientGroups]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID группы клиентов
 *     responses:
 *       200:
 *         description: Данные группы клиентов
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ClientGroup'
 *       401:
 *         description: Не авторизован
 *       403:
 *         description: Доступ запрещен (группа принадлежит другому пользователю)
 *       404:
 *         description: Группа не найдена
 */
router.get('/:id', authMiddleware, requireAuth, getClientGroupHandler);

/**
 * @swagger
 * /api/client-groups/{id}:
 *   patch:
 *     summary: Обновление группы клиентов
 *     description: |
 *       Обновляет данные группы клиентов по ID.
 *       Доступно только для групп текущего пользователя.
 *       Название группы должно быть уникальным для пользователя.
 *     tags: [ClientGroups]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID группы клиентов
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateClientGroupInput'
 *     responses:
 *       200:
 *         description: Группа успешно обновлена
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ClientGroup'
 *       400:
 *         description: Ошибка валидации входных данных
 *       401:
 *         description: Не авторизован
 *       403:
 *         description: Доступ запрещен (группа принадлежит другому пользователю)
 *       404:
 *         description: Группа не найдена
 *       409:
 *         description: Группа с таким названием уже существует
 */
router.patch('/:id', authMiddleware, requireAuth, validateBody(updateClientGroupSchema), updateClientGroupHandler);

/**
 * @swagger
 * /api/client-groups/{id}:
 *   delete:
 *     summary: Удаление группы клиентов
 *     description: |
 *       Удаляет группу клиентов по ID.
 *       При удалении группы клиенты остаются, но их groupId становится null.
 *       Доступно только для групп текущего пользователя.
 *     tags: [ClientGroups]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID группы клиентов
 *     responses:
 *       204:
 *         description: Группа успешно удалена
 *       401:
 *         description: Не авторизован
 *       403:
 *         description: Доступ запрещен (группа принадлежит другому пользователю)
 *       404:
 *         description: Группа не найдена
 */
router.delete('/:id', authMiddleware, requireAuth, deleteClientGroupHandler);

export default router;

