/**
 * Zod схемы валидации для модуля шаблонов сообщений
 * 
 * Схемы валидации для форм создания и редактирования шаблонов на фронтенде.
 * Соответствуют backend схемам для консистентности.
 */

import { z } from 'zod';

/**
 * Enum для типа шаблона
 */
export const templateTypeEnum = z.enum(['SINGLE', 'MULTI']);

/**
 * Enum для типа элемента шаблона
 */
export const templateItemTypeEnum = z.enum(['TEXT', 'FILE']);

/**
 * Enum для типа файла
 */
export const fileTypeEnum = z.enum(['IMAGE', 'VIDEO', 'DOCUMENT']);

/**
 * Enum для целевого мессенджера
 */
export const messengerTargetEnum = z.enum(['WHATSAPP_ONLY', 'TELEGRAM_ONLY', 'UNIVERSAL']);

// ============================================
// Category Schemas
// ============================================

/**
 * Схема валидации для создания категории шаблонов
 */
export const createTemplateCategorySchema = z.object({
  name: z
    .string({ required_error: 'Название категории обязательно' })
    .min(1, { message: 'Название категории не может быть пустым' })
    .max(100, { message: 'Название категории не должно превышать 100 символов' })
    .trim(),

  description: z
    .string()
    .max(500, { message: 'Описание не должно превышать 500 символов' })
    .trim()
    .optional()
    .nullable(),

  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, { message: 'Цвет должен быть в формате HEX (#RRGGBB)' })
    .optional()
    .nullable(),

  orderIndex: z
    .number()
    .int({ message: 'Индекс сортировки должен быть целым числом' })
    .min(0, { message: 'Индекс сортировки не может быть отрицательным' })
    .optional(),
});

export type CreateTemplateCategoryFormData = z.infer<typeof createTemplateCategorySchema>;

/**
 * Схема валидации для обновления категории шаблонов
 */
