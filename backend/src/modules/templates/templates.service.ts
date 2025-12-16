/**
 * Сервис для работы с шаблонами рассылки
 * 
 * Бизнес-логика модуля шаблонов:
 * - CRUD операции для категорий и шаблонов
 * - Управление элементами шаблонов
 * - Загрузка и удаление файлов
 * - Дублирование шаблонов
 * - Превью с подстановкой переменных
 * 
 * @module modules/templates/templates.service
 */

import { PrismaClient, TemplateType, MessengerTarget, TemplateItemType, Template, TemplateCategory, TemplateItem, FileType } from '@prisma/client';
import {
  TemplateCategoryRepository,
  TemplateRepository,
  TemplateItemRepository,
  CreateCategoryData,
  UpdateCategoryData,
  CreateTemplateData,
  UpdateTemplateData,
  CreateTemplateItemData,
  UpdateTemplateItemData,
  ListTemplatesQuery,
} from './templates.repository';
import { FileStorageService, UploadResult } from './file-storage';
import { VariableParserService, ClientData, ValidationResult } from './variable-parser.service';
import { HttpError } from '../../utils/http-error';
import logger from '../../config/logger';

// ============================================
// Типы для сервиса
// ============================================

export interface CreateCategoryInput {
  name: string;
  description?: string | null;
  color?: string | null;
}

export interface UpdateCategoryInput {
  name?: string;
  description?: string | null;
  color?: string | null;
  orderIndex?: number;
}

export interface CreateTemplateInput {
  categoryId: string;
  name: string;
  description?: string | null;
  type: TemplateType;
  messengerTarget: MessengerTarget;
  // Для SINGLE шаблона - можно сразу передать контент
  content?: string;
}

export interface UpdateTemplateInput {
  name?: string;
  description?: string | null;
  categoryId?: string;
  messengerTarget?: MessengerTarget;
  isActive?: boolean;
}

export interface CreateItemInput {
  type: TemplateItemType;
  content?: string;
  delayAfterMs?: number;
}

export interface UpdateItemInput {
  content?: string;
  delayAfterMs?: number;
}

export interface PreviewTemplateInput {
  templateId: string;
  clientData?: ClientData;
}

export interface TemplateWithItems extends Template {
  items: TemplateItem[];
  category: TemplateCategory;
}

// ============================================
// Сервис
// ============================================

export class TemplatesService {
  private categoryRepository: TemplateCategoryRepository;
  private templateRepository: TemplateRepository;
  private itemRepository: TemplateItemRepository;
  private fileStorage: FileStorageService;
  private variableParser: VariableParserService;

  constructor(
    prisma: PrismaClient,
    fileStorage?: FileStorageService
  ) {
    this.categoryRepository = new TemplateCategoryRepository(prisma);
    this.templateRepository = new TemplateRepository(prisma);
    this.itemRepository = new TemplateItemRepository(prisma);
    this.fileStorage = fileStorage ?? new FileStorageService();
    this.variableParser = new VariableParserService();
  }

  /**
   * Инициализация сервиса (создание директорий для файлов)
   */
  async initialize(): Promise<void> {
    await this.fileStorage.initialize();
    logger.info('Templates service initialized');
  }

  // ============================================
  // Методы для категорий
  // ============================================

  /**
   * Создание категории
   */
  async createCategory(userId: string, input: CreateCategoryInput): Promise<TemplateCategory> {
    // Проверка уникальности имени
    const exists = await this.categoryRepository.existsByName(userId, input.name);
    if (exists) {
      throw new HttpError(`Category with name "${input.name}" already exists`, 409, 'CATEGORY_NAME_EXISTS');
    }

    // Получение следующего orderIndex
    const maxIndex = await this.categoryRepository.getMaxOrderIndex(userId);

    const data: CreateCategoryData = {
      userId,
      name: input.name,
      description: input.description,
      color: input.color ?? null,
      orderIndex: maxIndex + 1,
    };

    return this.categoryRepository.create(data);
  }

