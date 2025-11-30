/**
 * Маршруты управления профилями Chrome
 * 
 * Определяет API endpoints для управления профилями:
 * - POST /api/profiles - создание профиля
 * - GET /api/profiles - список профилей пользователя
 * - GET /api/profiles/:id - получение профиля по ID
 * - PATCH /api/profiles/:id - обновление профиля
 * - DELETE /api/profiles/:id - удаление профиля
 * - GET /api/profiles/:id/status - статус профиля
 * 
 * Безопасность:
 * - Все endpoints требуют авторизации (authMiddleware + requireAuth)
 * - Каждый пользователь видит и управляет только своими профилями
 * 
 * @module routes/profiles.routes
 */

import { Router } from 'express';
import { authMiddleware, requireAuth, requireRoot, validateBody, validateQuery } from '../middleware';
import { createProfileSchema, updateProfileSchema, listProfilesQuerySchema } from '../modules/profiles/profiles.schemas';
import {
  createProfileHandler,
  listProfilesHandler,
  getProfileHandler,
  updateProfileHandler,
  deleteProfileHandler,
  getProfileStatusHandler,
  startProfileHandler,
  stopProfileHandler,
  getProfileResourcesHandler,
  getProfileResourcesHistoryHandler,
  checkProfileHealthHandler,
  getProfileNetworkStatsHandler,
  getProfileAlertsHandler,
  getProfileUnreadAlertsCountHandler,
  markAlertAsReadHandler,
  markAllAlertsAsReadHandler,
  getProfileAnalyticsHandler,
} from '../modules/profiles/profiles.controller';
import {
  getUserLimitsHandler,
  setUserLimitsHandler,
  getAllLimitsHandler,
  getMyLimitsHandler,
} from '../modules/profiles/limits/limits.controller';
import { setProfileLimitsSchema } from '../modules/profiles/limits/limits.schemas';

const router = Router();

/**
 * @swagger
 * /api/profiles:
 *   post:
 *     summary: Создание нового профиля Chrome
 *     description: |
 *       Создает новый профиль Chrome для текущего пользователя.
 *       Профиль будет создан в изолированной директории.
 *       Доступно для всех авторизованных пользователей.
 *     tags: [Profiles]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateProfileInput'
 *           example:
 *             name: Профиль для WhatsApp
 *             description: Профиль для работы с WhatsApp рассылками
 *     responses:
 *       201:
 *         description: Профиль успешно создан
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Profile'
 *       400:
 *         description: Ошибка валидации входных данных
 *       401:
 *         description: Не авторизован
 */
router.post('/', authMiddleware, requireAuth, validateBody(createProfileSchema), createProfileHandler);

/**
 * @swagger
 * /api/profiles:
 *   get:
 *     summary: Получение списка профилей
 *     description: |
 *       Возвращает список профилей текущего пользователя с поддержкой:
 *       - Пагинации (page, limit)
 *       - Фильтрации по статусу
 *       - Сортировки по различным полям
 *       Доступно для всех авторизованных пользователей.
 *     tags: [Profiles]
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
 *         name: status
 *         schema:
 *           type: string
 *           enum: [STOPPED, RUNNING, STARTING, STOPPING, ERROR]
 *         description: Фильтр по статусу
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [createdAt, updatedAt, name, status, lastActiveAt]
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
 *         description: Список профилей с метаданными пагинации
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Profile'
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
router.get('/', authMiddleware, requireAuth, validateQuery(listProfilesQuerySchema), listProfilesHandler as any);

/**
 * @swagger
 * /api/profiles/limits/me:
 *   get:
 *     summary: Получение собственных лимитов профилей
 *     description: |
 *       Возвращает лимиты профилей для текущего пользователя.
 *       Доступно для всех авторизованных пользователей.
 *     tags: [Profiles]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Лимиты профилей пользователя
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 userId:
 *                   type: string
 *                   format: uuid
 *                 maxProfiles:
 *                   type: integer
 *                 maxCpuPerProfile:
 *                   type: number
 *                   nullable: true
 *                 maxMemoryPerProfile:
 *                   type: integer
 *                   nullable: true
 *                 maxNetworkPerProfile:
 *                   type: integer
 *                   nullable: true
 *       401:
 *         description: Не авторизован
 */
router.get('/limits/me', authMiddleware, requireAuth, getMyLimitsHandler);

