/**
 * Zod схемы валидации для модуля управления клиентами
 * 
 * Определяет схемы валидации для входных данных API endpoints управления клиентами.
 * Используется для типобезопасной валидации запросов.
 * 
 * @module modules/clients/client.schemas
 */

import { z } from 'zod';

/**
 * Enum для статуса клиента
 */
export const ClientStatusEnum = z.enum(['NEW', 'OLD']);

/**
 * Схема валидации для создания клиента
 * 
 * @property lastName - Фамилия клиента (обязательно)
 * @property firstName - Имя клиента (обязательно)
 * @property middleName - Отчество клиента (опционально)
 * @property regionId - ID региона (опционально, UUID)
 * @property groupId - ID группы клиентов (опционально, UUID)
 * @property status - Статус клиента (NEW или OLD, по умолчанию NEW)
 * 
 * @example
 * ```typescript
 * const clientData = createClientSchema.parse(req.body);
 * ```
 */
export const createClientSchema = z.object({
  lastName: z
    .string({ required_error: 'Last name is required' })
    .min(1, { message: 'Last name cannot be empty' })
    .max(100, { message: 'Last name must be at most 100 characters long' })
    .trim(),

  firstName: z
    .string({ required_error: 'First name is required' })
    .min(1, { message: 'First name cannot be empty' })
    .max(100, { message: 'First name must be at most 100 characters long' })
    .trim(),

  middleName: z
    .string()
    .min(1, { message: 'Middle name cannot be empty if provided' })
    .max(100, { message: 'Middle name must be at most 100 characters long' })
    .trim()
    .optional()
    .nullable(),

  regionId: z
    .string()
    .uuid({ message: 'Region ID must be a valid UUID' })
    .optional()
    .nullable(),

  groupId: z
    .string()
    .uuid({ message: 'Group ID must be a valid UUID' })
    .optional()
    .nullable(),

  status: ClientStatusEnum.default('NEW'),
});

/**
 * Тип для данных создания клиента
 */
export type CreateClientInput = z.infer<typeof createClientSchema>;

/**
 * Схема валидации для обновления клиента
 * 
 * Все поля опциональны - можно обновлять только нужные поля.
 * 
 * @property lastName - Фамилия клиента (опционально)
 * @property firstName - Имя клиента (опционально)
 * @property middleName - Отчество клиента (опционально)
 * @property regionId - ID региона (опционально, UUID)
 * @property groupId - ID группы клиентов (опционально, UUID)
 * @property status - Статус клиента (NEW или OLD, опционально)
 * 
 * @example
 * ```typescript
 * const updateData = updateClientSchema.parse(req.body);
 * ```
 */
export const updateClientSchema = z
  .object({
    lastName: z
      .string()
      .min(1, { message: 'Last name cannot be empty if provided' })
      .max(100, { message: 'Last name must be at most 100 characters long' })
      .trim()
      .optional(),

    firstName: z
      .string()
      .min(1, { message: 'First name cannot be empty if provided' })
      .max(100, { message: 'First name must be at most 100 characters long' })
      .trim()
      .optional(),

    middleName: z
      .string()
      .min(1, { message: 'Middle name cannot be empty if provided' })
      .max(100, { message: 'Middle name must be at most 100 characters long' })
      .trim()
      .optional()
      .nullable(),

    regionId: z
      .string()
      .uuid({ message: 'Region ID must be a valid UUID' })
      .optional()
      .nullable(),

    groupId: z
      .string()
      .uuid({ message: 'Group ID must be a valid UUID' })
      .optional()
      .nullable(),

    status: ClientStatusEnum.optional(),
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
 * Тип для данных обновления клиента
 */
export type UpdateClientInput = z.infer<typeof updateClientSchema>;

/**
 * Схема валидации для query параметров списка клиентов
 * 
 * Поддерживает пагинацию, поиск, фильтрацию и сортировку.
 * 
 * @property page - Номер страницы (по умолчанию 1)
 * @property limit - Количество элементов на странице (по умолчанию 10, максимум 100)
 * @property search - Поиск по ФИО клиента (опционально)
 * @property regionId - Фильтр по региону (опционально, UUID)
 * @property groupId - Фильтр по группе (опционально, UUID)
 * @property status - Фильтр по статусу (NEW или OLD, опционально)
 * @property sortBy - Поле для сортировки (по умолчанию createdAt)
 * @property sortOrder - Порядок сортировки (asc или desc, по умолчанию desc)
 * 
 * @example
 * ```typescript
 * const query = listClientsQuerySchema.parse(req.query);
 * ```
 */
export const listClientsQuerySchema = z.object({
  page: z
    .string()
    .regex(/^\d+$/, { message: 'Page must be a positive integer' })
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().int().positive())
    .default('1'),

  limit: z
    .string()
    .regex(/^\d+$/, { message: 'Limit must be a positive integer' })
    .transform((val) => parseInt(val, 10))
    .pipe(z.number().int().positive().max(100))
    .default('10'),

  search: z
    .string()
    .min(1, { message: 'Search query cannot be empty if provided' })
    .max(200, { message: 'Search query must be at most 200 characters long' })
    .trim()
    .optional(),

  regionId: z
    .string()
    .uuid({ message: 'Region ID must be a valid UUID' })
    .optional(),

  groupId: z
    .string()
    .uuid({ message: 'Group ID must be a valid UUID' })
    .optional(),

  status: ClientStatusEnum.optional(),

  sortBy: z
    .enum(['createdAt', 'lastName', 'firstName', 'regionId', 'status'], {
      errorMap: () => ({ message: 'Invalid sort field' }),
    })
    .default('createdAt'),

  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

/**
 * Тип для query параметров списка клиентов
 */
export type ListClientsQuery = z.infer<typeof listClientsQuerySchema>;

