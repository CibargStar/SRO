/**
 * Маршруты управления клиентами
 * 
 * Определяет API endpoints для управления клиентами:
 * - POST /api/clients - создание клиента
 * - GET /api/clients - список клиентов (с пагинацией, поиском, фильтрацией, сортировкой)
 * - GET /api/clients/:id - получение клиента по ID
 * - PATCH /api/clients/:id - обновление клиента
 * - DELETE /api/clients/:id - удаление клиента
 * 
 * Безопасность:
 * - Все endpoints требуют авторизации (authMiddleware + requireAuth)
 * - Каждый пользователь видит и управляет только своими клиентами
 * 
 * @module routes/clients.routes
 */

import { Router } from 'express';
import { authMiddleware, requireAuth, validateBody, validateQuery } from '../middleware';
import { createClientSchema, updateClientSchema, listClientsQuerySchema } from '../modules/clients/client.schemas';
import {
  createClientHandler,
  listClientsHandler,
  getClientHandler,
  updateClientHandler,
  deleteClientHandler,
} from '../modules/clients/clients.controller';
import {
  createClientPhoneHandler,
  listClientPhonesHandler,
  updateClientPhoneHandler,
  deleteClientPhoneHandler,
  bulkUpdatePhoneStatusesHandler,
} from '../modules/clients/client-phones.controller';
import { createClientPhoneSchema, updateClientPhoneSchema } from '../modules/clients/client-phone.schemas';

const router = Router();

/**
 * @swagger
 * /api/clients:
 *   post:
 *     summary: Создание нового клиента
 *     description: |
 *       Создает нового клиента для текущего пользователя.
 *       Доступно для всех авторизованных пользователей.
 *     tags: [Clients]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateClientInput'
 *           example:
 *             lastName: Иванов
 *             firstName: Иван
 *             middleName: Иванович
 *             regionId: 123e4567-e89b-12d3-a456-426614174000
 *             groupId: 123e4567-e89b-12d3-a456-426614174001
 *             status: NEW
 *     responses:
 *       201:
 *         description: Клиент успешно создан
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Client'
 *       400:
 *         description: Ошибка валидации входных данных
 *       401:
 *         description: Не авторизован
 *       403:
 *         description: Группа клиентов не принадлежит вам
 *       404:
 *         description: Регион или группа не найдены
 */
router.post('/', authMiddleware, requireAuth, validateBody(createClientSchema), createClientHandler);

/**
 * @swagger
 * /api/clients:
 *   get:
 *     summary: Получение списка клиентов
 *     description: |
 *       Возвращает список клиентов текущего пользователя с поддержкой:
 *       - Пагинации (page, limit)
 *       - Поиска по ФИО (search)
 *       - Фильтрации по региону, группе, статусу
 *       - Сортировки по различным полям
 *       Доступно для всех авторизованных пользователей.
 *     tags: [Clients]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Номер страницы
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *           maximum: 100
 *         description: Количество элементов на странице
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Поиск по ФИО
 *       - in: query
 *         name: regionId
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Фильтр по региону
 *       - in: query
 *         name: groupId
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Фильтр по группе
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [NEW, OLD]
 *         description: Фильтр по статусу
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [createdAt, lastName, firstName, regionId, status]
 *           default: createdAt
 *         description: Поле для сортировки
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *         description: Порядок сортировки
 *     responses:
 *       200:
 *         description: Список клиентов с метаданными пагинации
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Client'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     page:
 *                       type: integer
 *                     limit:
 *                       type: integer
 *                     total:
 *                       type: integer
 *                     totalPages:
 *                       type: integer
 *                     hasNextPage:
 *                       type: boolean
 *                     hasPrevPage:
 *                       type: boolean
 *       400:
 *         description: Ошибка валидации query параметров
 *       401:
 *         description: Не авторизован
 */
router.get('/', authMiddleware, requireAuth, validateQuery(listClientsQuerySchema), listClientsHandler as any);

/**
 * @swagger
 * /api/clients/{id}:
 *   get:
 *     summary: Получение клиента по ID
 *     description: |
 *       Возвращает данные клиента по ID.
 *       Доступно только для клиентов текущего пользователя.
 *     tags: [Clients]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID клиента
 *     responses:
 *       200:
 *         description: Данные клиента
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Client'
 *       401:
 *         description: Не авторизован
 *       403:
 *         description: Доступ запрещен (клиент принадлежит другому пользователю)
 *       404:
 *         description: Клиент не найден
 */
router.get('/:id', authMiddleware, requireAuth, getClientHandler);