/**
 * @swagger
 * /api/profiles/limits:
 *   get:
 *     summary: Получение всех лимитов профилей (ROOT only)
 *     description: |
 *       Возвращает список всех лимитов профилей для всех пользователей.
 *       Доступно только для ROOT пользователей.
 *     tags: [Profiles]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Список всех лимитов
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                     format: uuid
 *                   userId:
 *                     type: string
 *                     format: uuid
 *                   maxProfiles:
 *                     type: integer
 *                   maxCpuPerProfile:
 *                     type: number
 *                     nullable: true
 *                   maxMemoryPerProfile:
 *                     type: integer
 *                     nullable: true
 *                   maxNetworkPerProfile:
 *                     type: integer
 *                     nullable: true
 *                   createdAt:
 *                     type: string
 *                     format: date-time
 *                   updatedAt:
 *                     type: string
 *                     format: date-time
 *                   updatedBy:
 *                     type: string
 *                     nullable: true
 *       401:
 *         description: Не авторизован
 *       403:
 *         description: Доступ запрещен (только ROOT)
 */
router.get('/limits', authMiddleware, requireAuth, requireRoot, getAllLimitsHandler);

/**
 * @swagger
 * /api/profiles/limits/{userId}:
 *   get:
 *     summary: Получение лимитов пользователя (ROOT only)
 *     description: |
 *       Возвращает лимиты профилей для указанного пользователя.
 *       Доступно только для ROOT пользователей.
 *     tags: [Profiles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID пользователя
 *     responses:
 *       200:
 *         description: Лимиты профилей пользователя
 *       401:
 *         description: Не авторизован
 *       403:
 *         description: Доступ запрещен (только ROOT)
 */
router.get('/limits/:userId', authMiddleware, requireAuth, requireRoot, getUserLimitsHandler);

/**
 * @swagger
 * /api/profiles/limits/{userId}:
 *   put:
 *     summary: Установка лимитов профилей для пользователя (ROOT only)
 *     description: |
 *       Устанавливает лимиты профилей для указанного пользователя.
 *       Доступно только для ROOT пользователей.
 *     tags: [Profiles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID пользователя
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SetProfileLimitsInput'
 *           example:
 *             maxProfiles: 20
 *             maxCpuPerProfile: 0.5
 *             maxMemoryPerProfile: 512
 *             maxNetworkPerProfile: 1024
 *     responses:
 *       200:
 *         description: Лимиты успешно установлены
 *       400:
 *         description: Ошибка валидации или превышение лимита
 *       401:
 *         description: Не авторизован
 *       403:
 *         description: Доступ запрещен (только ROOT)
 */
router.put(
  '/limits/:userId',
  authMiddleware,
  requireAuth,
  requireRoot,
  validateBody(setProfileLimitsSchema),
  setUserLimitsHandler
);

/**
 * @swagger
 * /api/profiles/{id}:
 *   get:
 *     summary: Получение профиля по ID
 *     description: |
 *       Возвращает данные профиля по ID.
 *       Доступно только для профилей текущего пользователя.
 *     tags: [Profiles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID профиля
 *     responses:
 *       200:
 *         description: Данные профиля
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Profile'
 *       401:
 *         description: Не авторизован
 *       403:
 *         description: Доступ запрещен (профиль принадлежит другому пользователю)
 *       404:
 *         description: Профиль не найден
 */
router.get('/:id', authMiddleware, requireAuth, getProfileHandler);

/**
 * @swagger
 * /api/profiles/{id}:
 *   patch:
 *     summary: Обновление профиля
 *     description: |
 *       Обновляет данные профиля по ID.
 *       Доступно только для профилей текущего пользователя.
 *     tags: [Profiles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID профиля
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateProfileInput'
 *     responses:
 *       200:
 *         description: Профиль успешно обновлен
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Profile'
 *       400:
 *         description: Ошибка валидации входных данных
 *       401:
 *         description: Не авторизован
 *       403:
 *         description: Доступ запрещен (профиль принадлежит другому пользователю)
 *       404:
 *         description: Профиль не найден
 */
router.patch('/:id', authMiddleware, requireAuth, validateBody(updateProfileSchema), updateProfileHandler);

/**
 * @swagger
 * /api/profiles/{id}:
 *   delete:
 *     summary: Удаление профиля
 *     description: |
 *       Удаляет профиль по ID.
 *       Доступно только для профилей текущего пользователя.
 *     tags: [Profiles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID профиля
 *     responses:
 *       204:
 *         description: Профиль успешно удален
 *       401:
 *         description: Не авторизован
 *       403:
 *         description: Доступ запрещен (профиль принадлежит другому пользователю)
 *       404:
 *         description: Профиль не найден
 */
router.delete('/:id', authMiddleware, requireAuth, deleteProfileHandler);

