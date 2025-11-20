/**
 * Zod схемы валидации для управления регионами
 * 
 * Схемы валидации для форм создания и редактирования регионов на фронтенде.
 * Соответствуют backend схемам для консистентности.
 * 
 * Управление регионами доступно только ROOT пользователям.
 */

import { z } from 'zod';

/**
 * Схема валидации для создания региона
 */
export const createRegionSchema = z.object({
  name: z
    .string({ required_error: 'Название региона обязательно' })
    .min(1, { message: 'Название региона не может быть пустым' })
    .max(100, { message: 'Название региона не должно превышать 100 символов' })
    .trim(),
});

/**
 * Тип для данных создания региона
 */
export type CreateRegionFormData = z.infer<typeof createRegionSchema>;

/**
 * Схема валидации для обновления региона
 */
export const updateRegionSchema = z
  .object({
    name: z
      .string()
      .min(1, { message: 'Название региона не может быть пустым, если указано' })
      .max(100, { message: 'Название региона не должно превышать 100 символов' })
      .trim(),
  })
  .refine(
    (data) => {
      return Object.keys(data).length > 0;
    },
    {
      message: 'Хотя бы одно поле должно быть заполнено для обновления',
      path: ['root'],
    }
  );

/**
 * Тип для данных обновления региона
 */
export type UpdateRegionFormData = z.infer<typeof updateRegionSchema>;

