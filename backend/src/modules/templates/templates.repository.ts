/**
 * Repository для работы с шаблонами рассылки в базе данных
 * 
 * Инкапсулирует все операции с БД для модуля templates.
 * Использует Prisma для типобезопасной работы с данными.
 * 
 * @module modules/templates/templates.repository
 */

import {
  PrismaClient,
  Template,
  TemplateCategory,
  TemplateItem,
  TemplateType,
  TemplateItemType,
  FileType,
  MessengerTarget,
  Prisma,
} from '@prisma/client';
import logger from '../../config/logger';

// ============================================
// Типы для работы с репозиторием
// ============================================

export interface CreateCategoryData {
  userId: string;
  name: string;
  description?: string | null;
  color?: string | null;
  orderIndex?: number;
}

export interface UpdateCategoryData {
  name?: string;
  description?: string | null;
  color?: string | null;
  orderIndex?: number;
}

export interface CreateTemplateData {
  userId: string;
  categoryId: string;
  name: string;
  description?: string | null;
  type: TemplateType;
  messengerType: MessengerTarget;
}

export interface UpdateTemplateData {
  name?: string;
  description?: string | null;
  categoryId?: string;
  messengerType?: MessengerTarget;
  isActive?: boolean;
}

export interface CreateTemplateItemData {
  templateId: string;
  orderIndex: number;
  type: TemplateItemType;
  content?: string | null;
  filePath?: string | null;
  fileName?: string | null;
  fileType?: FileType | null;
  fileSize?: number | null;
  fileMimeType?: string | null;
  delayAfterMs?: number;
}

export interface UpdateTemplateItemData {
  content?: string | null;
  filePath?: string | null;
  fileName?: string | null;
  fileType?: FileType | null;
  fileSize?: number | null;
  fileMimeType?: string | null;
  delayAfterMs?: number;
}

export interface ListTemplatesQuery {
  page: number;
  limit: number;
  categoryId?: string;
  type?: TemplateType;
  messengerTarget?: MessengerTarget;
  isActive?: boolean;
  search?: string;
  sortBy: 'createdAt' | 'name' | 'updatedAt';
  sortOrder: 'asc' | 'desc';
}

// ============================================
// Template Category Repository
// ============================================

export class TemplateCategoryRepository {
  constructor(private prisma: PrismaClient) {}

  /**
   * Создание новой категории шаблонов
   */
  async create(data: CreateCategoryData): Promise<TemplateCategory> {
    try {
      const category = await this.prisma.templateCategory.create({
        data: {
          userId: data.userId,
          name: data.name,
          description: data.description ?? null,
          color: data.color ?? null,
          orderIndex: data.orderIndex ?? 0,
        },
      });

      logger.info('Template category created', { categoryId: category.id, userId: data.userId });
      return category;
    } catch (error) {
      logger.error('Failed to create template category', { error, data });
      throw error;
    }
  }

  /**
   * Получение категории по ID
   */
  async findById(categoryId: string): Promise<TemplateCategory | null> {
    try {
      return await this.prisma.templateCategory.findUnique({
        where: { id: categoryId },
      });
    } catch (error) {
      logger.error('Failed to find template category by ID', { error, categoryId });
      throw error;
    }
  }

  /**
   * Получение всех категорий пользователя
   */
  async findByUserId(userId: string): Promise<(TemplateCategory & { _count: { templates: number } })[]> {
    try {
      return await this.prisma.templateCategory.findMany({
        where: { userId },
        orderBy: { orderIndex: 'asc' },
        include: {
          _count: {
            select: { templates: true },
          },
        },
      });
    } catch (error) {
      logger.error('Failed to find template categories by userId', { error, userId });
      throw error;
    }
  }

  /**
   * Обновление категории
   */
  async update(categoryId: string, data: UpdateCategoryData): Promise<TemplateCategory> {
    try {
      const category = await this.prisma.templateCategory.update({
        where: { id: categoryId },
        data: {
          ...(data.name !== undefined && { name: data.name }),
          ...(data.description !== undefined && { description: data.description }),
          ...(data.color !== undefined && { color: data.color }),
          ...(data.orderIndex !== undefined && { orderIndex: data.orderIndex }),
        },
      });

      logger.info('Template category updated', { categoryId });
      return category;
    } catch (error) {
      logger.error('Failed to update template category', { error, categoryId, data });
      throw error;
    }
  }

  /**
   * Удаление категории
   */
  async delete(categoryId: string): Promise<void> {
    try {
      await this.prisma.templateCategory.delete({
        where: { id: categoryId },
      });

      logger.info('Template category deleted', { categoryId });
    } catch (error) {
      logger.error('Failed to delete template category', { error, categoryId });
      throw error;
    }
  }