/**
 * @swagger
 * /api/profiles/{id}/status:
 *   get:
 *     summary: Получение статуса профиля
 *     description: |
 *       Возвращает статус профиля по ID.
 *       Доступно только для профилей текущего пользователя.
 *     tags: [Profiles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID профиля
 *     responses:
 *       200:
 *         description: Статус профиля
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                   format: uuid
 *                 status:
 *                   type: string
 *                   enum: [STOPPED, RUNNING, STARTING, STOPPING, ERROR]
 *                 lastActiveAt:
 *                   type: string
 *                   format: date-time
 *                   nullable: true
 *       401:
 *         description: Не авторизован
 *       403:
 *         description: Доступ запрещен (профиль принадлежит другому пользователю)
 *       404:
 *         description: Профиль не найден
 */
router.get('/:id/status', authMiddleware, requireAuth, getProfileStatusHandler);

/**
 * @swagger
 * /api/profiles/{id}/start:
 *   post:
 *     summary: Запуск Chrome профиля
 *     description: |
 *       Запускает Chrome браузер для указанного профиля.
 *       Доступно только для профилей текущего пользователя.
 *     tags: [Profiles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID профиля
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               headless:
 *                 type: boolean
 *                 default: true
 *                 description: Запуск в headless режиме (без UI)
 *               args:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Дополнительные аргументы запуска Chrome
 *     responses:
 *       200:
 *         description: Профиль успешно запущен
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 profileId:
 *                   type: string
 *                   format: uuid
 *                 status:
 *                   type: string
 *                   enum: [RUNNING]
 *                 processInfo:
 *                   type: object
 *                   properties:
 *                     pid:
 *                       type: number
 *                     startedAt:
 *                       type: string
 *                       format: date-time
 *       401:
 *         description: Не авторизован
 *       403:
 *         description: Доступ запрещен (профиль принадлежит другому пользователю)
 *       404:
 *         description: Профиль не найден
 */
router.post('/:id/start', authMiddleware, requireAuth, startProfileHandler);

/**
 * @swagger
 * /api/profiles/{id}/stop:
 *   post:
 *     summary: Остановка Chrome профиля
 *     description: |
 *       Останавливает Chrome браузер для указанного профиля.
 *       Доступно только для профилей текущего пользователя.
 *     tags: [Profiles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID профиля
 *       - in: query
 *         name: force
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Принудительная остановка (kill)
 *     responses:
 *       200:
 *         description: Профиль успешно остановлен
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Profile stopped successfully
 *       401:
 *         description: Не авторизован
 *       403:
 *         description: Доступ запрещен (профиль принадлежит другому пользователю)
 *       404:
 *         description: Профиль не найден
 */
router.post('/:id/stop', authMiddleware, requireAuth, stopProfileHandler);

/**
 * @swagger
 * /api/profiles/{id}/resources:
 *   get:
 *     summary: Получение статистики ресурсов профиля
 *     description: |
 *       Возвращает статистику использования ресурсов (CPU, память) для запущенного Chrome процесса профиля.
 *       Доступно только для профилей текущего пользователя.
 *     tags: [Profiles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID профиля
 *     responses:
 *       200:
 *         description: Статистика ресурсов профиля
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 profileId:
 *                   type: string
 *                   format: uuid
 *                 pid:
 *                   type: number
 *                 cpuUsage:
 *                   type: number
 *                   description: Использование CPU в процентах (0-100)
 *                 memoryUsage:
 *                   type: number
 *                   description: Использование памяти в MB
 *                 memoryUsagePercent:
 *                   type: number
 *                   description: Использование памяти в процентах (0-100)
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       401:
 *         description: Не авторизован
 *       403:
 *         description: Доступ запрещен (профиль принадлежит другому пользователю)
 *       404:
 *         description: Профиль не найден или не запущен
 */
router.get('/:id/resources', authMiddleware, requireAuth, getProfileResourcesHandler);

/**
 * @swagger
 * /api/profiles/{id}/resources/history:
 *   get:
 *     summary: Получение истории статистики ресурсов профиля
 *     description: |
 *       Возвращает историю статистики использования ресурсов (CPU, память) для профиля.
 *       Доступно только для профилей текущего пользователя.
 *     tags: [Profiles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID профиля
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 100
 *           maximum: 1000
 *         description: Максимальное количество записей
 *       - in: query
 *         name: from
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Начальная дата (ISO 8601)
 *       - in: query
 *         name: to
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Конечная дата (ISO 8601)
 *     responses:
 *       200:
 *         description: История статистики ресурсов профиля
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 profileId:
 *                   type: string
 *                   format: uuid
 *                 history:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       profileId:
 *                         type: string
 *                         format: uuid
 *                       timestamp:
 *                         type: string
 *                         format: date-time
 *                       stats:
 *                         type: object
 *                         properties:
 *                           cpuUsage:
 *                             type: number
 *                           memoryUsage:
 *                             type: number
 *                 count:
 *                   type: integer
 *       401:
 *         description: Не авторизован
 *       403:
 *         description: Доступ запрещен (профиль принадлежит другому пользователю)
 *       404:
 *         description: Профиль не найден
 */
