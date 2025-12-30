/**
 * Zod схемы валидации для модуля кампаний
 * 
 * Определяет схемы валидации для входящих данных.
 * Используется для валидации запросов в контроллере.
 * 
 * @module modules/campaigns/campaigns.schemas
 */

import { z } from 'zod';

// ============================================
// Enum Schemas
// ============================================

export const campaignTypeSchema = z.enum(['ONE_TIME', 'SCHEDULED']);
export const campaignStatusSchema = z.enum([
  'DRAFT',
  'SCHEDULED',
  'QUEUED',
  'RUNNING',
  'PAUSED',
  'COMPLETED',
  'CANCELLED',
  'ERROR',
]);
export const campaignProfileStatusSchema = z.enum(['PENDING', 'RUNNING', 'COMPLETED', 'ERROR']);
export const messageStatusSchema = z.enum(['PENDING', 'PROCESSING', 'SENT', 'FAILED', 'SKIPPED']);
export const messengerTargetSchema = z.enum(['WHATSAPP_ONLY', 'TELEGRAM_ONLY', 'UNIVERSAL']);
export const messengerTypeSchema = z.enum(['WHATSAPP', 'TELEGRAM']);
export const universalTargetSchema = z.enum(['BOTH', 'WHATSAPP_FIRST', 'TELEGRAM_FIRST']);
export const logLevelSchema = z.enum(['INFO', 'WARNING', 'ERROR']);

// ============================================
// Schedule Config Schema
// ============================================

/**
 * Конфигурация расписания кампании
 * 
 * ВАЖНО: Рабочие часы и дни настраиваются индивидуально для каждой кампании.
 * Глобальные настройки больше не используются как fallback.
 */
export const scheduleConfigSchema = z.object({
  // Время работы (рабочие часы)
  workHoursEnabled: z.boolean(),
  // Если workHoursEnabled=true, то workHoursStart и workHoursEnd обязательны
  workHoursStart: z.string().regex(/^\d{2}:\d{2}$/).optional(), // HH:MM
  workHoursEnd: z.string().regex(/^\d{2}:\d{2}$/).optional(), // HH:MM
  
  // Рабочие дни (0 = Воскресенье, 1 = Понедельник, ..., 6 = Суббота)
  workDaysEnabled: z.boolean(),
  // Если workDaysEnabled=true, то workDays обязателен
  workDays: z.array(z.number().int().min(0).max(6)).optional(),
  
  // Периодичность (для SCHEDULED)
  recurrence: z.enum(['NONE', 'DAILY', 'WEEKLY', 'MONTHLY']).default('NONE'),
  recurrenceEndDate: z.string().datetime().optional(),
  
  // Таймзона
  timezone: z.string().default('Europe/Moscow'),
}).refine(
  (data) => {
    // Если рабочие часы включены, то время начала и конца обязательны
    if (data.workHoursEnabled && (!data.workHoursStart || !data.workHoursEnd)) {
      return false;
    }
    return true;
  },
  {
    message: 'Если рабочие часы включены, необходимо указать время начала и конца',
    path: ['workHoursStart'],
  }
).refine(
  (data) => {
    // Если рабочие дни включены, то список дней обязателен
    if (data.workDaysEnabled && (!data.workDays || data.workDays.length === 0)) {
      return false;
    }
    return true;
  },
  {
    message: 'Если рабочие дни включены, необходимо выбрать хотя бы один день',
    path: ['workDays'],
  }
);

export type ScheduleConfig = z.infer<typeof scheduleConfigSchema>;

// ============================================
// Filter Config Schema
// ============================================

/**
 * Конфигурация фильтров базы клиентов
 */
export const filterConfigSchema = z.object({
  // Фильтр по регионам
  regionIds: z.array(z.string().uuid()).optional(),
  
  // Фильтр по статусу клиента
  clientStatuses: z.array(z.string()).optional(),
  
  // Фильтр по статусу телефона в мессенджерах
  whatsAppStatus: z.array(z.string()).optional(),
  telegramStatus: z.array(z.string()).optional(),
  
  // Фильтр по дате последней кампании
  lastCampaignBefore: z.string().datetime().optional(),
  lastCampaignAfter: z.string().datetime().optional(),
  neverCampaigned: z.boolean().optional(),
  
  // Фильтр по количеству кампаний
  maxCampaignCount: z.number().int().min(0).optional(),
  
  // Ограничение количества контактов
  limitContacts: z.number().int().positive().optional(),
  
  // Случайный порядок
  randomOrder: z.boolean().default(false),
});

