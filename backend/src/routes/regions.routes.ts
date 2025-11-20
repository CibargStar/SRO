/**
 * Маршруты управления регионами
 * 
 * Определяет API endpoints для управления регионами:
 * - POST /api/regions - создание региона (только ROOT)
 * - GET /api/regions - список всех регионов (доступно всем авторизованным)
 * - GET /api/regions/:id - получение региона по ID (доступно всем авторизованным)
 * - PATCH /api/regions/:id - обновление региона (только ROOT)
 * - DELETE /api/regions/:id - удаление региона (только ROOT)
 * 
 * Безопасность:
 * - Регионы - справочник, общий для всех пользователей
 * - Чтение доступно всем авторизованным пользователям
 * - Управление (создание/обновление/удаление) доступно только ROOT
 * 
 * @module routes/regions.routes
 */

import { Router } from 'express';
import { authMiddleware, requireAuth, requireRoot, validateBody } from '../middleware';
import { createRegionSchema, updateRegionSchema } from '../modules/clients/region.schemas';
import {
  createRegionHandler,
  listRegionsHandler,
  getRegionHandler,
  updateRegionHandler,
  deleteRegionHandler,
} from '../modules/clients/regions.controller';

const router = Router();

/**
 * @swagger
 * /api/regions:
 *   post:
 *     summary: Создание нового региона
 *     description: |
 *       Создает новый регион в справочнике.
 *       Название региона должно быть уникальным.
 *       Доступно только для ROOT пользователей.
 *     tags: [Regions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateRegionInput'
 *           example:
 *             name: Москва
 *     responses:
 *       201:
 *         description: Регион успешно создан
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Region'
 *       400:
 *         description: Ошибка валидации входных данных
 *       401:
 *         description: Не авторизован
 *       403:
 *         description: Недостаточно прав (требуется ROOT)
 *       409:
 *         description: Регион с таким названием уже существует
 */
router.post('/', authMiddleware, requireAuth, requireRoot, validateBody(createRegionSchema), createRegionHandler);

/**
 * @swagger
 * /api/regions:
 *   get:
 *     summary: Получение списка всех регионов
 *     description: |
 *       Возвращает список всех регионов в справочнике.
 *       Регионы отсортированы по названию.
 *       Доступно для всех авторизованных пользователей.
 *     tags: [Regions]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Список регионов
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Region'
 *       401:
 *         description: Не авторизован
 */
router.get('/', authMiddleware, requireAuth, listRegionsHandler);

/**
 * @swagger
 * /api/regions/{id}:
 *   get:
 *     summary: Получение региона по ID
 *     description: |
 *       Возвращает данные региона по ID.
 *       Доступно для всех авторизованных пользователей.
 *     tags: [Regions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID региона
 *     responses:
 *       200:
 *         description: Данные региона
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Region'
 *       401:
 *         description: Не авторизован
 *       404:
 *         description: Регион не найден
 */
router.get('/:id', authMiddleware, requireAuth, getRegionHandler);

/**
 * @swagger
 * /api/regions/{id}:
 *   patch:
 *     summary: Обновление региона
 *     description: |
 *       Обновляет данные региона по ID.
 *       Название региона должно быть уникальным.
 *       Доступно только для ROOT пользователей.
 *     tags: [Regions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID региона
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateRegionInput'
 *     responses:
 *       200:
 *         description: Регион успешно обновлен
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Region'
 *       400:
 *         description: Ошибка валидации входных данных
 *       401:
 *         description: Не авторизован
 *       403:
 *         description: Недостаточно прав (требуется ROOT)
 *       404:
 *         description: Регион не найден
 *       409:
 *         description: Регион с таким названием уже существует
 */
router.patch('/:id', authMiddleware, requireAuth, requireRoot, validateBody(updateRegionSchema), updateRegionHandler);

/**
 * @swagger
 * /api/regions/{id}:
 *   delete:
 *     summary: Удаление региона
 *     description: |
 *       Удаляет регион по ID.
 *       При удалении региона клиенты остаются, но их regionId становится null.
 *       Доступно только для ROOT пользователей.
 *     tags: [Regions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID региона
 *     responses:
 *       204:
 *         description: Регион успешно удален
 *       401:
 *         description: Не авторизован
 *       403:
 *         description: Недостаточно прав (требуется ROOT)
 *       404:
 *         description: Регион не найден
 */
router.delete('/:id', authMiddleware, requireAuth, requireRoot, deleteRegionHandler);

export default router;