router.get('/:id/resources/history', authMiddleware, requireAuth, getProfileResourcesHistoryHandler);

/**
 * @swagger
 * /api/profiles/{id}/health:
 *   get:
 *     summary: Проверка здоровья профиля
 *     description: |
 *       Проверяет состояние здоровья профиля и возвращает результат проверки.
 *       Доступно только для профилей текущего пользователя.
 *     tags: [Profiles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID профиля
 *     responses:
 *       200:
 *         description: Результат проверки здоровья профиля
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 profileId:
 *                   type: string
 *                   format: uuid
 *                 status:
 *                   type: string
 *                   enum: [healthy, unhealthy, degraded, unknown]
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 details:
 *                   type: object
 *                   properties:
 *                     processRunning:
 *                       type: boolean
 *                     browserConnected:
 *                       type: boolean
 *                     cpuUsage:
 *                       type: number
 *                       nullable: true
 *                     memoryUsage:
 *                       type: number
 *                       nullable: true
 *                     resourceLimitsExceeded:
 *                       type: boolean
 *                       nullable: true
 *       401:
 *         description: Не авторизован
 *       403:
 *         description: Доступ запрещен (профиль принадлежит другому пользователю)
 *       404:
 *         description: Профиль не найден
 */
router.get('/:id/health', authMiddleware, requireAuth, checkProfileHealthHandler);

/**
 * @swagger
 * /api/profiles/{id}/network:
 *   get:
 *     summary: Получение статистики сетевой активности профиля
 *     description: |
 *       Возвращает статистику сетевой активности (входящий/исходящий трафик, скорость) для запущенного Chrome процесса профиля.
 *       Доступно только для профилей текущего пользователя.
 *     tags: [Profiles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID профиля
 *     responses:
 *       200:
 *         description: Статистика сетевой активности профиля
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 profileId:
 *                   type: string
 *                   format: uuid
 *                 pid:
 *                   type: number
 *                 bytesReceived:
 *                   type: number
 *                   description: Входящий трафик в байтах
 *                 bytesSent:
 *                   type: number
 *                   description: Исходящий трафик в байтах
 *                 receiveRate:
 *                   type: number
 *                   description: Скорость входящего трафика в байтах/сек
 *                 sendRate:
 *                   type: number
 *                   description: Скорость исходящего трафика в байтах/сек
 *                 connectionsCount:
 *                   type: number
 *                   description: Количество активных соединений
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       401:
 *         description: Не авторизован
 *       403:
 *         description: Доступ запрещен (профиль принадлежит другому пользователю)
 *       404:
 *         description: Профиль не найден или не запущен
 */
router.get('/:id/network', authMiddleware, requireAuth, getProfileNetworkStatsHandler);

/**
 * @swagger
 * /api/profiles/{id}/alerts:
 *   get:
 *     summary: Получение алертов профиля
 *     description: |
 *       Возвращает список алертов и уведомлений для профиля.
 *       Доступно только для профилей текущего пользователя.
 *     tags: [Profiles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID профиля
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 100
 *           maximum: 1000
 *         description: Максимальное количество алертов
 *       - in: query
 *         name: unreadOnly
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Только непрочитанные алерты
 *       - in: query
 *         name: from
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Начальная дата (ISO 8601)
 *       - in: query
 *         name: to
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Конечная дата (ISO 8601)
 *     responses:
 *       200:
 *         description: Список алертов профиля
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 profileId:
 *                   type: string
 *                   format: uuid
 *                 alerts:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       type:
 *                         type: string
 *                         enum: [RESOURCE_LIMIT_EXCEEDED, PROFILE_CRASHED, PROFILE_RESTARTED, PROFILE_HEALTH_DEGRADED, NETWORK_LIMIT_EXCEEDED, PROFILE_ERROR]
 *                       severity:
 *                         type: string
 *                         enum: [info, warning, error, critical]
 *                       title:
 *                         type: string
 *                       message:
 *                         type: string
 *                       timestamp:
 *                         type: string
 *                         format: date-time
 *                       read:
 *                         type: boolean
 *                 count:
 *                   type: integer
 *       401:
 *         description: Не авторизован
 *       403:
 *         description: Доступ запрещен
 *       404:
 *         description: Профиль не найден
 */
