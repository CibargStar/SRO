/**
 * Маршруты экспорта групп клиентов
 * 
 * Определяет API endpoints для экспорта групп клиентов в Excel/CSV файлы:
 * - GET /api/export/groups/:groupId - экспорт группы в файл
 * 
 * Безопасность:
 * - Все endpoints требуют авторизации (authMiddleware + requireAuth)
 * - Группа должна существовать и принадлежать пользователю (или ROOT может экспортировать любую)
 * 
 * @module routes/export.routes
 */

import { Router } from 'express';
import { authMiddleware, requireAuth, validateQuery } from '../middleware';
import { exportGroupQuerySchema } from '../modules/export/schemas/export.schemas';
import { exportGroupHandler } from '../modules/export/export.controller';

const router = Router();

/**
 * @swagger
 * /api/export/groups/{groupId}:
 *   get:
 *     summary: Экспорт группы клиентов в файл
 *     description: |
 *       Экспортирует группу клиентов в Excel/CSV файл.
 *       Файл содержит 4 колонки: FullName (ФИО), Phone (телефоны через запятую), Region (регион), Date (дата создания).
 *       Имя файла соответствует названию группы.
 *       Доступно для всех авторизованных пользователей (только свои группы, ROOT - все группы).
 *     tags: [Export]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: groupId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UUID группы клиентов для экспорта
 *       - in: query
 *         name: format
 *         schema:
 *           type: string
 *           enum: [xlsx, xls, csv]
 *           default: xlsx
 *         description: Формат файла (xlsx, xls, csv)
 *     responses:
 *       200:
 *         description: Файл успешно сгенерирован и отправлен
 *         content:
 *           application/vnd.openxmlformats-officedocument.spreadsheetml.sheet:
 *             schema:
 *               type: string
 *               format: binary
 *             description: Excel файл (XLSX)
 *           application/vnd.ms-excel:
 *             schema:
 *               type: string
 *               format: binary
 *             description: Excel файл (XLS)
 *           text/csv:
 *             schema:
 *               type: string
 *               format: binary
 *             description: CSV файл
 *       400:
 *         description: Ошибка валидации (неверный формат)
 *       401:
 *         description: Не авторизован
 *       403:
 *         description: Доступ запрещен (группа принадлежит другому пользователю)
 *       404:
 *         description: Группа не найдена
 *       500:
 *         description: Внутренняя ошибка сервера
 */
router.get(
  '/groups/:groupId',
  authMiddleware,
  requireAuth,
  validateQuery(exportGroupQuerySchema),
  exportGroupHandler as any
);

export default router;

