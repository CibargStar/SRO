/**
 * Zod схемы для валидации запросов экспорта
 * 
 * @module modules/export/schemas/export.schemas
 */

import { z } from 'zod';

/**
 * Схема валидации query параметров для экспорта группы
 */
export const exportGroupQuerySchema = z.object({
  format: z.enum(['xlsx', 'xls', 'csv']).default('xlsx'),
});

export type ExportGroupQuery = z.infer<typeof exportGroupQuerySchema>;