router.get('/:id/alerts', authMiddleware, requireAuth, getProfileAlertsHandler);

/**
 * @swagger
 * /api/profiles/{id}/alerts/unread-count:
 *   get:
 *     summary: Получение количества непрочитанных алертов
 *     description: |
 *       Возвращает количество непрочитанных алертов для профиля.
 *       Доступно только для профилей текущего пользователя.
 *     tags: [Profiles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID профиля
 *     responses:
 *       200:
 *         description: Количество непрочитанных алертов
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 profileId:
 *                   type: string
 *                   format: uuid
 *                 unreadCount:
 *                   type: integer
 *       401:
 *         description: Не авторизован
 *       403:
 *         description: Доступ запрещен
 *       404:
 *         description: Профиль не найден
 */
router.get('/:id/alerts/unread-count', authMiddleware, requireAuth, getProfileUnreadAlertsCountHandler);

/**
 * @swagger
 * /api/profiles/{id}/alerts/{alertId}/read:
 *   post:
 *     summary: Отметка алерта как прочитанного
 *     description: |
 *       Отмечает алерт как прочитанный.
 *       Доступно только для профилей текущего пользователя.
 *     tags: [Profiles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID профиля
 *       - in: path
 *         name: alertId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID алерта
 *     responses:
 *       200:
 *         description: Алерт отмечен как прочитанный
 *       401:
 *         description: Не авторизован
 *       403:
 *         description: Доступ запрещен
 *       404:
 *         description: Профиль или алерт не найден
 */
router.post('/:id/alerts/:alertId/read', authMiddleware, requireAuth, markAlertAsReadHandler);

/**
 * @swagger
 * /api/profiles/{id}/alerts/read-all:
 *   post:
 *     summary: Отметка всех алертов как прочитанных
 *     description: |
 *       Отмечает все алерты профиля как прочитанные.
 *       Доступно только для профилей текущего пользователя.
 *     tags: [Profiles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID профиля
 *     responses:
 *       200:
 *         description: Все алерты отмечены как прочитанные
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 markedCount:
 *                   type: integer
 *       401:
 *         description: Не авторизован
 *       403:
 *         description: Доступ запрещен
 *       404:
 *         description: Профиль не найден
 */
router.post('/:id/alerts/read-all', authMiddleware, requireAuth, markAllAlertsAsReadHandler);

/**
 * @swagger
 * /api/profiles/{id}/analytics:
 *   get:
 *     summary: Получение аналитики профиля
 *     description: |
 *       Возвращает агрегированную аналитику использования ресурсов и сетевой активности профиля за указанный период.
 *       Доступно только для профилей текущего пользователя.
 *     tags: [Profiles]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID профиля
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [hour, day, week, month]
 *           default: day
 *         description: Период агрегации
 *       - in: query
 *         name: from
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Начальная дата (ISO 8601)
 *       - in: query
 *         name: to
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Конечная дата (ISO 8601)
 *     responses:
 *       200:
 *         description: Аналитика профиля
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 profileId:
 *                   type: string
 *                   format: uuid
 *                 resourceStats:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       period:
 *                         type: string
 *                       periodStart:
 *                         type: string
 *                         format: date-time
 *                       periodEnd:
 *                         type: string
 *                         format: date-time
 *                       avgCpuUsage:
 *                         type: number
 *                       maxCpuUsage:
 *                         type: number
 *                       avgMemoryUsage:
 *                         type: number
 *                       maxMemoryUsage:
 *                         type: number
 *                       sampleCount:
 *                         type: integer
 *                 networkStats:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       period:
 *                         type: string
 *                       periodStart:
 *                         type: string
 *                         format: date-time
 *                       periodEnd:
 *                         type: string
 *                         format: date-time
 *                       totalBytesReceived:
 *                         type: number
 *                       totalBytesSent:
 *                         type: number
 *                       avgReceiveRate:
 *                         type: number
 *                       avgSendRate:
 *                         type: number
 *                       sampleCount:
 *                         type: integer
 *                 period:
 *                   type: string
 *                 from:
 *                   type: string
 *                   format: date-time
 *                 to:
 *                   type: string
 *                   format: date-time
 *       401:
 *         description: Не авторизован
 *       403:
 *         description: Доступ запрещен
 *       404:
 *         description: Профиль не найден
 */
router.get('/:id/analytics', authMiddleware, requireAuth, getProfileAnalyticsHandler);

export default router;

