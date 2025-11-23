/**
 * Схемы валидации для конфигураций импорта
 * 
 * @module modules/import/schemas/import-config.schemas
 */

import { z } from 'zod';

/**
 * Схема для создания/обновления конфигурации импорта
 */
export const ImportConfigSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional().nullable(),
  isDefault: z.boolean().optional(),
  
  searchScope: z.object({
    scopes: z.array(z.enum(['none', 'current_group', 'owner_groups', 'all_users'])).min(1),
    matchCriteria: z.enum(['phone', 'phone_and_name', 'name']),
  }),
  
  duplicateAction: z.object({
    defaultAction: z.enum(['skip', 'update', 'create']),
    updateName: z.boolean(),
    updateRegion: z.boolean(),
    addPhones: z.boolean(),
    addToGroup: z.boolean(),
    moveToGroup: z.boolean(),
  }),
  
  noDuplicateAction: z.enum(['create', 'skip']),
  
  validation: z.object({
    requireName: z.boolean(),
    requirePhone: z.boolean(),
    requireRegion: z.boolean(),
    errorHandling: z.enum(['stop', 'skip', 'warn']),
  }),
  
  additional: z.object({
    newClientStatus: z.enum(['NEW', 'OLD', 'from_file']),
    updateStatus: z.boolean(),
  }),
});

export type ImportConfigInput = z.infer<typeof ImportConfigSchema>;

/**
 * Схема для query параметров получения конфигураций
 */
export const GetImportConfigsQuerySchema = z.object({
  includeTemplates: z.string().optional().transform((val) => val === 'true'),
});

export type GetImportConfigsQuery = z.infer<typeof GetImportConfigsQuerySchema>;