  /**
   * Проверка существования категории
   */
  async exists(categoryId: string): Promise<boolean> {
    try {
      const count = await this.prisma.templateCategory.count({
        where: { id: categoryId },
      });
      return count > 0;
    } catch (error) {
      logger.error('Failed to check template category existence', { error, categoryId });
      throw error;
    }
  }

  /**
   * Проверка существования категории с указанным именем у пользователя
   */
  async existsByName(userId: string, name: string, excludeId?: string): Promise<boolean> {
    try {
      const count = await this.prisma.templateCategory.count({
        where: {
          userId,
          name,
          ...(excludeId && { NOT: { id: excludeId } }),
        },
      });
      return count > 0;
    } catch (error) {
      logger.error('Failed to check template category existence by name', { error, userId, name });
      throw error;
    }
  }

  /**
   * Подсчет шаблонов в категории
   */
  async countTemplates(categoryId: string): Promise<number> {
    try {
      return await this.prisma.template.count({
        where: { categoryId },
      });
    } catch (error) {
      logger.error('Failed to count templates in category', { error, categoryId });
      throw error;
    }
  }

  /**
   * Получение максимального orderIndex для пользователя
   */
  async getMaxOrderIndex(userId: string): Promise<number> {
    try {
      const result = await this.prisma.templateCategory.aggregate({
        where: { userId },
        _max: { orderIndex: true },
      });
      return result._max.orderIndex ?? -1;
    } catch (error) {
      logger.error('Failed to get max orderIndex for categories', { error, userId });
      throw error;
    }
  }
}

// ============================================
// Template Repository
// ============================================

export class TemplateRepository {
  constructor(private prisma: PrismaClient) {}

  /**
   * Создание нового шаблона
   */
  async create(data: CreateTemplateData): Promise<Template> {
    try {
      const template = await this.prisma.template.create({
        data: {
          userId: data.userId,
          categoryId: data.categoryId,
          name: data.name,
          description: data.description ?? null,
          type: data.type,
          messengerType: data.messengerType,
          isActive: true,
        },
      });

      logger.info('Template created', { templateId: template.id, userId: data.userId });
      return template;
    } catch (error) {
      logger.error('Failed to create template', { error, data });
      throw error;
    }
  }

  /**
   * Получение шаблона по ID
   */
  async findById(templateId: string): Promise<Template | null> {
    try {
      return await this.prisma.template.findUnique({
        where: { id: templateId },
      });
    } catch (error) {
      logger.error('Failed to find template by ID', { error, templateId });
      throw error;
    }
  }

  /**
   * Получение шаблона по ID с элементами
   */
  async findByIdWithItems(templateId: string): Promise<(Template & { items: TemplateItem[]; category: TemplateCategory }) | null> {
    try {
      return await this.prisma.template.findUnique({
        where: { id: templateId },
        include: {
          items: {
            orderBy: { orderIndex: 'asc' },
          },
          category: true,
        },
      });
    } catch (error) {
      logger.error('Failed to find template by ID with items', { error, templateId });
      throw error;
    }
  }

