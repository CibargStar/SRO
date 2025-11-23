/**
 * Zod схемы валидации для модуля импорта
 * 
 * @module modules/import/schemas/import.schemas
 */

import { z } from 'zod';

/**
 * Схема валидации для query параметров импорта
 */
export const importClientsQuerySchema = z.object({
  groupId: z
    .string({ required_error: 'Group ID is required' })
    .uuid({ message: 'Group ID must be a valid UUID' }),
  configId: z
    .string()
    .uuid({ message: 'Config ID must be a valid UUID' })
    .optional(),
});

/**
 * Тип для query параметров импорта
 */
export type ImportClientsQuery = z.infer<typeof importClientsQuerySchema>;

