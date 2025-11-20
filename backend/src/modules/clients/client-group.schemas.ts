/**
 * Zod схемы валидации для модуля управления группами клиентов
 * 
 * Определяет схемы валидации для входных данных API endpoints управления группами клиентов.
 * Используется для типобезопасной валидации запросов.
 * 
 * @module modules/clients/client-group.schemas
 */

import { z } from 'zod';

/**
 * Схема валидации для создания группы клиентов
 * 
 * @property name - Название группы (обязательно, уникальное для пользователя)
 * @property description - Описание группы (опционально)
 * @property color - HEX цвет или название цвета (опционально)
 * @property orderIndex - Порядок сортировки (опционально)
 * @property userId - ID пользователя-владельца (опционально, UUID, только для ROOT)
 * 
 * @example
 * ```typescript
 * const groupData = createClientGroupSchema.parse(req.body);
 * ```
 */
export const createClientGroupSchema = z.object({
  name: z
    .string({ required_error: 'Name is required' })
    .min(1, { message: 'Name cannot be empty' })
    .max(100, { message: 'Name must be at most 100 characters long' })
    .trim(),

  description: z
    .preprocess(
      (val) => {
        if (typeof val === 'string') {
          const trimmed = val.trim();
          return trimmed === '' ? null : trimmed;
        }
        return val;
      },
      z
        .union([
          z.string().min(1, { message: 'Description cannot be empty if provided' }).max(500, { message: 'Description must be at most 500 characters long' }),
          z.null(),
        ])
        .optional()
    ),

  color: z
    .string()
    .min(1, { message: 'Color cannot be empty if provided' })
    .max(50, { message: 'Color must be at most 50 characters long' })
    .trim()
    .optional()
    .nullable(),

  orderIndex: z
    .number()
    .int()
    .min(0, { message: 'Order index must be non-negative' })
    .optional()
    .nullable(),

  userId: z
    .string()
    .uuid({ message: 'User ID must be a valid UUID' })
    .optional(), // Опциональный параметр для ROOT (для создания группы от имени другого пользователя)
});

/**
 * Тип для данных создания группы клиентов
 */
export type CreateClientGroupInput = z.infer<typeof createClientGroupSchema>;

/**
 * Схема валидации для обновления группы клиентов
 * 
 * Все поля опциональны - можно обновлять только нужные поля.
 * 
 * @property name - Название группы (опционально)
 * @property description - Описание группы (опционально)
 * @property color - HEX цвет или название цвета (опционально)
 * @property orderIndex - Порядок сортировки (опционально)
 * 
 * @example
 * ```typescript
 * const updateData = updateClientGroupSchema.parse(req.body);
 * ```
 */
export const updateClientGroupSchema = z
  .object({
    name: z
      .string()
      .min(1, { message: 'Name cannot be empty if provided' })
      .max(100, { message: 'Name must be at most 100 characters long' })
      .trim()
      .optional(),

    description: z
      .string()
      .min(1, { message: 'Description cannot be empty if provided' })
      .max(500, { message: 'Description must be at most 500 characters long' })
      .trim()
      .optional()
      .nullable(),

    color: z
      .string()
      .min(1, { message: 'Color cannot be empty if provided' })
      .max(50, { message: 'Color must be at most 50 characters long' })
      .trim()
      .optional()
      .nullable(),

    orderIndex: z
      .number()
      .int()
      .min(0, { message: 'Order index must be non-negative' })
      .optional()
      .nullable(),
  })
  .refine(
    (data) => {
      // Проверка: хотя бы одно поле должно быть предоставлено
      return Object.keys(data).length > 0;
    },
    {
      message: 'At least one field must be provided for update',
    }
  );

/**
 * Тип для данных обновления группы клиентов
 */
export type UpdateClientGroupInput = z.infer<typeof updateClientGroupSchema>;