  /**
   * Получение списка шаблонов пользователя с пагинацией и фильтрами
   */
  async findMany(userId: string, query: ListTemplatesQuery) {
    try {
      const { page, limit, categoryId, type, messengerTarget, isActive, search, sortBy, sortOrder } = query;
      const skip = (page - 1) * limit;

      // Построение условий фильтрации
      const where: Prisma.TemplateWhereInput = {
        userId,
        ...(categoryId && { categoryId }),
        ...(type && { type }),
        ...(messengerTarget && { messengerType: messengerTarget }),
        ...(isActive !== undefined && { isActive }),
        ...(search && {
          OR: [
            { name: { contains: search } },
            { description: { contains: search } },
          ],
        }),
      };

      // Построение сортировки
      const orderBy: Prisma.TemplateOrderByWithRelationInput = {};
      orderBy[sortBy] = sortOrder;

      // Получение шаблонов и общего количества
      const [templates, total] = await Promise.all([
        this.prisma.template.findMany({
          where,
          skip,
          take: limit,
          orderBy,
          include: {
            category: {
              select: { id: true, name: true },
            },
            _count: {
              select: { items: true },
            },
          },
        }),
        this.prisma.template.count({ where }),
      ]);

      const totalPages = Math.ceil(total / limit);

      return {
        data: templates,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
        },
      };
    } catch (error) {
      logger.error('Failed to find templates', { error, userId, query });
      throw error;
    }
  }

  /**
   * Обновление шаблона
   */
  async update(templateId: string, data: UpdateTemplateData): Promise<Template> {
    try {
      const template = await this.prisma.template.update({
        where: { id: templateId },
        data: {
          ...(data.name !== undefined && { name: data.name }),
          ...(data.description !== undefined && { description: data.description }),
          ...(data.categoryId !== undefined && { categoryId: data.categoryId }),
          ...(data.messengerType !== undefined && { messengerType: data.messengerType }),
          ...(data.isActive !== undefined && { isActive: data.isActive }),
        },
      });

      logger.info('Template updated', { templateId });
      return template;
    } catch (error) {
      logger.error('Failed to update template', { error, templateId, data });
      throw error;
    }
  }

  /**
   * Удаление шаблона
   */
  async delete(templateId: string): Promise<void> {
    try {
      await this.prisma.template.delete({
        where: { id: templateId },
      });

      logger.info('Template deleted', { templateId });
    } catch (error) {
      logger.error('Failed to delete template', { error, templateId });
      throw error;
    }
  }

  /**
   * Проверка существования шаблона
   */
  async exists(templateId: string): Promise<boolean> {
    try {
      const count = await this.prisma.template.count({
        where: { id: templateId },
      });
      return count > 0;
    } catch (error) {
      logger.error('Failed to check template existence', { error, templateId });
      throw error;
    }
  }

  /**
   * Подсчет шаблонов пользователя
   */
  async countByUserId(userId: string): Promise<number> {
    try {
      return await this.prisma.template.count({
        where: { userId },
      });
    } catch (error) {
      logger.error('Failed to count templates by userId', { error, userId });
      throw error;
    }
  }

  /**
   * Проверка использования шаблона в активных кампаниях
   * Разрешаем удаление, если шаблон используется только в DRAFT кампаниях
   * Запрещаем удаление, если шаблон используется в RUNNING, QUEUED, PAUSED или SCHEDULED кампаниях
   */
  async isUsedInActiveCampaigns(templateId: string): Promise<boolean> {
    try {
      const count = await this.prisma.campaign.count({
        where: {
          templateId,
          status: {
            in: ['SCHEDULED', 'QUEUED', 'RUNNING', 'PAUSED'],
          },
        },
      });
      return count > 0;
    } catch (error) {
      logger.error('Failed to check if template is used in active campaigns', { error, templateId });
      throw error;
    }
  }

  /**
   * Подсчет кампаний по статусу для шаблона
   */
  async countCampaignsByStatus(templateId: string, status: 'DRAFT' | 'SCHEDULED' | 'QUEUED' | 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'CANCELLED' | 'ERROR'): Promise<number> {
    try {
      return await this.prisma.campaign.count({
        where: {
          templateId,
          status,
        },
      });
    } catch (error) {
      logger.error('Failed to count campaigns by status', { error, templateId, status });
      throw error;
    }
  }

  /**
   * Удаление неактивных кампаний, использующих шаблон
   * Удаляются кампании в статусах: DRAFT, COMPLETED, CANCELLED, ERROR
   * Это необходимо перед удалением шаблона, чтобы избежать нарушения внешнего ключа
   */
  async deleteInactiveCampaigns(templateId: string): Promise<number> {
    try {
      // Сначала получаем ID кампаний для логирования
      const inactiveCampaigns = await this.prisma.campaign.findMany({
        where: {
          templateId,
          status: {
            in: ['DRAFT', 'COMPLETED', 'CANCELLED', 'ERROR'],
          },
        },
        select: { id: true, status: true },
      });

      if (inactiveCampaigns.length > 0) {
        // Удаляем неактивные кампании (каскадно удалятся связанные сообщения и логи)
        const result = await this.prisma.campaign.deleteMany({
          where: {
            templateId,
            status: {
              in: ['DRAFT', 'COMPLETED', 'CANCELLED', 'ERROR'],
            },
          },
        });
        
        logger.info('Inactive campaigns deleted', { 
          templateId, 
          deletedCount: result.count,
          campaignIds: inactiveCampaigns.map(c => ({ id: c.id, status: c.status })),
        });
        return result.count;
      }
      
      return 0;
    } catch (error) {
      logger.error('Failed to delete inactive campaigns', { error, templateId });
      throw error;
    }
  }
}

// ============================================
// Template Item Repository
// ============================================

export class TemplateItemRepository {
  constructor(private prisma: PrismaClient) {}

  /**
   * Создание элемента шаблона
   */
  async create(data: CreateTemplateItemData): Promise<TemplateItem> {
    try {
      const item = await this.prisma.templateItem.create({
        data: {
          templateId: data.templateId,
          orderIndex: data.orderIndex,
          type: data.type,
          content: data.content ?? null,
          filePath: data.filePath ?? null,
          fileName: data.fileName ?? null,
          fileType: data.fileType ?? null,
          fileSize: data.fileSize ?? null,
          fileMimeType: data.fileMimeType ?? null,
          delayAfterMs: data.delayAfterMs ?? 0,
        },
      });

      logger.info('Template item created', { itemId: item.id, templateId: data.templateId });
      return item;
    } catch (error) {
      logger.error('Failed to create template item', { error, data });
      throw error;
    }
  }