export type FilterConfig = z.infer<typeof filterConfigSchema>;

// ============================================
// Options Config Schema
// ============================================

/**
 * Дополнительные опции кампании
 */
export const optionsConfigSchema = z.object({
  // Дедупликация (не отправлять повторно контактам из предыдущих кампаний)
  deduplicationEnabled: z.boolean().default(false),
  deduplicationPeriodDays: z.number().int().positive().optional(), // За какой период
  deduplicationCampaignIds: z.array(z.string().uuid()).optional(), // Конкретные кампании
  
  // Cooldown между кампаниями для одного контакта
  cooldownEnabled: z.boolean().default(false),
  cooldownMinutes: z.number().int().positive().optional(),
  
  // Rate limiting с прогревом (опционально)
  warmupEnabled: z.boolean().default(false),
  warmupStartRate: z.number().int().positive().optional(), // Начальная скорость сообщений/час
  warmupTargetRate: z.number().int().positive().optional(), // Целевая скорость
  warmupDurationHours: z.number().int().positive().optional(), // Длительность прогрева
  
  // Автовозобновление после рестарта сервера
  autoResumeEnabled: z.boolean().default(true),
  
  // Остановка при критическом количестве ошибок
  stopOnErrorThreshold: z.number().int().positive().optional(), // Процент ошибок
  stopOnConsecutiveErrors: z.number().int().positive().optional(), // Подряд ошибок
});

export type OptionsConfig = z.infer<typeof optionsConfigSchema>;

// ============================================
// Campaign Schemas
// ============================================

/**
 * Схема создания кампании
 */
export const createCampaignSchema = z.object({
  name: z
    .string({ required_error: 'Название кампании обязательно' })
    .min(1, { message: 'Название не может быть пустым' })
    .max(200, { message: 'Название не должно превышать 200 символов' })
    .trim(),
  
  description: z
    .string()
    .max(1000, { message: 'Описание не должно превышать 1000 символов' })
    .trim()
    .optional()
    .nullable(),
  
  templateId: z
    .string({ required_error: 'ID шаблона обязателен' })
    .uuid({ message: 'Некорректный формат ID шаблона' }),
  
  clientGroupId: z
    .string({ required_error: 'ID группы клиентов обязателен' })
    .uuid({ message: 'Некорректный формат ID группы' }),
  
  campaignType: campaignTypeSchema,
  
  messengerType: messengerTargetSchema,
  
  universalTarget: universalTargetSchema.optional().nullable(),
  
  // Профили для выполнения
  profileIds: z
    .array(z.string().uuid({ message: 'Некорректный формат ID профиля' }))
    .min(1, { message: 'Необходимо выбрать хотя бы один профиль' }),
  
  // Конфигурации
  scheduleConfig: scheduleConfigSchema, // Обязательно - рабочие часы настраиваются для каждой кампании
  filterConfig: filterConfigSchema.optional(),
  optionsConfig: optionsConfigSchema.optional(),
  
  // Запланированное время запуска (для SCHEDULED)
  scheduledAt: z.string().datetime().optional().nullable(),
});

export type CreateCampaignInput = z.infer<typeof createCampaignSchema>;

/**
 * Схема обновления кампании
 */
export const updateCampaignSchema = z
  .object({
    name: z
      .string()
      .min(1, { message: 'Название не может быть пустым' })
      .max(200, { message: 'Название не должно превышать 200 символов' })
      .trim()
      .optional(),
    
    description: z
      .string()
      .max(1000, { message: 'Описание не должно превышать 1000 символов' })
      .trim()
      .optional()
      .nullable(),
    
    templateId: z
      .string()
      .uuid({ message: 'Некорректный формат ID шаблона' })
      .optional(),
    
    clientGroupId: z
      .string()
      .uuid({ message: 'Некорректный формат ID группы' })
      .optional(),
    
    messengerType: messengerTargetSchema.optional(),
    
    universalTarget: universalTargetSchema.optional().nullable(),
    
    scheduleConfig: scheduleConfigSchema.optional(),
    filterConfig: filterConfigSchema.optional(),
    optionsConfig: optionsConfigSchema.optional(),
    
    scheduledAt: z.string().datetime().optional().nullable(),
  })
  .refine(
    (data) => Object.values(data).some((v) => v !== undefined),
    { message: 'Хотя бы одно поле должно быть предоставлено для обновления' }
  );

