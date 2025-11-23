/**
 * Маршруты импорта клиентов
 * 
 * Определяет API endpoints для импорта клиентов из Excel файлов:
 * - POST /api/import/clients - импорт клиентов из файла
 * 
 * Безопасность:
 * - Все endpoints требуют авторизации (authMiddleware + requireAuth)
 * - Группа должна существовать и принадлежать пользователю (или ROOT может импортировать в любую)
 * 
 * @module routes/import.routes
 */

import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { authMiddleware, requireAuth, validateQuery, validateBody } from '../middleware';
import { importClientsQuerySchema } from '../modules/import/schemas/import.schemas';
import { importClientsHandler } from '../modules/import/import.controller';
import {
  listImportConfigsHandler,
  getImportConfigHandler,
  getDefaultImportConfigHandler,
  createImportConfigHandler,
  updateImportConfigHandler,
  deleteImportConfigHandler,
  createFromTemplateHandler,
} from '../modules/import/import-config.controller';
import { ImportConfigSchema, GetImportConfigsQuerySchema } from '../modules/import/schemas/import-config.schemas';

const router = Router();

/**
 * Настройка multer для загрузки файлов
 */
const upload = multer({
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB (для файлов до 10к строк)
  fileFilter: (_req, file, cb) => {
    const allowedExtensions = ['.xlsx', '.xls', '.csv'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedExtensions.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file format. Allowed: .xlsx, .xls, .csv'));
    }
  },
});

/**
 * @swagger
 * /api/import/clients:
 *   post:
 *     summary: Импорт клиентов из Excel файла
 *     description: |
 *       Импортирует клиентов из Excel файла (XLSX, XLS, CSV) в указанную группу.
 *       Файл должен содержать колонки: name (ФИО), phone (телефон), region (регион).
 *       Поддерживается умная дедупликация: обновление существующих клиентов, добавление новых номеров.
 *       Доступно для всех авторизованных пользователей.
 *     tags: [Import]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: groupId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID группы клиентов для импорта
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: Excel файл (XLSX, XLS, CSV)
 *     responses:
 *       200:
 *         description: Импорт выполнен успешно
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 statistics:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: number
 *                     created:
 *                       type: number
 *                     updated:
 *                       type: number
 *                     skipped:
 *                       type: number
 *                     errors:
 *                       type: number
 *                     regionsCreated:
 *                       type: number
 *                 message:
 *                   type: string
 *                 errors:
 *                   type: array
 *                   items:
 *                     type: object
 *                 groupId:
 *                   type: string
 *                 groupName:
 *                   type: string
 *       400:
 *         description: Ошибка валидации (неверный формат файла, отсутствует файл или groupId)
 *       401:
 *         description: Не авторизован
 *       403:
 *         description: Доступ запрещен (группа принадлежит другому пользователю)
 *       404:
 *         description: Группа не найдена
 *       500:
 *         description: Внутренняя ошибка сервера
 */
router.post(
  '/clients',
  authMiddleware,
  requireAuth,
  upload.single('file'),
  validateQuery(importClientsQuerySchema),
  importClientsHandler as any
);

/**
 * @swagger
 * /api/import/configs:
 *   get:
 *     summary: Получить список конфигураций импорта
 *     tags: [Import]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: includeTemplates
 *         schema:
 *           type: boolean
 *         description: Включить предустановленные шаблоны
 *     responses:
 *       200:
 *         description: Список конфигураций
 */
router.get(
  '/configs',
  authMiddleware,
  requireAuth,
  validateQuery(GetImportConfigsQuerySchema),
  listImportConfigsHandler as any
);

/**
 * @swagger
 * /api/import/configs/default:
 *   get:
 *     summary: Получить конфигурацию по умолчанию
 *     tags: [Import]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Конфигурация по умолчанию
 */
router.get(
  '/configs/default',
  authMiddleware,
  requireAuth,
  getDefaultImportConfigHandler as any
);

/**
 * @swagger
 * /api/import/configs/:id:
 *   get:
 *     summary: Получить конфигурацию по ID
 *     tags: [Import]
 *     security:
 *       - bearerAuth: []
 */
router.get(
  '/configs/:id',
  authMiddleware,
  requireAuth,
  getImportConfigHandler as any
);

/**
 * @swagger
 * /api/import/configs:
 *   post:
 *     summary: Создать новую конфигурацию
 *     tags: [Import]
 *     security:
 *       - bearerAuth: []
 */
router.post(
  '/configs',
  authMiddleware,
  requireAuth,
  validateBody(ImportConfigSchema),
  createImportConfigHandler as any
);

/**
 * @swagger
 * /api/import/configs/:id:
 *   put:
 *     summary: Обновить конфигурацию
 *     tags: [Import]
 *     security:
 *       - bearerAuth: []
 */
router.put(
  '/configs/:id',
  authMiddleware,
  requireAuth,
  validateBody(ImportConfigSchema.deepPartial()),
  updateImportConfigHandler as any
);

/**
 * @swagger
 * /api/import/configs/:id:
 *   delete:
 *     summary: Удалить конфигурацию
 *     tags: [Import]
 *     security:
 *       - bearerAuth: []
 */
router.delete(
  '/configs/:id',
  authMiddleware,
  requireAuth,
  deleteImportConfigHandler as any
);

/**
 * @swagger
 * /api/import/configs/template/:name:
 *   post:
 *     summary: Создать конфигурацию из шаблона
 *     tags: [Import]
 *     security:
 *       - bearerAuth: []
 */
router.post(
  '/configs/template/:name',
  authMiddleware,
  requireAuth,
  createFromTemplateHandler as any
);

export default router;

