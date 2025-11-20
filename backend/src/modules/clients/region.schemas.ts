/**
 * Zod схемы валидации для модуля управления регионами
 * 
 * Определяет схемы валидации для входных данных API endpoints управления регионами.
 * Используется для типобезопасной валидации запросов.
 * 
 * Регионы - это справочник, общий для всех пользователей.
 * Управление регионами доступно только ROOT пользователям.
 * 
 * @module modules/clients/region.schemas
 */

import { z } from 'zod';

/**
 * Схема валидации для создания региона
 * 
 * @property name - Название региона (обязательно, уникальное)
 * 
 * @example
 * ```typescript
 * const regionData = createRegionSchema.parse(req.body);
 * ```
 */
export const createRegionSchema = z.object({
  name: z
    .string({ required_error: 'Name is required' })
    .min(1, { message: 'Name cannot be empty' })
    .max(100, { message: 'Name must be at most 100 characters long' })
    .trim(),
});

/**
 * Тип для данных создания региона
 */
export type CreateRegionInput = z.infer<typeof createRegionSchema>;

/**
 * Схема валидации для обновления региона
 * 
 * @property name - Название региона (опционально, уникальное)
 * 
 * @example
 * ```typescript
 * const updateData = updateRegionSchema.parse(req.body);
 * ```
 */
export const updateRegionSchema = z
  .object({
    name: z
      .string()
      .min(1, { message: 'Name cannot be empty if provided' })
      .max(100, { message: 'Name must be at most 100 characters long' })
      .trim(),
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
 * Тип для данных обновления региона
 */
export type UpdateRegionInput = z.infer<typeof updateRegionSchema>;

