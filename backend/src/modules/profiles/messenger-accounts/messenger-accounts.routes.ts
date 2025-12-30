/**
 * Маршруты управления аккаунтами мессенджеров
 * 
 * Определяет API endpoints для управления аккаунтами мессенджеров:
 * - CRUD операции с аккаунтами
 * - Управление включением/выключением мессенджеров
 * - Управление конфигурацией проверок (ROOT only)
 * 
 * Безопасность:
 * - Все endpoints требуют авторизации (authMiddleware + requireAuth)
 * - Каждый пользователь видит и управляет только аккаунтами своих профилей
 * 
 * @module routes/messenger-accounts.routes
 */

import { Router } from 'express';
import { authMiddleware, requireAuth, requireRoot, validateBody } from '../../../middleware';
import {
  createMessengerAccountSchema,
  updateMessengerAccountSchema,
  updateMessengerCheckConfigSchema,
} from './messenger-accounts.schemas';
import {
  getAllServicesHandler,
  getServiceByIdHandler,
  getAccountsByProfileHandler,
  getAccountByIdHandler,
  createAccountHandler,
  updateAccountHandler,
  enableAccountHandler,
  disableAccountHandler,
  deleteAccountHandler,
  checkAccountStatusHandler,
  submitCloudPasswordHandler,
  getAllCheckConfigsHandler,
  getCheckConfigByServiceIdHandler,
  updateCheckConfigHandler,
  getAccountsCountsHandler,
} from './messenger-accounts.controller';

const router = Router();

/**
 * @swagger
 * /api/messenger-services:
 *   get:
 *     summary: Получение всех мессенджеров (справочник)
 *     description: |
 *       Возвращает список всех доступных мессенджеров в системе.
 *       Доступно для всех авторизованных пользователей.
 *     tags: [Messenger Accounts]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Список мессенджеров
 *       401:
 *         description: Не авторизован
 */
router.get('/services', authMiddleware, requireAuth, getAllServicesHandler);

/**
 * @swagger
 * /api/messenger-services/{id}:
 *   get:
 *     summary: Получение мессенджера по ID
 *     description: |
 *       Возвращает информацию о мессенджере по ID.
 *       Доступно для всех авторизованных пользователей.
 *     tags: [Messenger Accounts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID мессенджера
 *     responses:
 *       200:
 *         description: Информация о мессенджере
 *       404:
 *         description: Мессенджер не найден
 *       401:
 *         description: Не авторизован
 */
router.get('/services/:id', authMiddleware, requireAuth, getServiceByIdHandler);

/**
 * @swagger
 * /api/profiles/{profileId}/messenger-accounts:
 *   get:
 *     summary: Получение всех аккаунтов мессенджеров профиля
 *     description: |
 *       Возвращает список всех аккаунтов мессенджеров для указанного профиля.
 *       Доступно только для владельца профиля.
 *     tags: [Messenger Accounts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: profileId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID профиля
 *     responses:
 *       200:
 *         description: Список аккаунтов мессенджеров
 *       403:
 *         description: Доступ запрещен
 *       404:
 *         description: Профиль не найден
 *       401:
 *         description: Не авторизован
 */
router.get(
  '/profiles/:profileId/messenger-accounts',
  authMiddleware,
  requireAuth,
  getAccountsByProfileHandler
);

/**
 * @swagger
 * /api/profiles/{profileId}/messenger-accounts:
 *   post:
 *     summary: Создание аккаунта мессенджера для профиля
 *     description: |
 *       Создает и привязывает аккаунт мессенджера к профилю.
 *       Доступно только для владельца профиля.
 *     tags: [Messenger Accounts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: profileId
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
 *             type: object
 *             required:
 *               - serviceId
 *             properties:
 *               serviceId:
 *                 type: string
 *                 format: uuid
 *               isEnabled:
 *                 type: boolean
 *                 default: true
 *               metadata:
 *                 type: object
 *     responses:
 *       201:
 *         description: Аккаунт успешно создан
 *       400:
 *         description: Ошибка валидации или аккаунт уже существует
 *       403:
 *         description: Доступ запрещен
 *       404:
 *         description: Профиль или мессенджер не найден
 *       401:
 *         description: Не авторизован
 */
router.post(
  '/profiles/:profileId/messenger-accounts',
  authMiddleware,
  requireAuth,
  validateBody(createMessengerAccountSchema),
  createAccountHandler
);

/**
 * @swagger
 * /api/profiles/{profileId}/messenger-accounts/{accountId}:
 *   get:
 *     summary: Получение аккаунта мессенджера по ID
 *     description: |
 *       Возвращает информацию об аккаунте мессенджера.
 *       Доступно только для владельца профиля.
 *     tags: [Messenger Accounts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: profileId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID профиля
 *       - in: path
 *         name: accountId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID аккаунта
 *     responses:
 *       200:
 *         description: Информация об аккаунте
 *       403:
 *         description: Доступ запрещен
 *       404:
 *         description: Аккаунт не найден
 *       401:
 *         description: Не авторизован
 */
