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
      throw new Error(`Category with name "${input.name}" already exists`);
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
      throw new Error('Category not found');
    }

    // Проверка владельца
    if (category.userId !== userId) {
      throw new Error('Access denied');
    }

    // Проверка уникальности имени (если меняется)
    if (input.name && input.name !== category.name) {
      const exists = await this.categoryRepository.existsByName(userId, input.name, categoryId);
      if (exists) {
        throw new Error(`Category with name "${input.name}" already exists`);
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
      throw new Error('Category not found');
    }

    // Проверка владельца
    if (category.userId !== userId) {
      throw new Error('Access denied');
    }

    // Проверка на наличие шаблонов
    const templatesCount = await this.categoryRepository.countTemplates(categoryId);
    if (templatesCount > 0) {
      throw new Error(`Cannot delete category with ${templatesCount} template(s). Move or delete templates first.`);
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
      throw new Error('Category not found');
    }

    // Проверка владельца категории
    if (category.userId !== userId) {
      throw new Error('Access denied');
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
      throw new Error('Failed to create template');
    }

    return this.mapTemplateToApi(result);
  }

  /**
   * Маппинг Template из Prisma в формат API (для совместимости с frontend)
   */
  private mapTemplateToApi(template: TemplateWithItems): any {
    return {
      ...template,
      messengerTarget: template.messengerType, // Преобразование для frontend
      items: template.items.map(item => this.mapItemToApi(item)),
    };
  }

  /**
   * Маппинг TemplateItem из Prisma в формат API (для совместимости с frontend)
   */
  private mapItemToApi(item: TemplateItem): any {
    return {
      ...item,
      mimeType: item.fileMimeType, // Преобразование для frontend
      fileUrl: item.filePath ? `/uploads/templates/${item.filePath}` : null, // Добавление URL
    };
  }

  /**
   * Маппинг списка шаблонов
   */
  private mapTemplatesToApi(templates: any[]): any[] {
    return templates.map(t => ({
      ...t,
      messengerTarget: t.messengerType,
      items: t.items ? t.items.map((item: TemplateItem) => this.mapItemToApi(item)) : undefined,
    }));
  }

  /**
   * Получение шаблона по ID
   */
  async getTemplate(templateId: string): Promise<any | null> {
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
  async updateTemplate(templateId: string, userId: string, input: UpdateTemplateInput): Promise<Template> {
    // Проверка существования
    const template = await this.templateRepository.findById(templateId);
    if (!template) {
      throw new Error('Template not found');
    }

    // Проверка владельца
    if (template.userId !== userId) {
      throw new Error('Access denied');
    }

    // Если меняется категория, проверяем её
    if (input.categoryId && input.categoryId !== template.categoryId) {
      const category = await this.categoryRepository.findById(input.categoryId);
      if (!category) {
        throw new Error('Category not found');
      }
      if (category.userId !== userId) {
        throw new Error('Access denied to target category');
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
      throw new Error('Failed to update template');
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
      throw new Error('Template not found');
    }

    // Проверка владельца
    if (template.userId !== userId) {
      throw new Error('Access denied');
    }

    // Проверка использования в активных кампаниях
    const isUsed = await this.templateRepository.isUsedInActiveCampaigns(templateId);
    if (isUsed) {
      throw new Error('Cannot delete template that is used in active campaigns');
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
  async duplicateTemplate(templateId: string, userId: string, newName?: string): Promise<TemplateWithItems> {
    // Получение исходного шаблона
    const source = await this.templateRepository.findByIdWithItems(templateId);
    if (!source) {
      throw new Error('Template not found');
    }

    // Проверка владельца
    if (source.userId !== userId) {
      throw new Error('Access denied');
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
    for (const item of source.items) {
      let newFilePath: string | null = null;

      // Копирование файла, если есть
      if (item.type === 'FILE' && item.filePath && item.fileName) {
        newFilePath = await this.fileStorage.copyFile(
          item.filePath,
          userId,
          newTemplate.id,
          item.fileName
        );
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

    const result = await this.templateRepository.findByIdWithItems(newTemplate.id);
    if (!result) {
      throw new Error('Failed to duplicate template');
    }

    logger.info('Template duplicated', { sourceId: templateId, newId: newTemplate.id });
    return this.mapTemplateToApi(result);
  }

  /**
   * Перемещение шаблона в другую категорию
   */
  async moveTemplate(templateId: string, userId: string, categoryId: string): Promise<any> {
    return this.updateTemplate(templateId, userId, { categoryId });
  }

  // ============================================
  // Методы для элементов шаблона
  // ============================================

  /**
   * Добавление элемента в шаблон
   */
  async addItem(templateId: string, userId: string, input: CreateItemInput): Promise<TemplateItem> {
    // Проверка шаблона
    const template = await this.templateRepository.findById(templateId);
    if (!template) {
      throw new Error('Template not found');
    }

    // Проверка владельца
    if (template.userId !== userId) {
      throw new Error('Access denied');
    }

    // Проверка типа шаблона
    if (template.type === 'SINGLE') {
      const itemsCount = await this.itemRepository.countByTemplateId(templateId);
      if (itemsCount >= 1) {
        throw new Error('Single template can only have one item');
      }
    }

    // Проверка лимита элементов (50)
    const itemsCount = await this.itemRepository.countByTemplateId(templateId);
    if (itemsCount >= 50) {
      throw new Error('Maximum number of items (50) reached');
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
  async updateItem(itemId: string, userId: string, input: UpdateItemInput): Promise<any> {
    // Проверка элемента
    const item = await this.itemRepository.findById(itemId);
    if (!item) {
      throw new Error('Item not found');
    }

    // Проверка владельца через шаблон
    const template = await this.templateRepository.findById(item.templateId);
    if (!template || template.userId !== userId) {
      throw new Error('Access denied');
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
      throw new Error('Item not found');
    }

    // Проверка владельца через шаблон
    const template = await this.templateRepository.findById(item.templateId);
    if (!template || template.userId !== userId) {
      throw new Error('Access denied');
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
      throw new Error('Template not found');
    }

    // Проверка владельца
    if (template.userId !== userId) {
      throw new Error('Access denied');
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
      throw new Error('Item not found');
    }

    // Проверка что элемент принадлежит шаблону
    if (item.templateId !== templateId) {
      throw new Error('Item does not belong to this template');
    }

    // Проверка владельца через шаблон
    const template = await this.templateRepository.findById(templateId);
    if (!template || template.userId !== userId) {
      throw new Error('Access denied');
    }

    // Проверка типа элемента
    if (item.type !== 'FILE') {
      throw new Error('Item type must be FILE');
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
      throw new Error('Item not found');
    }

    // Проверка что элемент принадлежит шаблону
    if (item.templateId !== templateId) {
      throw new Error('Item does not belong to this template');
    }

    // Проверка владельца через шаблон
    const template = await this.templateRepository.findById(templateId);
    if (!template || template.userId !== userId) {
      throw new Error('Access denied');
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
      throw new Error('Template not found');
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