  /**
   * Получение категории по ID
   */
  async getCategory(categoryId: string): Promise<TemplateCategory | null> {
    return this.categoryRepository.findById(categoryId);
  }

  /**
   * Получение всех категорий пользователя
   */
  async listCategories(userId: string): Promise<(TemplateCategory & { _count: { templates: number } })[]> {
    return this.categoryRepository.findByUserId(userId);
  }

  /**
   * Обновление категории
   */
  async updateCategory(categoryId: string, userId: string, input: UpdateCategoryInput): Promise<TemplateCategory> {
    // Проверка существования
    const category = await this.categoryRepository.findById(categoryId);
    if (!category) {
      throw new HttpError('Category not found', 404, 'CATEGORY_NOT_FOUND');
    }

    // Проверка владельца
    if (category.userId !== userId) {
      throw new HttpError('Access denied', 403, 'ACCESS_DENIED');
    }

    // Проверка уникальности имени (если меняется)
    if (input.name && input.name !== category.name) {
      const exists = await this.categoryRepository.existsByName(userId, input.name, categoryId);
      if (exists) {
        throw new HttpError(`Category with name "${input.name}" already exists`, 409, 'CATEGORY_NAME_EXISTS');
      }
    }

    const data: UpdateCategoryData = {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.color !== undefined && { color: input.color }),
      ...(input.orderIndex !== undefined && { orderIndex: input.orderIndex }),
    };