/**
 * @swagger
 * /api/clients/{id}:
 *   patch:
 *     summary: Обновление клиента
 *     description: |
 *       Обновляет данные клиента по ID.
 *       Доступно только для клиентов текущего пользователя.
 *     tags: [Clients]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID клиента
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateClientInput'
 *     responses:
 *       200:
 *         description: Клиент успешно обновлен
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Client'
 *       400:
 *         description: Ошибка валидации входных данных
 *       401:
 *         description: Не авторизован
 *       403:
 *         description: Доступ запрещен (клиент принадлежит другому пользователю)
 *       404:
 *         description: Клиент, регион или группа не найдены
 */
router.patch('/:id', authMiddleware, requireAuth, validateBody(updateClientSchema), updateClientHandler);

/**
 * @swagger
 * /api/clients/{id}:
 *   delete:
 *     summary: Удаление клиента
 *     description: |
 *       Удаляет клиента по ID (каскадное удаление телефонов).
 *       Доступно только для клиентов текущего пользователя.
 *     tags: [Clients]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID клиента
 *     responses:
 *       204:
 *         description: Клиент успешно удален
 *       401:
 *         description: Не авторизован
 *       403:
 *         description: Доступ запрещен (клиент принадлежит другому пользователю)
 *       404:
 *         description: Клиент не найден
 */
router.delete('/:id', authMiddleware, requireAuth, deleteClientHandler);

/**
 * @swagger
 * /api/clients/{id}/phones:
 *   post:
 *     summary: Создание телефона для клиента
 *     description: |
 *       Создает новый телефон для клиента.
 *       Доступно только для клиентов текущего пользователя.
 *     tags: [ClientPhones]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID клиента
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateClientPhoneInput'
 *           example:
 *             phone: +7 (999) 123-45-67
 *     responses:
 *       201:
 *         description: Телефон успешно создан
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ClientPhone'
 *       400:
 *         description: Ошибка валидации входных данных
 *       401:
 *         description: Не авторизован
 *       403:
 *         description: Доступ запрещен (клиент принадлежит другому пользователю)
 *       404:
 *         description: Клиент не найден
 */
router.post('/:id/phones', authMiddleware, requireAuth, validateBody(createClientPhoneSchema), createClientPhoneHandler);

/**
 * @swagger
 * /api/clients/{id}/phones:
 *   get:
 *     summary: Получение списка телефонов клиента
 *     description: |
 *       Возвращает список всех телефонов клиента.
 *       Доступно только для клиентов текущего пользователя.
 *     tags: [ClientPhones]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID клиента
 *     responses:
 *       200:
 *         description: Список телефонов клиента
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/ClientPhone'
 *       401:
 *         description: Не авторизован
 *       403:
 *         description: Доступ запрещен (клиент принадлежит другому пользователю)
 */
router.get('/:id/phones', authMiddleware, requireAuth, listClientPhonesHandler);

/**
 * @swagger
 * /api/clients/{id}/phones/{phoneId}:
 *   patch:
 *     summary: Обновление телефона клиента
 *     description: |
 *       Обновляет телефон клиента по ID.
 *       Доступно только для клиентов текущего пользователя.
 *     tags: [ClientPhones]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID клиента
 *       - in: path
 *         name: phoneId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID телефона
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateClientPhoneInput'
 *     responses:
 *       200:
 *         description: Телефон успешно обновлен
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ClientPhone'
 *       400:
 *         description: Ошибка валидации входных данных
 *       401:
 *         description: Не авторизован
 *       403:
 *         description: Доступ запрещен
 *       404:
 *         description: Телефон или клиент не найдены
 */
router.patch('/:id/phones/:phoneId', authMiddleware, requireAuth, validateBody(updateClientPhoneSchema), updateClientPhoneHandler);

/**
 * @swagger
 * /api/clients/{id}/phones/{phoneId}:
 *   delete:
 *     summary: Удаление телефона клиента
 *     description: |
 *       Удаляет телефон клиента по ID.
 *       Доступно только для клиентов текущего пользователя.
 *     tags: [ClientPhones]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID клиента
 *       - in: path
 *         name: phoneId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID телефона
 *     responses:
 *       204:
 *         description: Телефон успешно удален
 *       401:
 *         description: Не авторизован
 *       403:
 *         description: Доступ запрещен
 *       404:
 *         description: Телефон или клиент не найдены
 */
router.delete('/:id/phones/:phoneId', authMiddleware, requireAuth, deleteClientPhoneHandler);
router.patch('/:id/phones/bulk-status', authMiddleware, requireAuth, bulkUpdatePhoneStatusesHandler);

export default router;