router.get(
  '/profiles/:profileId/messenger-accounts/:accountId',
  authMiddleware,
  requireAuth,
  getAccountByIdHandler
);

/**
 * @swagger
 * /api/profiles/{profileId}/messenger-accounts/{accountId}:
 *   patch:
 *     summary: Обновление аккаунта мессенджера
 *     description: |
 *       Обновляет данные аккаунта мессенджера.
 *       Доступно только для владельца профиля.
 *     tags: [Messenger Accounts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: profileId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID профиля
 *       - in: path
 *         name: accountId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID аккаунта
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               isEnabled:
 *                 type: boolean
 *               metadata:
 *                 type: object
 *     responses:
 *       200:
 *         description: Аккаунт успешно обновлен
 *       400:
 *         description: Ошибка валидации
 *       403:
 *         description: Доступ запрещен
 *       404:
 *         description: Аккаунт не найден
 *       401:
 *         description: Не авторизован
 */
router.patch(
  '/profiles/:profileId/messenger-accounts/:accountId',
  authMiddleware,
  requireAuth,
  validateBody(updateMessengerAccountSchema),
  updateAccountHandler
);

/**
 * @swagger
 * /api/profiles/{profileId}/messenger-accounts/{accountId}:
 *   delete:
 *     summary: Удаление аккаунта мессенджера
 *     description: |
 *       Удаляет аккаунт мессенджера из профиля.
 *       Доступно только для владельца профиля.
 *     tags: [Messenger Accounts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: profileId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID профиля
 *       - in: path
 *         name: accountId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID аккаунта
 *     responses:
 *       204:
 *         description: Аккаунт успешно удален
 *       403:
 *         description: Доступ запрещен
 *       404:
 *         description: Аккаунт не найден
 *       401:
 *         description: Не авторизован
 */
router.delete(
  '/profiles/:profileId/messenger-accounts/:accountId',
  authMiddleware,
  requireAuth,
  deleteAccountHandler
);

/**
 * @swagger
 * /api/profiles/{profileId}/messenger-accounts/{accountId}/enable:
 *   post:
 *     summary: Включение мессенджера для профиля
 *     description: |
 *       Включает мониторинг мессенджера для профиля.
 *       Доступно только для владельца профиля.
 *     tags: [Messenger Accounts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: profileId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID профиля
 *       - in: path
 *         name: accountId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID аккаунта
 *     responses:
 *       200:
 *         description: Мессенджер включен
 *       403:
 *         description: Доступ запрещен
 *       404:
 *         description: Аккаунт не найден
 *       401:
 *         description: Не авторизован
 */
router.post(
  '/profiles/:profileId/messenger-accounts/:accountId/enable',
  authMiddleware,
  requireAuth,
  enableAccountHandler
);

/**
 * @swagger
 * /api/profiles/{profileId}/messenger-accounts/{accountId}/disable:
 *   post:
 *     summary: Выключение мессенджера для профиля
 *     description: |
 *       Выключает мониторинг мессенджера для профиля.
 *       Доступно только для владельца профиля.
 *     tags: [Messenger Accounts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: profileId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID профиля
 *       - in: path
 *         name: accountId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID аккаунта
 *     responses:
 *       200:
 *         description: Мессенджер выключен
 *       403:
 *         description: Доступ запрещен
 *       404:
 *         description: Аккаунт не найден
 *       401:
 *         description: Не авторизован
 */
router.post(
  '/profiles/:profileId/messenger-accounts/:accountId/disable',
  authMiddleware,
  requireAuth,
  disableAccountHandler
);

/**
 * @swagger
 * /api/profiles/{profileId}/messenger-accounts/{accountId}/check:
 *   post:
 *     summary: Проверка статуса входа аккаунта мессенджера
 *     description: |
 *       Выполняет проверку статуса входа для аккаунта мессенджера.
 *       Профиль должен быть запущен. Возвращает результат проверки с QR кодом (если требуется вход).
 *       Доступно только для владельца профиля.
 *     tags: [Messenger Accounts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: profileId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID профиля
 *       - in: path
 *         name: accountId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID аккаунта
 *     responses:
 *       200:
 *         description: Результат проверки статуса
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   enum: [LOGGED_IN, NOT_LOGGED_IN, CHECKING, ERROR, UNKNOWN]
 *                 qrCode:
 *                   type: string
 *                   description: QR код в base64 (если требуется вход)
 *                 cloudPasswordRequired:
 *                   type: boolean
 *                   description: Требуется ли облачный пароль (для Telegram)
 *                 error:
 *                   type: string
 *                   description: Сообщение об ошибке (если есть)
 *                 checkedAt:
 *                   type: string
 *                   format: date-time
 *       400:
 *         description: Профиль не запущен или другие ошибки
 *       403:
 *         description: Доступ запрещен
 *       404:
 *         description: Аккаунт или профиль не найден
 *       401:
 *         description: Не авторизован
 */
