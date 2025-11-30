/**
 * Zod схемы валидации для управления профилями Chrome
 * 
 * Схемы валидации для форм создания и редактирования профилей на фронтенде.
 * Соответствуют backend схемам для консистентности.
 */

import { z } from 'zod';

/**
 * Схема валидации для создания профиля
 */
export const createProfileSchema = z.object({
  name: z
    .string({ required_error: 'Название профиля обязательно' })
    .min(1, { message: 'Название профиля не может быть пустым' })
    .max(100, { message: 'Название профиля не должно превышать 100 символов' })
    .trim(),

  description: z
    .string()
    .max(500, { message: 'Описание не должно превышать 500 символов' })
    .trim()
    .optional()
    .nullable(),

  headless: z
    .boolean()
    .optional()
    .default(true), // По умолчанию headless режим
});

export type CreateProfileFormData = z.infer<typeof createProfileSchema>;

/**
 * Схема валидации для обновления профиля
 */
export const updateProfileSchema = z
  .object({
    name: z
      .string()
      .min(1, { message: 'Название профиля не может быть пустым, если указано' })
      .max(100, { message: 'Название профиля не должно превышать 100 символов' })
      .trim()
      .optional(),

    description: z
      .string()
      .max(500, { message: 'Описание не должно превышать 500 символов' })
      .trim()
      .optional()
      .nullable(),

    headless: z
      .boolean()
      .optional(),
  })
  .refine(
    (data) => {
      // Проверка: хотя бы одно поле должно быть предоставлено
      return Object.keys(data).length > 0;
    },
    {
      message: 'Хотя бы одно поле должно быть предоставлено для обновления',
    }
  );

export type UpdateProfileFormData = z.infer<typeof updateProfileSchema>;

/**
 * Схема валидации для опций запуска профиля
 */
export const startProfileOptionsSchema = z
  .object({
    headless: z.boolean().optional(),
    args: z.array(z.string()).optional(),
  })
  .optional();

export type StartProfileOptionsFormData = z.infer<typeof startProfileOptionsSchema>;

/**
 * Схема валидации для установки лимитов профилей
 */
export const setProfileLimitsSchema = z.object({
  maxProfiles: z
    .number({ required_error: 'Максимальное количество профилей обязательно' })
    .int({ message: 'Максимальное количество профилей должно быть целым числом' })
    .positive({ message: 'Максимальное количество профилей должно быть положительным числом' }),

  maxCpuPerProfile: z
    .number()
    .min(0, { message: 'Максимальное использование CPU не может быть отрицательным' })
    .max(1, { message: 'Максимальное использование CPU не может превышать 1 (100%)' })
    .optional()
    .nullable(),

  maxMemoryPerProfile: z
    .number()
    .int({ message: 'Максимальное использование памяти должно быть целым числом' })
    .positive({ message: 'Максимальное использование памяти должно быть положительным числом' })
    .optional()
    .nullable(),

  maxNetworkPerProfile: z
    .number()
    .int({ message: 'Максимальная скорость сети должна быть целым числом' })
    .positive({ message: 'Максимальная скорость сети должна быть положительным числом' })
    .optional()
    .nullable(),
});

export type SetProfileLimitsFormData = z.infer<typeof setProfileLimitsSchema>;

