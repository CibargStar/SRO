/**
 * Zod схемы для валидации запросов модуля шаблонов
 * 
 * @module modules/templates/templates.schemas
 */

import { z } from 'zod';

// ============================================
// Enums
// ============================================

export const templateTypeEnum = z.enum(['SINGLE', 'MULTI']);
export const templateItemTypeEnum = z.enum(['TEXT', 'FILE']);
export const messengerTargetEnum = z.enum(['WHATSAPP_ONLY', 'TELEGRAM_ONLY', 'UNIVERSAL']);

// ============================================
// Category Schemas
// ============================================

/**
 * Схема создания категории
 */
export const createCategorySchema = z.object({
  name: z.string()
    .min(1, 'Name is required')
    .max(100, 'Name must be at most 100 characters'),
  description: z.string()
    .max(500, 'Description must be at most 500 characters')
    .nullable()
    .optional(),
  color: z.string()
    .max(50, 'Color must be at most 50 characters')
    .nullable()
    .optional(),
});

export type CreateCategorySchema = z.infer<typeof createCategorySchema>;

/**
 * Схема обновления категории
 */
export const updateCategorySchema = z.object({
  name: z.string()
    .min(1, 'Name is required')
    .max(100, 'Name must be at most 100 characters')
    .optional(),
  description: z.string()
    .max(500, 'Description must be at most 500 characters')
    .nullable()
    .optional(),
  color: z.string()
    .max(50, 'Color must be at most 50 characters')
    .nullable()
    .optional(),
  orderIndex: z.number()
    .int()
    .min(0)
    .optional(),
});

export type UpdateCategorySchema = z.infer<typeof updateCategorySchema>;

// ============================================
// Template Schemas
// ============================================

/**
 * Схема создания шаблона
 */
export const createTemplateSchema = z.object({
  categoryId: z.string().uuid('Invalid category ID'),
  name: z.string()
    .min(1, 'Name is required')
    .max(200, 'Name must be at most 200 characters'),
  description: z.string()
    .max(1000, 'Description must be at most 1000 characters')
    .nullable()
    .optional(),
  type: templateTypeEnum,
  messengerTarget: messengerTargetEnum,
  // Для SINGLE шаблона - опциональный контент
  content: z.string()
    .max(10000, 'Content must be at most 10000 characters')
    .optional(),
});

export type CreateTemplateSchema = z.infer<typeof createTemplateSchema>;

/**
 * Схема обновления шаблона
 */
export const updateTemplateSchema = z.object({
  name: z.string()
    .min(1, 'Name is required')
    .max(200, 'Name must be at most 200 characters')
    .optional(),
  description: z.string()
    .max(1000, 'Description must be at most 1000 characters')
    .nullable()
    .optional(),
  categoryId: z.string().uuid('Invalid category ID').optional(),
  messengerTarget: messengerTargetEnum.optional(),
  isActive: z.boolean().optional(),
});

export type UpdateTemplateSchema = z.infer<typeof updateTemplateSchema>;

/**
 * Схема дублирования шаблона
 */
export const duplicateTemplateSchema = z.object({
  name: z.string()
    .min(1, 'Name is required')
    .max(200, 'Name must be at most 200 characters')
    .optional(),
});

export type DuplicateTemplateSchema = z.infer<typeof duplicateTemplateSchema>;

/**
 * Схема перемещения шаблона
 */
export const moveTemplateSchema = z.object({
  categoryId: z.string().uuid('Invalid category ID'),
});

export type MoveTemplateSchema = z.infer<typeof moveTemplateSchema>;

// ============================================
// Template Item Schemas
// ============================================

/**
 * Схема создания элемента шаблона
 */
export const createTemplateItemSchema = z.object({
  type: templateItemTypeEnum,
  content: z.string()
    .max(10000, 'Content must be at most 10000 characters')
    .optional(),
  delayAfterMs: z.number()
    .int()
    .min(0, 'Delay must be at least 0')
    .max(60000, 'Delay must be at most 60000 ms (1 minute)')
    .optional(),
});

export type CreateTemplateItemSchema = z.infer<typeof createTemplateItemSchema>;

/**
 * Схема обновления элемента шаблона
 */
export const updateTemplateItemSchema = z.object({
  content: z.string()
    .max(10000, 'Content must be at most 10000 characters')
    .optional(),
  delayAfterMs: z.number()
    .int()
    .min(0, 'Delay must be at least 0')
    .max(60000, 'Delay must be at most 60000 ms (1 minute)')
    .optional(),
});

export type UpdateTemplateItemSchema = z.infer<typeof updateTemplateItemSchema>;

/**
 * Схема изменения порядка элементов
 */
export const reorderItemsSchema = z.object({
  items: z.array(z.object({
    id: z.string().uuid('Invalid item ID'),
    orderIndex: z.number().int().min(0),
  })).min(1, 'At least one item is required'),
});

export type ReorderItemsSchema = z.infer<typeof reorderItemsSchema>;

// ============================================
// Query Schemas
// ============================================

/**
 * Схема запроса списка шаблонов
 */
export const listTemplatesQuerySchema = z.object({
  page: z.coerce.number()
    .int()
    .min(1)
    .default(1),
  limit: z.coerce.number()
    .int()
    .min(1)
    .max(100)
    .default(20),
  categoryId: z.string().uuid().optional(),
  type: templateTypeEnum.optional(),
  messengerTarget: messengerTargetEnum.optional(),
  isActive: z.coerce.boolean().optional(),
  search: z.string().max(100).optional(),
  sortBy: z.enum(['createdAt', 'name', 'updatedAt']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export type ListTemplatesQuerySchema = z.infer<typeof listTemplatesQuerySchema>;

// ============================================
// Preview Schemas
// ============================================

/**
 * Схема превью шаблона
 */
export const previewTemplateSchema = z.object({
  clientData: z.object({
    firstName: z.string().default('Иван'),
    lastName: z.string().default('Иванов'),
    middleName: z.string().nullable().optional(),
    phone: z.string().optional(),
    groupName: z.string().nullable().optional(),
    regionName: z.string().nullable().optional(),
  }).optional(),
});

export type PreviewTemplateSchema = z.infer<typeof previewTemplateSchema>;

/**
 * Схема валидации текста шаблона
 */
export const validateTextSchema = z.object({
  text: z.string().max(10000, 'Text must be at most 10000 characters'),
});

export type ValidateTextSchema = z.infer<typeof validateTextSchema>;

// ============================================
// Params Schemas
// ============================================

/**
 * Схема ID в параметрах запроса
 */
export const idParamSchema = z.object({
  id: z.string().uuid('Invalid ID'),
});

export type IdParamSchema = z.infer<typeof idParamSchema>;

/**
 * Схема ID шаблона и элемента в параметрах запроса
 */
export const templateItemParamsSchema = z.object({
  templateId: z.string().uuid('Invalid template ID'),
  itemId: z.string().uuid('Invalid item ID'),
});

export type TemplateItemParamsSchema = z.infer<typeof templateItemParamsSchema>;

/**
 * Схема ID шаблона в параметрах запроса
 */
export const templateIdParamSchema = z.object({
  templateId: z.string().uuid('Invalid template ID'),
});

export type TemplateIdParamSchema = z.infer<typeof templateIdParamSchema>;


