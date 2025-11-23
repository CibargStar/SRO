/**
 * Zod схемы валидации для управления клиентами
 * 
 * Схемы валидации для форм создания и редактирования клиентов на фронтенде.
 * Соответствуют backend схемам для консистентности.
 */

import { z } from 'zod';

import { createClientPhoneSchema } from './client-phone.schema';

/**
 * Схема валидации для создания клиента
 */
export const createClientSchema = z.object({
  lastName: z
    .string({ required_error: 'Фамилия обязательна' })
    .min(1, { message: 'Фамилия не может быть пустой' })
    .max(100, { message: 'Фамилия не должна превышать 100 символов' })
    .trim(),

  firstName: z
    .string({ required_error: 'Имя обязательно' })
    .min(1, { message: 'Имя не может быть пустым' })
    .max(100, { message: 'Имя не должно превышать 100 символов' })
    .trim(),

  middleName: z
    .string()
    .min(1, { message: 'Отчество не может быть пустым, если указано' })
    .max(100, { message: 'Отчество не должно превышать 100 символов' })
    .trim()
    .optional()
    .nullable(),

  regionId: z
    .string()
    .uuid({ message: 'Неверный формат ID региона' })
    .optional()
    .nullable(),

  groupId: z
    .string({ required_error: 'Группа обязательна' })
    .uuid({ message: 'Неверный формат ID группы' }),

  status: z.enum(['NEW', 'OLD']).default('NEW'),

  userId: z
    .string()
    .uuid({ message: 'Неверный формат ID пользователя' })
    .optional(), // Опциональный параметр для ROOT (для создания клиента от имени другого пользователя)

  phones: z.array(createClientPhoneSchema).optional().default([]),
});

/**
 * Тип для данных создания клиента
 */
export type CreateClientFormData = z.infer<typeof createClientSchema>;

/**
 * Схема валидации для обновления клиента
 */
export const updateClientSchema = z
  .object({
    lastName: z
      .string()
      .min(1, { message: 'Фамилия не может быть пустой, если указана' })
      .max(100, { message: 'Фамилия не должна превышать 100 символов' })
      .trim()
      .optional(),

    firstName: z
      .string()
      .min(1, { message: 'Имя не может быть пустым, если указано' })
      .max(100, { message: 'Имя не должно превышать 100 символов' })
      .trim()
      .optional(),

    middleName: z
      .string()
      .min(1, { message: 'Отчество не может быть пустым, если указано' })
      .max(100, { message: 'Отчество не должно превышать 100 символов' })
      .trim()
      .optional()
      .nullable(),

    regionId: z
      .string()
      .uuid({ message: 'Неверный формат ID региона' })
      .optional()
      .nullable(),

    groupId: z
      .string()
      .uuid({ message: 'Неверный формат ID группы' })
      .optional()
      .nullable(), // При редактировании можно не менять группу, но если меняем - должна быть валидной

    status: z.enum(['NEW', 'OLD']).optional(),
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
 * Тип для данных обновления клиента
 */
export type UpdateClientFormData = z.infer<typeof updateClientSchema>;