    return this.categoryRepository.update(categoryId, data);
  }

  /**
   * Удаление категории
   */
  async deleteCategory(categoryId: string, userId: string): Promise<void> {
    // Проверка существования
    const category = await this.categoryRepository.findById(categoryId);
    if (!category) {
      throw new HttpError('Category not found', 404, 'CATEGORY_NOT_FOUND');
    }

    // Проверка владельца
    if (category.userId !== userId) {
      throw new HttpError('Access denied', 403, 'ACCESS_DENIED');
    }

    // Проверка на наличие шаблонов
    const templatesCount = await this.categoryRepository.countTemplates(categoryId);
    if (templatesCount > 0) {
      throw new HttpError(`Cannot delete category with ${templatesCount} template(s). Move or delete templates first.`, 409, 'CATEGORY_HAS_TEMPLATES');
    }

    await this.categoryRepository.delete(categoryId);
  }

  // ============================================
  // Методы для шаблонов
  // ============================================

  /**
   * Создание шаблона
   */
  async createTemplate(userId: string, input: CreateTemplateInput): Promise<TemplateWithItems> {
    // Проверка существования категории
    const category = await this.categoryRepository.findById(input.categoryId);
    if (!category) {
      throw new HttpError('Category not found', 404, 'CATEGORY_NOT_FOUND');
    }

    // Проверка владельца категории
    if (category.userId !== userId) {
      throw new HttpError('Access denied', 403, 'ACCESS_DENIED');
    }

    const data: CreateTemplateData = {
      userId,
      categoryId: input.categoryId,
      name: input.name,
      description: input.description,
      type: input.type,
      messengerType: input.messengerTarget,
    };

    const template = await this.templateRepository.create(data);

    // Для SINGLE шаблона создаем один элемент с текстом
    if (input.type === 'SINGLE' && input.content) {
      const itemData: CreateTemplateItemData = {
        templateId: template.id,
        orderIndex: 0,
        type: 'TEXT',
        content: input.content,
      };
      await this.itemRepository.create(itemData);
    }

    // Возвращаем шаблон с элементами
    const result = await this.templateRepository.findByIdWithItems(template.id);
    if (!result) {
      throw new HttpError('Failed to create template', 500, 'TEMPLATE_CREATE_ERROR');
    }

    return this.mapTemplateToApi(result);
  }

  // ============================================
  // Типы для API ответов
  // ============================================

  interface TemplateApiResponse {
    id: string;
    userId: string;
    categoryId: string;
    name: string;
    description: string | null;
    type: TemplateType;
    messengerTarget: MessengerTarget;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
    category?: TemplateCategory | null;
    items: TemplateItemApiResponse[];
    _count?: {
      items: number;
    };
  }

  interface TemplateItemApiResponse {
    id: string;
    templateId: string;
    orderIndex: number;
    type: TemplateItemType;
    content: string | null;
    fileName: string | null;
    filePath: string | null;
    fileUrl: string | null;
    fileSize: number | null;
    mimeType: string | null;
    fileType: FileType | null;
    delayAfterMs: number;
    createdAt: Date;
    updatedAt: Date;
  }

  interface TemplateListItemApiResponse {
    id: string;
    userId: string;
    categoryId: string;
    name: string;
    description: string | null;
    type: TemplateType;
    messengerTarget: MessengerTarget;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
    category?: {
      id: string;
      name: string;
    } | null;
    _count?: {
      items: number;
    };
  }

  /**
   * Маппинг Template из Prisma в формат API (для совместимости с frontend)
   */
  private mapTemplateToApi(template: TemplateWithItems): TemplateApiResponse {
    return {
      id: template.id,
      userId: template.userId,
      categoryId: template.categoryId,
      name: template.name,
      description: template.description,
      type: template.type,
      messengerTarget: template.messengerType, // Преобразование для frontend
      isActive: template.isActive,
      createdAt: template.createdAt,
      updatedAt: template.updatedAt,
      category: template.category,
      items: template.items.map(item => this.mapItemToApi(item)),
      _count: template._count,
    };
  }

  /**
   * Маппинг TemplateItem из Prisma в формат API (для совместимости с frontend)
   */
  private mapItemToApi(item: TemplateItem): TemplateItemApiResponse {
    return {
      id: item.id,
      templateId: item.templateId,
      orderIndex: item.orderIndex,
      type: item.type,
      content: item.content,
      fileName: item.fileName,
      filePath: item.filePath,
      fileUrl: item.filePath ? `/uploads/templates/${item.filePath}` : null, // Добавление URL
      fileSize: item.fileSize,
      mimeType: item.fileMimeType, // Преобразование для frontend (fileMimeType -> mimeType)
      fileType: item.fileType,
      delayAfterMs: item.delayAfterMs,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    };
  }

  /**
   * Маппинг списка шаблонов
   */
  private mapTemplatesToApi(
    templates: Array<Template & { category?: { id: string; name: string } | null; _count?: { items: number } }>
  ): TemplateListItemApiResponse[] {
    return templates.map(t => ({
      id: t.id,
      userId: t.userId,
      categoryId: t.categoryId,
      name: t.name,
      description: t.description,
      type: t.type,
      messengerTarget: t.messengerType, // Преобразование для frontend
      isActive: t.isActive,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
      category: t.category,
      _count: t._count,
      // items не включаем в список для оптимизации
    }));
  }

  /**
   * Получение шаблона по ID
   */
  async getTemplate(templateId: string): Promise<TemplateApiResponse | null> {
    const result = await this.templateRepository.findByIdWithItems(templateId);
    if (!result) {
      return null;
    }
    return this.mapTemplateToApi(result);
  }

  /**
   * Получение списка шаблонов
   */
  async listTemplates(userId: string, query: ListTemplatesQuery) {
    const result = await this.templateRepository.findMany(userId, query);
    return {
      ...result,
      data: this.mapTemplatesToApi(result.data),
    };
  }

  /**
   * Обновление шаблона
   */
  async updateTemplate(templateId: string, userId: string, input: UpdateTemplateInput): Promise<TemplateApiResponse> {
    // Проверка существования
    const template = await this.templateRepository.findById(templateId);
    if (!template) {
      throw new HttpError('Template not found', 404, 'TEMPLATE_NOT_FOUND');
    }

    // Проверка владельца
    if (template.userId !== userId) {
      throw new HttpError('Access denied', 403, 'ACCESS_DENIED');
    }

    // Если меняется категория, проверяем её
    if (input.categoryId && input.categoryId !== template.categoryId) {
      const category = await this.categoryRepository.findById(input.categoryId);
      if (!category) {
        throw new HttpError('Category not found', 404, 'CATEGORY_NOT_FOUND');
      }
      if (category.userId !== userId) {
        throw new HttpError('Access denied to target category', 403, 'ACCESS_DENIED');
      }
    }

    const data: UpdateTemplateData = {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.categoryId !== undefined && { categoryId: input.categoryId }),
      ...(input.messengerTarget !== undefined && { messengerType: input.messengerTarget }),
      ...(input.isActive !== undefined && { isActive: input.isActive }),
    };

    await this.templateRepository.update(templateId, data);
    const result = await this.templateRepository.findByIdWithItems(templateId);
    if (!result) {
      throw new HttpError('Failed to update template', 500, 'TEMPLATE_UPDATE_ERROR');
    }
    return this.mapTemplateToApi(result);
  }

  /**
   * Удаление шаблона
   */
  async deleteTemplate(templateId: string, userId: string): Promise<void> {
    // Проверка существования
    const template = await this.templateRepository.findByIdWithItems(templateId);
    if (!template) {
      throw new HttpError('Template not found', 404, 'TEMPLATE_NOT_FOUND');
    }

    // Проверка владельца
    if (template.userId !== userId) {
      throw new HttpError('Access denied', 403, 'ACCESS_DENIED');
    }

    // Проверка использования в активных кампаниях (RUNNING, QUEUED, PAUSED, SCHEDULED)
    const isUsed = await this.templateRepository.isUsedInActiveCampaigns(templateId);
    if (isUsed) {
      throw new HttpError('Невозможно удалить шаблон, который используется в активных кампаниях (запущенных, запланированных или на паузе). Завершите или удалите эти кампании сначала.', 409, 'TEMPLATE_IN_USE');
    }
    
    // Удаление неактивных кампаний, использующих шаблон
    // Это необходимо, так как templateId не может быть null из-за ограничения внешнего ключа
    // Удаляем кампании в статусах: DRAFT, COMPLETED, CANCELLED, ERROR
    const inactiveStatuses = ['DRAFT', 'COMPLETED', 'CANCELLED', 'ERROR'];
    let totalInactiveCount = 0;
    
    for (const status of inactiveStatuses) {
      const count = await this.templateRepository.countCampaignsByStatus(templateId, status);
      totalInactiveCount += count;
    }
    
    if (totalInactiveCount > 0) {
      logger.warn('Template is used in inactive campaigns, deleting them', { 
        templateId, 
        totalInactiveCount 
      });
      
      // Удаляем неактивные кампании перед удалением шаблона
      await this.templateRepository.deleteInactiveCampaigns(templateId);
    }

    // Удаление файлов шаблона
    await this.fileStorage.deleteTemplateFiles(userId, templateId);

    // Удаление шаблона (элементы удалятся каскадно)
    await this.templateRepository.delete(templateId);

    logger.info('Template deleted with files', { templateId, userId });
  }

  /**
   * Дублирование шаблона
   */
  async duplicateTemplate(templateId: string, userId: string, newName?: string): Promise<TemplateApiResponse> {
    // Получение исходного шаблона
    const source = await this.templateRepository.findByIdWithItems(templateId);
    if (!source) {
      throw new HttpError('Template not found', 404, 'TEMPLATE_NOT_FOUND');
    }

    // Проверка владельца
    if (source.userId !== userId) {
      throw new HttpError('Access denied', 403, 'ACCESS_DENIED');
    }

    // Создание нового шаблона
    const data: CreateTemplateData = {
      userId,
      categoryId: source.categoryId,
      name: newName ?? `${source.name} (копия)`,
      description: source.description,
      type: source.type,
      messengerType: source.messengerType,
    };

    const newTemplate = await this.templateRepository.create(data);

    // Копирование элементов
    try {
      for (const item of source.items) {
        let newFilePath: string | null = null;

        // Копирование файла, если есть
        if (item.type === 'FILE' && item.filePath && item.fileName) {
          try {
            newFilePath = await this.fileStorage.copyFile(
              item.filePath,
              userId,
              newTemplate.id,
              item.fileName
            );
          } catch (error) {
            // Если файл не найден, логируем предупреждение и продолжаем без файла
            logger.warn('Failed to copy file during template duplication', {
              filePath: item.filePath,
              templateId: templateId,
              newTemplateId: newTemplate.id,
              error,
            });
            // Продолжаем создание элемента без файла
          }
        }

        const itemData: CreateTemplateItemData = {
          templateId: newTemplate.id,
          orderIndex: item.orderIndex,
          type: item.type,
          content: item.content,
          filePath: newFilePath,
          fileName: item.fileName,
          fileType: item.fileType,
          fileSize: item.fileSize,
          fileMimeType: item.fileMimeType,
          delayAfterMs: item.delayAfterMs,
        };

        await this.itemRepository.create(itemData);
      }
    } catch (error) {
      // Если не удалось создать элементы, удаляем созданный шаблон
      try {
        await this.templateRepository.delete(newTemplate.id);
        await this.fileStorage.deleteTemplateFiles(userId, newTemplate.id);
      } catch (deleteError) {
        logger.error('Failed to cleanup template after duplication error', {
          templateId: newTemplate.id,
          error: deleteError,
        });
      }
      throw new HttpError('Failed to duplicate template items', 500, 'TEMPLATE_DUPLICATE_ERROR');
    }

    const result = await this.templateRepository.findByIdWithItems(newTemplate.id);
    if (!result) {
      throw new HttpError('Failed to duplicate template', 500, 'TEMPLATE_DUPLICATE_ERROR');
    }

    logger.info('Template duplicated', { sourceId: templateId, newId: newTemplate.id });
    return this.mapTemplateToApi(result);
  }

  /**
   * Перемещение шаблона в другую категорию
   */
  async moveTemplate(templateId: string, userId: string, categoryId: string): Promise<TemplateApiResponse> {
    return this.updateTemplate(templateId, userId, { categoryId });
  }

  // ============================================
  // Методы для элементов шаблона
  // ============================================

  /**
   * Добавление элемента в шаблон
   */
  async addItem(templateId: string, userId: string, input: CreateItemInput): Promise<TemplateItemApiResponse> {
    // Проверка шаблона
    const template = await this.templateRepository.findById(templateId);
    if (!template) {
      throw new HttpError('Template not found', 404, 'TEMPLATE_NOT_FOUND');
    }

    // Проверка владельца
    if (template.userId !== userId) {
      throw new HttpError('Access denied', 403, 'ACCESS_DENIED');
    }

    // Проверка типа шаблона
    if (template.type === 'SINGLE') {
      const itemsCount = await this.itemRepository.countByTemplateId(templateId);
      if (itemsCount >= 1) {
        throw new HttpError('Single template can only have one item', 400, 'SINGLE_TEMPLATE_LIMIT');
      }
    }

    // Проверка лимита элементов (50)
    const itemsCount = await this.itemRepository.countByTemplateId(templateId);
    if (itemsCount >= 50) {
      throw new HttpError('Maximum number of items (50) reached', 400, 'MAX_ITEMS_REACHED');
    }

    // Получение следующего orderIndex
    const maxIndex = await this.itemRepository.getMaxOrderIndex(templateId);

    const data: CreateTemplateItemData = {
      templateId,
      orderIndex: maxIndex + 1,
      type: input.type,
      content: input.content ?? null,
      delayAfterMs: input.delayAfterMs ?? 0,
    };

    const item = await this.itemRepository.create(data);
    return this.mapItemToApi(item);
  }

  /**
   * Обновление элемента шаблона
   */
  async updateItem(itemId: string, userId: string, input: UpdateItemInput): Promise<TemplateItemApiResponse> {
    // Проверка элемента
    const item = await this.itemRepository.findById(itemId);
    if (!item) {
      throw new HttpError('Item not found', 404, 'ITEM_NOT_FOUND');
    }

    // Проверка владельца через шаблон
    const template = await this.templateRepository.findById(item.templateId);
    if (!template || template.userId !== userId) {
      throw new HttpError('Access denied', 403, 'ACCESS_DENIED');
    }

    // Валидация: content можно обновлять только для TEXT элементов
    if (input.content !== undefined && item.type !== 'TEXT') {
      throw new HttpError('Content can only be updated for TEXT items', 400, 'INVALID_ITEM_TYPE');
    }

    const data: UpdateTemplateItemData = {
      ...(input.content !== undefined && { content: input.content }),
      ...(input.delayAfterMs !== undefined && { delayAfterMs: input.delayAfterMs }),
    };

    const updated = await this.itemRepository.update(itemId, data);
    return this.mapItemToApi(updated);
  }

  /**
   * Удаление элемента шаблона
   */
  async deleteItem(itemId: string, userId: string): Promise<void> {
    // Проверка элемента
    const item = await this.itemRepository.findById(itemId);
    if (!item) {
      throw new HttpError('Item not found', 404, 'ITEM_NOT_FOUND');
    }

    // Проверка владельца через шаблон
    const template = await this.templateRepository.findById(item.templateId);
    if (!template || template.userId !== userId) {
      throw new HttpError('Access denied', 403, 'ACCESS_DENIED');
    }

    // Удаление файла, если есть
    if (item.filePath) {
      await this.fileStorage.deleteFile(item.filePath);
    }

    await this.itemRepository.delete(itemId);
  }

  /**
   * Изменение порядка элементов шаблона
   */
  async reorderItems(templateId: string, userId: string, itemOrders: Array<{ id: string; orderIndex: number }>): Promise<void> {
    // Проверка шаблона
    const template = await this.templateRepository.findById(templateId);
    if (!template) {
      throw new HttpError('Template not found', 404, 'TEMPLATE_NOT_FOUND');
    }

    // Проверка владельца
    if (template.userId !== userId) {
      throw new HttpError('Access denied', 403, 'ACCESS_DENIED');
    }

    await this.itemRepository.reorderItems(templateId, itemOrders);
  }

  // ============================================
  // Методы для файлов
  // ============================================

  /**
   * Загрузка файла для элемента шаблона
   */
  async uploadFile(
    templateId: string,
    itemId: string,
    userId: string,
    file: Buffer,
    originalName: string,
    mimeType: string
  ): Promise<UploadResult> {
    // Проверка элемента
    const item = await this.itemRepository.findById(itemId);
    if (!item) {
      throw new HttpError('Item not found', 404, 'ITEM_NOT_FOUND');
    }

    // Проверка что элемент принадлежит шаблону
    if (item.templateId !== templateId) {
      throw new HttpError('Item does not belong to this template', 400, 'ITEM_TEMPLATE_MISMATCH');
    }

    // Проверка владельца через шаблон
    const template = await this.templateRepository.findById(templateId);
    if (!template || template.userId !== userId) {
      throw new HttpError('Access denied', 403, 'ACCESS_DENIED');
    }

    // Проверка типа элемента
    if (item.type !== 'FILE') {
      throw new HttpError('Item type must be FILE', 400, 'INVALID_ITEM_TYPE');
    }

    // Удаление старого файла, если есть
    if (item.filePath) {
      await this.fileStorage.deleteFile(item.filePath);
    }

    // Загрузка нового файла
    const result = await this.fileStorage.uploadFile(userId, templateId, file, originalName, mimeType);

    // Обновление элемента
    await this.itemRepository.update(itemId, {
      filePath: result.filePath,
      fileName: result.fileName,
      fileType: result.fileType,
      fileSize: result.fileSize,
      fileMimeType: result.fileMimeType,
    });

    return result;
  }

  /**
   * Удаление файла из элемента шаблона
   */
  async deleteFile(templateId: string, itemId: string, userId: string): Promise<void> {
    // Проверка элемента
    const item = await this.itemRepository.findById(itemId);
    if (!item) {
      throw new HttpError('Item not found', 404, 'ITEM_NOT_FOUND');
    }

    // Проверка что элемент принадлежит шаблону
    if (item.templateId !== templateId) {
      throw new HttpError('Item does not belong to this template', 400, 'ITEM_TEMPLATE_MISMATCH');
    }

    // Проверка владельца через шаблон
    const template = await this.templateRepository.findById(templateId);
    if (!template || template.userId !== userId) {
      throw new HttpError('Access denied', 403, 'ACCESS_DENIED');
    }

    // Проверка типа элемента
    if (item.type !== 'FILE') {
      throw new HttpError('Item type must be FILE', 400, 'INVALID_ITEM_TYPE');
    }

    // Удаление файла
    if (item.filePath) {
      await this.fileStorage.deleteFile(item.filePath);
    }

    // Очистка данных о файле в элементе
    await this.itemRepository.update(itemId, {
      filePath: null,
      fileName: null,
      fileType: null,
      fileSize: null,
      fileMimeType: null,
    });
  }

  // ============================================
  // Методы для превью и валидации
  // ============================================

  /**
   * Превью шаблона с подстановкой переменных
   */
  async previewTemplate(input: PreviewTemplateInput): Promise<{
    items: Array<{
      orderIndex: number;
      type: TemplateItemType;
      content: string | null;
      fileUrl: string | null;
      fileName: string | null;
      fileType: FileType | null;
      mimeType: string | null;
    }>;
    variables: string[];
    usedVariables: string[];
  }> {
    const template = await this.templateRepository.findByIdWithItems(input.templateId);
    if (!template) {
      throw new HttpError('Template not found', 404, 'TEMPLATE_NOT_FOUND');
    }

    const usedVariables = new Set<string>();

    const items = template.items.map((item) => {
      if (item.content) {
        const parseResult = this.variableParser.parseVariables(item.content);
        parseResult.variables.forEach((v) => usedVariables.add(v));
      }

      return {
        orderIndex: item.orderIndex,
        type: item.type,
        content: item.content ? this.variableParser.previewTemplate(item.content, input.clientData) : null,
        fileUrl: item.filePath ? `/uploads/templates/${item.filePath}` : null,
        fileName: item.fileName ?? null,
        fileType: item.fileType ?? null,
        mimeType: item.fileMimeType ?? null,
      };
    });

    return {
      items,
      variables: this.variableParser.getAvailableVariables().map((v) => v.name),
      usedVariables: Array.from(usedVariables),
    };
  }

  /**
   * Валидация текста на использование переменных
   */
  validateTemplateText(text: string): ValidationResult {
    return this.variableParser.validateTemplate(text);
  }

  /**
   * Получение списка доступных переменных
   */
  getAvailableVariables() {
    return this.variableParser.getAvailableVariables();
  }

  // ============================================
  // Вспомогательные методы
  // ============================================

  /**
   * Подсчет шаблонов пользователя
   */
  async countUserTemplates(userId: string): Promise<number> {
    return this.templateRepository.countByUserId(userId);
  }

  /**
   * Получение FileStorageService для внешнего использования (например, для static serving)
   */
  getFileStorage(): FileStorageService {
    return this.fileStorage;
  }
}