  /**
   * Получение элемента по ID
   */
  async findById(itemId: string): Promise<TemplateItem | null> {
    try {
      return await this.prisma.templateItem.findUnique({
        where: { id: itemId },
      });
    } catch (error) {
      logger.error('Failed to find template item by ID', { error, itemId });
      throw error;
    }
  }

  /**
   * Получение всех элементов шаблона
   */
  async findByTemplateId(templateId: string): Promise<TemplateItem[]> {
    try {
      return await this.prisma.templateItem.findMany({
        where: { templateId },
        orderBy: { orderIndex: 'asc' },
      });
    } catch (error) {
      logger.error('Failed to find template items by templateId', { error, templateId });
      throw error;
    }
  }

  /**
   * Обновление элемента шаблона
   */
  async update(itemId: string, data: UpdateTemplateItemData): Promise<TemplateItem> {
    try {
      const item = await this.prisma.templateItem.update({
        where: { id: itemId },
        data: {
          ...(data.content !== undefined && { content: data.content }),
          ...(data.filePath !== undefined && { filePath: data.filePath }),
          ...(data.fileName !== undefined && { fileName: data.fileName }),
          ...(data.fileType !== undefined && { fileType: data.fileType }),
          ...(data.fileSize !== undefined && { fileSize: data.fileSize }),
          ...(data.fileMimeType !== undefined && { fileMimeType: data.fileMimeType }),
          ...(data.delayAfterMs !== undefined && { delayAfterMs: data.delayAfterMs }),
        },
      });

      logger.info('Template item updated', { itemId });
      return item;
    } catch (error) {
      logger.error('Failed to update template item', { error, itemId, data });
      throw error;
    }
  }

  /**
   * Удаление элемента шаблона
   */
  async delete(itemId: string): Promise<void> {
    try {
      await this.prisma.templateItem.delete({
        where: { id: itemId },
      });

      logger.info('Template item deleted', { itemId });
    } catch (error) {
      logger.error('Failed to delete template item', { error, itemId });
      throw error;
    }
  }

  /**
   * Подсчет элементов в шаблоне
   */
  async countByTemplateId(templateId: string): Promise<number> {
    try {
      return await this.prisma.templateItem.count({
        where: { templateId },
      });
    } catch (error) {
      logger.error('Failed to count template items', { error, templateId });
      throw error;
    }
  }

  /**
   * Получение максимального orderIndex для шаблона
   */
  async getMaxOrderIndex(templateId: string): Promise<number> {
    try {
      const result = await this.prisma.templateItem.aggregate({
        where: { templateId },
        _max: { orderIndex: true },
      });
      return result._max.orderIndex ?? -1;
    } catch (error) {
      logger.error('Failed to get max orderIndex for template items', { error, templateId });
      throw error;
    }
  }

  /**
   * Обновление порядка элементов шаблона
   */
  async reorderItems(templateId: string, itemOrders: Array<{ id: string; orderIndex: number }>): Promise<void> {
    try {
      // Валидация: проверяем что все элементы принадлежат этому шаблону
      const itemIds = itemOrders.map((item) => item.id);
      const items = await this.prisma.templateItem.findMany({
        where: {
          id: { in: itemIds },
        },
        select: { id: true, templateId: true },
      });

      // Проверяем что все элементы найдены и принадлежат шаблону
      if (items.length !== itemIds.length) {
        throw new Error('Some items not found');
      }

      const invalidItems = items.filter((item) => item.templateId !== templateId);
      if (invalidItems.length > 0) {
        throw new Error('Some items do not belong to this template');
      }

      // Обновляем порядок элементов
      await this.prisma.$transaction(
        itemOrders.map((item) =>
          this.prisma.templateItem.update({
            where: { id: item.id },
            data: { orderIndex: item.orderIndex },
          })
        )
      );

      logger.info('Template items reordered', { templateId, count: itemOrders.length });
    } catch (error) {
      logger.error('Failed to reorder template items', { error, templateId });
      throw error;
    }
  }

  /**
   * Получение всех элементов с файлами для шаблона
   */
  async findFileItemsByTemplateId(templateId: string): Promise<TemplateItem[]> {
    try {
      return await this.prisma.templateItem.findMany({
        where: {
          templateId,
          type: 'FILE',
          filePath: { not: null },
        },
      });
    } catch (error) {
      logger.error('Failed to find file items by templateId', { error, templateId });
      throw error;
    }
  }
}


