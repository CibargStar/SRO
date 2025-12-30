/**
 * Zod схемы валидации для модуля управления профилями Chrome
 * 
 * Определяет схемы валидации для входных данных API endpoints управления профилями.
 * Используется для типобезопасной валидации запросов.
 * 
 * @module modules/profiles/profiles.schemas
 */

import { z } from 'zod';

/**
 * Enum для статуса профиля
 */
export const ProfileStatusEnum = z.enum(['STOPPED', 'RUNNING', 'STARTING', 'STOPPING', 'ERROR']);

/**
 * Схема валидации для создания профиля
 * 
 * @property name - Название профиля (обязательно, 1-100 символов)
 * @property description - Описание профиля (опционально, максимум 500 символов)
 * 
 * @example
 * ```typescript
 * const profileData = createProfileSchema.parse(req.body);
 * ```
 */
export const createProfileSchema = z.object({
  name: z
    .string({ required_error: 'Name is required' })
    .min(1, { message: 'Name cannot be empty' })
    .max(100, { message: 'Name must be at most 100 characters long' })
    .trim(),

  description: z
    .string()
    .max(500, { message: 'Description must be at most 500 characters long' })
    .trim()
    .optional()
    .nullable(),

  headless: z
    .boolean()
    .optional()
    .default(true), // По умолчанию headless режим
});

/**
 * Тип для данных создания профиля
 */
export type CreateProfileInput = z.infer<typeof createProfileSchema>;

/**
 * Схема валидации для обновления профиля
 * 
 * Все поля опциональны - можно обновлять только нужные поля.
 * 
 * @property name - Название профиля (опционально, 1-100 символов)
 * @property description - Описание профиля (опционально, максимум 500 символов)
 * 
 * @example
 * ```typescript
 * const updateData = updateProfileSchema.parse(req.body);
 * ```
 */
export const updateProfileSchema = z
  .object({
    name: z
      .string()
      .min(1, { message: 'Name cannot be empty if provided' })
      .max(100, { message: 'Name must be at most 100 characters long' })
      .trim()
      .optional(),

    description: z
      .string()
      .max(500, { message: 'Description must be at most 500 characters long' })
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
      message: 'At least one field must be provided for update',
    }
  );

/**
 * Тип для данных обновления профиля
 */
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

/**
 * Схема валидации для query параметров списка профилей
 * 
 * Поддерживает пагинацию, фильтрацию и сортировку.
 * 
 * @property page - Номер страницы (по умолчанию 1)
 * @property limit - Количество элементов на странице (по умолчанию 10, максимум 100)
 * @property status - Фильтр по статусу (STOPPED, RUNNING, STARTING, STOPPING, ERROR, опционально)
 * @property sortBy - Поле для сортировки (по умолчанию createdAt)
 * @property sortOrder - Порядок сортировки (asc или desc, по умолчанию desc)
 * 
 * @example
 * ```typescript
 * const query = listProfilesQuerySchema.parse(req.query);
 * ```
 */
export const listProfilesQuerySchema = z.object({
  page: z.preprocess(
    (val) => {
      if (val === undefined || val === null || val === '') return 1;
      const parsed = typeof val === 'string' ? parseInt(val, 10) : Number(val);
      return isNaN(parsed) || parsed < 1 ? 1 : parsed;
    },
    z.number().int().positive()
  ),

  limit: z.preprocess(
    (val) => {
      if (val === undefined || val === null || val === '') return 10;
      const parsed = typeof val === 'string' ? parseInt(val, 10) : Number(val);
      if (isNaN(parsed) || parsed < 1) return 10;
      return Math.min(parsed, 100);
    },
    z.number().int().positive().max(100)
  ),

  status: ProfileStatusEnum.optional(),

  sortBy: z.preprocess(
    (val) => {
      if (
        val === undefined ||
        val === null ||
        val === '' ||
        !['createdAt', 'updatedAt', 'name', 'status', 'lastActiveAt'].includes(val as string)
      ) {
        return 'createdAt';
      }
      return val;
    },
    z.enum(['createdAt', 'updatedAt', 'name', 'status', 'lastActiveAt'])
  ),

  sortOrder: z.preprocess(
    (val) => {
      if (val === undefined || val === null || val === '' || !['asc', 'desc'].includes(val as string)) {
        return 'desc';
      }
      return val;
    },
    z.enum(['asc', 'desc'])
  ),

  isInCampaign: z
    .preprocess((val) => {
      if (val === undefined || val === null || val === '') return undefined;
      if (typeof val === 'string') {
        return val === 'true';
      }
      return val;
    }, z.boolean().optional()),
});

/**
 * Тип для query параметров списка профилей
 */
export type ListProfilesQuery = z.infer<typeof listProfilesQuerySchema>;

