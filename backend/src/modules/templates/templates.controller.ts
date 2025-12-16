/**
 * Контроллер для модуля шаблонов
 * 
 * Обрабатывает HTTP запросы для категорий и шаблонов рассылки.
 * 
 * @module modules/templates/templates.controller
 */

import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../middleware/auth';
import { TemplatesService } from './templates.service';
import {
  createCategorySchema,
  updateCategorySchema,
  createTemplateSchema,
  updateTemplateSchema,
  duplicateTemplateSchema,
  moveTemplateSchema,
  createTemplateItemSchema,
  updateTemplateItemSchema,
  reorderItemsSchema,
  listTemplatesQuerySchema,
  previewTemplateSchema,
  validateTextSchema,
} from './templates.schemas';
import { FileValidationError } from './file-storage';

/**
 * Контроллер для работы с шаблонами
 */
export class TemplatesController {
  constructor(private templatesService: TemplatesService) {}

  // ============================================
  // Категории
  // ============================================

  /**
   * Получение списка категорий
   * GET /api/templates/categories
   */
  listCategories = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;
      const categories = await this.templatesService.listCategories(userId);
      res.json({ data: categories });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Получение категории по ID
   * GET /api/templates/categories/:id
   */
  getCategory = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;
      const categoryId = req.params.id;
      const category = await this.templatesService.getCategory(categoryId);
      
      if (!category) {
        res.status(404).json({ error: 'Category not found' });
        return;
      }

      // Проверка владельца
      if (category.userId !== userId) {
        res.status(403).json({ error: 'Access denied' });
        return;
      }