router.post(
  '/profiles/:profileId/messenger-accounts/:accountId/check',
  authMiddleware,
  requireAuth,
  checkAccountStatusHandler
);

/**
 * @swagger
 * /api/profiles/{profileId}/messenger-accounts/{accountId}/cloud-password:
 *   post:
 *     summary: Ввод облачного пароля (2FA) для Telegram
 *     description: |
 *       Вводит облачный пароль для Telegram после сканирования QR кода.
 *       Профиль должен быть запущен. Применимо только для Telegram.
 *       Доступно только для владельца профиля.
 *     tags: [Messenger Accounts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: profileId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID профиля
 *       - in: path
 *         name: accountId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID аккаунта
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - password
 *             properties:
 *               password:
 *                 type: string
 *                 description: Облачный пароль
 *     responses:
 *       200:
 *         description: Результат ввода пароля
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 status:
 *                   type: string
 *                 error:
 *                   type: string
 *       400:
 *         description: Профиль не запущен или не Telegram аккаунт
 *       403:
 *         description: Доступ запрещен
 *       404:
 *         description: Аккаунт или профиль не найден
 *       401:
 *         description: Не авторизован
 */
router.post(
  '/profiles/:profileId/messenger-accounts/:accountId/cloud-password',
  authMiddleware,
  requireAuth,
  submitCloudPasswordHandler
);

/**
 * @swagger
 * /api/messenger-accounts/counts:
 *   post:
 *     summary: Получение количества аккаунтов мессенджеров для списка профилей
 *     description: |
 *       Возвращает количество аккаунтов мессенджеров для каждого профиля из списка.
 *       Доступно для всех авторизованных пользователей.
 *     tags: [Messenger Accounts]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - profileIds
 *             properties:
 *               profileIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: uuid
 *     responses:
 *       200:
 *         description: Объект с количеством аккаунтов для каждого профиля
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               additionalProperties:
 *                 type: integer
 *       400:
 *         description: Ошибка валидации
 *       401:
 *         description: Не авторизован
 */
router.post(
  '/messenger-accounts/counts',
  authMiddleware,
  requireAuth,
  getAccountsCountsHandler
);

/**
 * @swagger
 * /api/messenger-check-configs:
 *   get:
 *     summary: Получение всех конфигураций проверки (ROOT only)
 *     description: |
 *       Возвращает список всех конфигураций проверки статуса входа для мессенджеров.
 *       Доступно только для ROOT пользователей.
 *     tags: [Messenger Accounts]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Список конфигураций
 *       403:
 *         description: Доступ запрещен (только ROOT)
 *       401:
 *         description: Не авторизован
 */
router.get(
  '/messenger-check-configs',
  authMiddleware,
  requireAuth,
  requireRoot,
  getAllCheckConfigsHandler
);

/**
 * @swagger
 * /api/messenger-check-configs/{serviceId}:
 *   get:
 *     summary: Получение конфигурации проверки по serviceId (ROOT only)
 *     description: |
 *       Возвращает конфигурацию проверки статуса входа для конкретного мессенджера.
 *       Доступно только для ROOT пользователей.
 *     tags: [Messenger Accounts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: serviceId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID мессенджера
 *     responses:
 *       200:
 *         description: Конфигурация найдена
 *       403:
 *         description: Доступ запрещен (только ROOT)
 *       404:
 *         description: Конфигурация не найдена
 *       401:
 *         description: Не авторизован
 */
router.get(
  '/messenger-check-configs/:serviceId',
  authMiddleware,
  requireAuth,
  requireRoot,
  getCheckConfigByServiceIdHandler
);

/**
 * @swagger
 * /api/messenger-check-configs/{serviceId}:
 *   put:
 *     summary: Обновление конфигурации проверки (ROOT only)
 *     description: |
 *       Обновляет конфигурацию проверки статуса входа для мессенджера.
 *       Доступно только для ROOT пользователей.
 *     tags: [Messenger Accounts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: serviceId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID мессенджера
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - checkIntervalSeconds
 *             properties:
 *               checkIntervalSeconds:
 *                 type: integer
 *                 minimum: 60
 *                 maximum: 3600
 *               enabled:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Конфигурация успешно обновлена
 *       400:
 *         description: Ошибка валидации
 *       403:
 *         description: Доступ запрещен (только ROOT)
 *       404:
 *         description: Мессенджер не найден
 *       401:
 *         description: Не авторизован
 */
router.put(
  '/messenger-check-configs/:serviceId',
  authMiddleware,
  requireAuth,
  requireRoot,
  validateBody(updateMessengerCheckConfigSchema),
  updateCheckConfigHandler
);

export default router;