export type UpdateCampaignInput = z.infer<typeof updateCampaignSchema>;

/**
 * Схема запроса списка кампаний
 */
export const listCampaignsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  status: z.union([campaignStatusSchema, z.array(campaignStatusSchema)]).optional(),
  campaignType: campaignTypeSchema.optional(),
  messengerType: messengerTargetSchema.optional(),
  search: z.string().max(100).optional(),
  sortBy: z.enum(['createdAt', 'updatedAt', 'name', 'scheduledAt', 'startedAt']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  includeArchived: z.coerce.boolean().default(false),
});

export type ListCampaignsQuery = z.infer<typeof listCampaignsQuerySchema>;

/**
 * Схема запроса списка сообщений
 */
export const listMessagesQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(50),
  status: z.union([messageStatusSchema, z.array(messageStatusSchema)]).optional(),
  messenger: messengerTypeSchema.optional(),
  profileId: z.string().uuid().optional(),
});

export type ListMessagesQuery = z.infer<typeof listMessagesQuerySchema>;

/**
 * Схема запроса списка логов
 */
export const listLogsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(50),
  level: z.union([logLevelSchema, z.array(logLevelSchema)]).optional(),
  action: z.string().max(50).optional(),
});

export type ListLogsQuery = z.infer<typeof listLogsQuerySchema>;

/**
 * Схема для старта кампании
 */
export const startCampaignSchema = z.object({
  // Опциональное переопределение профилей при запуске
  profileIds: z
    .array(z.string().uuid({ message: 'Некорректный формат ID профиля' }))
    .min(1, { message: 'Необходимо выбрать хотя бы один профиль' })
    .optional(),
  
  // Принудительный запуск (игнорировать некритичные предупреждения)
  force: z.boolean().default(false),
});

export type StartCampaignInput = z.infer<typeof startCampaignSchema>;

/**
 * Схема для дублирования кампании
 */
export const duplicateCampaignSchema = z.object({
  name: z
    .string()
    .min(1, { message: 'Название не может быть пустым' })
    .max(200, { message: 'Название не должно превышать 200 символов' })
    .trim()
    .optional(),
});

export type DuplicateCampaignInput = z.infer<typeof duplicateCampaignSchema>;

/**
 * Схема для обновления профилей кампании
 */
export const updateCampaignProfilesSchema = z.object({
  profileIds: z
    .array(z.string().uuid({ message: 'Некорректный формат ID профиля' }))
    .min(1, { message: 'Необходимо выбрать хотя бы один профиль' }),
});

export type UpdateCampaignProfilesInput = z.infer<typeof updateCampaignProfilesSchema>;

// ============================================
// Campaign ID Param Schema
// ============================================

export const campaignIdParamSchema = z.object({
  campaignId: z.string().uuid({ message: 'Некорректный формат ID кампании' }),
});

export const messageIdParamSchema = z.object({
  campaignId: z.string().uuid({ message: 'Некорректный формат ID кампании' }),
  messageId: z.string().uuid({ message: 'Некорректный формат ID сообщения' }),
});

// ============================================
// Export types
// ============================================

export type CampaignType = z.infer<typeof campaignTypeSchema>;
export type CampaignStatus = z.infer<typeof campaignStatusSchema>;
export type CampaignProfileStatus = z.infer<typeof campaignProfileStatusSchema>;
export type MessageStatus = z.infer<typeof messageStatusSchema>;
export type MessengerTarget = z.infer<typeof messengerTargetSchema>;
export type MessengerType = z.infer<typeof messengerTypeSchema>;
export type UniversalTarget = z.infer<typeof universalTargetSchema>;
export type LogLevel = z.infer<typeof logLevelSchema>;




