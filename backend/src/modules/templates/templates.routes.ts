/**
 * Маршруты для модуля шаблонов
 * 
 * Все маршруты защищены authMiddleware.
 * 
 * @module modules/templates/templates.routes
 */

import { Router } from 'express';
import multer from 'multer';
import { TemplatesController } from './templates.controller';
import { TemplatesService } from './templates.service';
import { PrismaClient } from '@prisma/client';
import { authMiddleware } from '../../middleware/auth';
import { FILE_SIZE_LIMITS } from './file-storage';
import logger from '../../config/logger';

/**
 * Конфигурация multer для загрузки файлов
 * Файлы хранятся в памяти (buffer) для последующей обработки FileStorageService
 */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: FILE_SIZE_LIMITS.MAX_FILE_SIZE, // 50 MB
  },
});

/**
 * Создание роутера для модуля шаблонов
 * 
 * @param prisma - PrismaClient для работы с БД
 * @returns Express Router
 */
export function createTemplatesRouter(prisma: PrismaClient): Router {
  const router = Router();

  // Инициализация сервиса и контроллера
  const templatesService = new TemplatesService(prisma);
  const controller = new TemplatesController(templatesService);

  // Инициализация сервиса (создание директорий)
  templatesService.initialize().catch((error) => {
    logger.error('Failed to initialize templates service', { error });
  });

  // Все маршруты защищены аутентификацией
  router.use(authMiddleware);

  // ============================================
  // Утилиты (без параметров в пути - должны быть раньше /:id)
  // ============================================

  /**
   * GET /api/templates/variables
   * Получение списка доступных переменных
   */
  router.get('/variables', controller.getVariables);

  /**
   * POST /api/templates/validate-text
   * Валидация текста шаблона
   */
  router.post('/validate-text', controller.validateText);

  // ============================================
  // Категории
  // ============================================

  /**
   * GET /api/templates/categories
   * Получение списка категорий
   */
  router.get('/categories', controller.listCategories);

  /**
   * GET /api/templates/categories/:id
   * Получение категории по ID
   */
  router.get('/categories/:id', controller.getCategory);

  /**
   * POST /api/templates/categories
   * Создание категории
   */
  router.post('/categories', controller.createCategory);

  /**
   * PUT /api/templates/categories/:id
   * Обновление категории
   */
  router.put('/categories/:id', controller.updateCategory);

  /**
   * DELETE /api/templates/categories/:id
   * Удаление категории
   */
  router.delete('/categories/:id', controller.deleteCategory);

  // ============================================
  // Шаблоны
  // ============================================

  /**
   * GET /api/templates
   * Получение списка шаблонов (с пагинацией и фильтрами)
   */
  router.get('/', controller.listTemplates);

  /**
   * POST /api/templates
   * Создание шаблона
   */
  router.post('/', controller.createTemplate);

  /**
   * GET /api/templates/:id
   * Получение шаблона по ID
   */
  router.get('/:id', controller.getTemplate);

  /**
   * PUT /api/templates/:id
   * Обновление шаблона
   */
  router.put('/:id', controller.updateTemplate);

  /**
   * DELETE /api/templates/:id
   * Удаление шаблона
   */
  router.delete('/:id', controller.deleteTemplate);

  /**
   * POST /api/templates/:id/duplicate
   * Дублирование шаблона
   */
  router.post('/:id/duplicate', controller.duplicateTemplate);

  /**
   * POST /api/templates/:id/move
   * Перемещение шаблона в другую категорию
   */
  router.post('/:id/move', controller.moveTemplate);

  /**
   * POST /api/templates/:id/preview
   * Превью шаблона с подстановкой переменных
   */
  router.post('/:id/preview', controller.previewTemplate);

  // ============================================
  // Элементы шаблона
  // ============================================

  /**
   * POST /api/templates/:templateId/items
   * Добавление элемента в шаблон
   */
  router.post('/:templateId/items', controller.addItem);

  /**
   * PUT /api/templates/:templateId/items/reorder
   * Изменение порядка элементов
   * ВАЖНО: этот маршрут должен быть ПЕРЕД /:templateId/items/:itemId
   */
  router.put('/:templateId/items/reorder', controller.reorderItems);

  /**
   * PUT /api/templates/:templateId/items/:itemId
   * Обновление элемента шаблона
   */
  router.put('/:templateId/items/:itemId', controller.updateItem);

  /**
   * DELETE /api/templates/:templateId/items/:itemId
   * Удаление элемента шаблона
   */
  router.delete('/:templateId/items/:itemId', controller.deleteItem);

  // ============================================
  // Файлы
  // ============================================

  /**
   * POST /api/templates/:templateId/items/:itemId/upload
   * Загрузка файла для элемента
   */
  router.post(
    '/:templateId/items/:itemId/upload',
    upload.single('file'),
    controller.uploadFile
  );

  /**
   * DELETE /api/templates/:templateId/items/:itemId/file
   * Удаление файла из элемента
   */
  router.delete('/:templateId/items/:itemId/file', controller.deleteFile);

  return router;
}

/**
 * Экспорт функции создания роутера с альтернативным именем
 */
export const templatesRouter = createTemplatesRouter;