export const updateTemplateCategorySchema = z
  .object({
    name: z
      .string()
      .min(1, { message: 'Название категории не может быть пустым' })
      .max(100, { message: 'Название категории не должно превышать 100 символов' })
      .trim()
      .optional(),

    description: z
      .string()
      .max(500, { message: 'Описание не должно превышать 500 символов' })
      .trim()
      .optional()
      .nullable(),

    color: z
      .string()
      .regex(/^#[0-9A-Fa-f]{6}$/, { message: 'Цвет должен быть в формате HEX (#RRGGBB)' })
      .optional()
      .nullable(),

    orderIndex: z
      .number()
      .int({ message: 'Индекс сортировки должен быть целым числом' })
      .min(0, { message: 'Индекс сортировки не может быть отрицательным' })
      .optional(),
  })
  .refine(
    (data) => Object.values(data).some((v) => v !== undefined),
    { message: 'Хотя бы одно поле должно быть предоставлено для обновления' }
  );

export type UpdateTemplateCategoryFormData = z.infer<typeof updateTemplateCategorySchema>;

// ============================================
// Template Schemas
// ============================================

/**
 * Схема валидации для создания элемента шаблона
 */
export const createTemplateItemSchema = z.object({
  type: templateItemTypeEnum,
  content: z
    .string()
    .max(4096, { message: 'Содержимое не должно превышать 4096 символов' })
    .optional()
    .nullable(),
  // orderIndex не передается - backend вычисляет автоматически
  delayAfterMs: z
    .number()
    .int({ message: 'Задержка должна быть целым числом' })
    .min(0, { message: 'Задержка не может быть отрицательной' })
    .max(60000, { message: 'Задержка не должна превышать 60000 мс (1 минута)' })
    .optional(),
});

export type CreateTemplateItemFormData = z.infer<typeof createTemplateItemSchema>;

/**
 * Схема валидации для создания шаблона
 */
export const createTemplateSchema = z.object({
  categoryId: z.string().uuid({ message: 'Некорректный ID категории' }),

  name: z
    .string({ required_error: 'Название шаблона обязательно' })
    .min(1, { message: 'Название шаблона не может быть пустым' })
    .max(200, { message: 'Название шаблона не должно превышать 200 символов' })
    .trim(),

  description: z
    .string()
    .max(1000, { message: 'Описание не должно превышать 1000 символов' })
    .trim()
    .optional()
    .nullable(),

  type: templateTypeEnum,

  messengerTarget: messengerTargetEnum,

  // items не используется при создании - элементы добавляются отдельно после создания шаблона
  // Для SINGLE шаблона можно использовать content для создания первого элемента
});

export type CreateTemplateFormData = z.infer<typeof createTemplateSchema>;

/**
 * Схема валидации для обновления шаблона
 */
export const updateTemplateSchema = z
  .object({
    categoryId: z.string().uuid({ message: 'Некорректный ID категории' }).optional(),

    name: z
      .string()
      .min(1, { message: 'Название шаблона не может быть пустым' })
      .max(200, { message: 'Название шаблона не должно превышать 200 символов' })
      .trim()
      .optional(),

    description: z
      .string()
      .max(1000, { message: 'Описание не должно превышать 1000 символов' })
      .trim()
      .optional()
      .nullable(),

    messengerTarget: messengerTargetEnum.optional(),

    isActive: z.boolean().optional(),
  })
  .refine(
    (data) => {
      // Проверяем что хотя бы одно поле предоставлено
      const hasValue = Object.entries(data).some(([key, value]) => {
        if (key === 'categoryId') {
          // categoryId может быть пустой строкой, но не null
          return value !== undefined && value !== '';
        }
        return value !== undefined;
      });
      return hasValue;
    },
    { message: 'Хотя бы одно поле должно быть предоставлено для обновления' }
  );

export type UpdateTemplateFormData = z.infer<typeof updateTemplateSchema>;

/**
 * Схема валидации для обновления элемента шаблона
 */
export const updateTemplateItemSchema = z
  .object({
    content: z
      .string()
      .max(4096, { message: 'Содержимое не должно превышать 4096 символов' })
      .optional()
      .nullable(),
    // orderIndex не используется - порядок изменяется через reorderItems
    delayAfterMs: z
      .number()
      .int({ message: 'Задержка должна быть целым числом' })
      .min(0, { message: 'Задержка не может быть отрицательной' })
      .max(60000, { message: 'Задержка не должна превышать 60000 мс (1 минута)' })
      .optional(),
  })
  .refine(
    (data) => Object.values(data).some((v) => v !== undefined),
    { message: 'Хотя бы одно поле должно быть предоставлено для обновления' }
  );

export type UpdateTemplateItemFormData = z.infer<typeof updateTemplateItemSchema>;

/**
 * Схема валидации для переупорядочивания элементов
 */
export const reorderTemplateItemsSchema = z.object({
  items: z
    .array(
      z.object({
        id: z.string().uuid({ message: 'Некорректный ID элемента' }),
        orderIndex: z
          .number()
          .int({ message: 'Индекс сортировки должен быть целым числом' })
          .min(0, { message: 'Индекс сортировки не может быть отрицательным' }),
      })
    )
    .min(1, { message: 'Должен быть хотя бы один элемент' }),
});

export type ReorderTemplateItemsFormData = z.infer<typeof reorderTemplateItemsSchema>;

/**
 * Схема валидации для перемещения шаблона
 */
export const moveTemplateSchema = z.object({
  categoryId: z.string().uuid({ message: 'Некорректный ID категории' }),
});

export type MoveTemplateFormData = z.infer<typeof moveTemplateSchema>;

/**
 * Схема валидации для предпросмотра шаблона
 */
export const previewTemplateSchema = z.object({
  clientData: z
    .object({
      firstName: z.string().optional(),
      lastName: z.string().optional(),
      middleName: z.string().optional(),
      phone: z.string().optional(),
    })
    .catchall(z.string())
    .optional(),
});

export type PreviewTemplateFormData = z.infer<typeof previewTemplateSchema>;

/**
 * Схема валидации для дублирования шаблона
 */
export const duplicateTemplateSchema = z.object({
  name: z
    .string()
    .min(1, { message: 'Название не может быть пустым' })
    .max(200, { message: 'Название не должно превышать 200 символов' })
    .trim()
    .optional(),
});

export type DuplicateTemplateFormData = z.infer<typeof duplicateTemplateSchema>;