      res.json({ data: category });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Создание категории
   * POST /api/templates/categories
   */
  createCategory = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;
      const input = createCategorySchema.parse(req.body);
      const category = await this.templatesService.createCategory(userId, input);
      res.status(201).json({ data: category });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Обновление категории
   * PUT /api/templates/categories/:id
   */
  updateCategory = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;
      const categoryId = req.params.id;
      const input = updateCategorySchema.parse(req.body);
      const category = await this.templatesService.updateCategory(categoryId, userId, input);
      res.json({ data: category });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Удаление категории
   * DELETE /api/templates/categories/:id
   */
  deleteCategory = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;
      const categoryId = req.params.id;
      await this.templatesService.deleteCategory(categoryId, userId);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };

  // ============================================
  // Шаблоны
  // ============================================

  /**
   * Получение списка шаблонов
   * GET /api/templates
   */
  listTemplates = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;
      const queryParams = req.query as Record<string, string | undefined>;
      const query = listTemplatesQuerySchema.parse({
        ...req.query,
        messengerTarget: queryParams.messengerTarget ?? queryParams.messengerType,
      });
      const result = await this.templatesService.listTemplates(userId, query);
      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  /**
   * Получение шаблона по ID
   * GET /api/templates/:id
   */
  getTemplate = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;
      const templateId = req.params.id;
      const template = await this.templatesService.getTemplate(templateId);
      
      if (!template) {
        res.status(404).json({ error: 'Template not found' });
        return;
      }

      // Проверка владельца
      if (template.userId !== userId) {
        res.status(403).json({ error: 'Access denied' });
        return;
      }

      res.json({ data: template });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Создание шаблона
   * POST /api/templates
   */
  createTemplate = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;
      const body = req.body as Record<string, unknown>;
      const input = createTemplateSchema.parse({
        ...req.body,
        messengerTarget: body.messengerTarget ?? body.messengerType,
      });
      const template = await this.templatesService.createTemplate(userId, input);
      res.status(201).json({ data: template });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Обновление шаблона
   * PUT /api/templates/:id
   */
  updateTemplate = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;
      const templateId = req.params.id;
      const body = req.body as Record<string, unknown>;
      const input = updateTemplateSchema.parse({
        ...req.body,
        messengerTarget: body.messengerTarget ?? body.messengerType,
      });
      const template = await this.templatesService.updateTemplate(templateId, userId, input);
      res.json({ data: template });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Удаление шаблона
   * DELETE /api/templates/:id
   */
  deleteTemplate = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;
      const templateId = req.params.id;
      await this.templatesService.deleteTemplate(templateId, userId);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };

  /**
   * Дублирование шаблона
   * POST /api/templates/:id/duplicate
   */
  duplicateTemplate = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;
      const templateId = req.params.id;
      const input = duplicateTemplateSchema.parse(req.body);
      const template = await this.templatesService.duplicateTemplate(templateId, userId, input.name);
      res.status(201).json({ data: template });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Перемещение шаблона в категорию
   * POST /api/templates/:id/move
   */
  moveTemplate = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;
      const templateId = req.params.id;
      const input = moveTemplateSchema.parse(req.body);
      const template = await this.templatesService.moveTemplate(templateId, userId, input.categoryId);
      res.json({ data: template });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Превью шаблона
   * POST /api/templates/:id/preview
   */
  previewTemplate = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;
      const templateId = req.params.id;
      const input = previewTemplateSchema.parse(req.body);

      // Проверка владельца
      const template = await this.templatesService.getTemplate(templateId);
      if (!template) {
        res.status(404).json({ error: 'Template not found' });
        return;
      }
      if (template.userId !== userId) {
        res.status(403).json({ error: 'Access denied' });
        return;
      }

      const preview = await this.templatesService.previewTemplate({
        templateId,
        clientData: input.clientData,
      });
      res.json({ data: preview });
    } catch (error) {
      next(error);
    }
  };

  // ============================================
  // Элементы шаблона
  // ============================================

  /**
   * Добавление элемента в шаблон
   * POST /api/templates/:templateId/items
   */
  addItem = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;
      const templateId = req.params.templateId;
      const input = createTemplateItemSchema.parse(req.body);
      const item = await this.templatesService.addItem(templateId, userId, input);
      res.status(201).json({ data: item });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Обновление элемента шаблона
   * PUT /api/templates/:templateId/items/:itemId
   */
  updateItem = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;
      const { itemId } = req.params;
      const input = updateTemplateItemSchema.parse(req.body);
      const item = await this.templatesService.updateItem(itemId, userId, input);
      res.json({ data: item });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Удаление элемента шаблона
   * DELETE /api/templates/:templateId/items/:itemId
   */
  deleteItem = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;
      const { itemId } = req.params;
      await this.templatesService.deleteItem(itemId, userId);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };

  /**
   * Изменение порядка элементов
   * PUT /api/templates/:templateId/items/reorder
   */
  reorderItems = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;
      const templateId = req.params.templateId;
      const input = reorderItemsSchema.parse(req.body);
      await this.templatesService.reorderItems(templateId, userId, input.items);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };

  // ============================================
  // Файлы
  // ============================================

  /**
   * Загрузка файла для элемента
   * POST /api/templates/:templateId/items/:itemId/upload
   */
  uploadFile = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;
      const { templateId, itemId } = req.params;

      // Проверка наличия файла
      if (!req.file) {
        res.status(400).json({ error: 'No file uploaded' });
        return;
      }

      const result = await this.templatesService.uploadFile(
        templateId,
        itemId,
        userId,
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype
      );

      // Добавляем предупреждение для больших файлов
      const response: { data: typeof result; warning?: string } = { data: result };
      if (result.isLargeFile) {
        response.warning = 'File size exceeds 20 MB. This may affect upload/download speed.';
      }

      res.status(201).json(response);
    } catch (error) {
      if (error instanceof FileValidationError) {
        res.status(400).json({ error: error.message, code: error.code });
        return;
      }
      next(error);
    }
  };

  /**
   * Удаление файла из элемента
   * DELETE /api/templates/:templateId/items/:itemId/file
   */
  deleteFile = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;
      const { templateId, itemId } = req.params;
      await this.templatesService.deleteFile(templateId, itemId, userId);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };

  // ============================================
  // Утилиты
  // ============================================

  /**
   * Валидация текста шаблона
   * POST /api/templates/validate-text
   */
  validateText = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const input = validateTextSchema.parse(req.body);
      const result = this.templatesService.validateTemplateText(input.text);
      res.json({ data: result });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Получение списка доступных переменных
   * GET /api/templates/variables
   */
  getVariables = async (_req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const variables = this.templatesService.getAvailableVariables();
      res.json({ data: variables });
    } catch (error) {
      next(error);
    }
  };
}

