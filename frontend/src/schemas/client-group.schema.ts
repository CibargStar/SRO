/**
 * Zod схемы валидации для управления группами клиентов
 * 
 * Схемы валидации для форм создания и редактирования групп клиентов на фронтенде.
 * Соответствуют backend схемам для консистентности.
 */

import { z } from 'zod';

/**
 * Схема валидации для создания группы клиентов
 */
export const createClientGroupSchema = z.object({
  name: z
    .string({ required_error: 'Название группы обязательно' })
    .min(1, { message: 'Название группы не может быть пустым' })
    .max(100, { message: 'Название группы не должно превышать 100 символов' })
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
          z.string().min(1, { message: 'Описание не может быть пустым, если указано' }).max(500, { message: 'Описание не должно превышать 500 символов' }),
          z.null(),
        ])
        .optional()
    ),

  color: z
    .string()
    .min(1, { message: 'Цвет не может быть пустым, если указан' })
    .max(50, { message: 'Цвет не должен превышать 50 символов' })
    .trim()
    .optional()
    .nullable(),

  orderIndex: z
    .number()
    .int({ message: 'Порядок сортировки должен быть целым числом' })
    .min(0, { message: 'Порядок сортировки не может быть отрицательным' })
    .optional()
    .nullable(),

  userId: z
    .string()
    .uuid({ message: 'Неверный формат ID пользователя' })
    .optional(), // Опциональный параметр для ROOT (для создания группы от имени другого пользователя)
});

/**
 * Тип для данных создания группы клиентов
 */
export type CreateClientGroupFormData = z.infer<typeof createClientGroupSchema>;

/**
 * Схема валидации для обновления группы клиентов
 */
export const updateClientGroupSchema = z
  .object({
    name: z
      .string()
      .min(1, { message: 'Название группы не может быть пустым, если указано' })
      .max(100, { message: 'Название группы не должно превышать 100 символов' })
      .trim()
      .optional(),

    description: z
      .string()
      .min(1, { message: 'Описание не может быть пустым, если указано' })
      .max(500, { message: 'Описание не должно превышать 500 символов' })
      .trim()
      .optional()
      .nullable(),

    color: z
      .string()
      .min(1, { message: 'Цвет не может быть пустым, если указан' })
      .max(50, { message: 'Цвет не должен превышать 50 символов' })
      .trim()
      .optional()
      .nullable(),

    orderIndex: z
      .number()
      .int({ message: 'Порядок сортировки должен быть целым числом' })
      .min(0, { message: 'Порядок сортировки не может быть отрицательным' })
      .optional()
      .nullable(),
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
 * Тип для данных обновления группы клиентов
 */
export type UpdateClientGroupFormData = z.infer<typeof updateClientGroupSchema>;

