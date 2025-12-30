/**
 * Zod схемы для валидации данных модуля кампаний
 * 
 * Используются для валидации форм на фронтенде.
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
export const recurrenceTypeSchema = z.enum(['NONE', 'DAILY', 'WEEKLY', 'MONTHLY']);

// ============================================
// Schedule Config Schema
// ============================================

export const scheduleConfigSchema = z.object({
  // Время работы (рабочие часы)
  workHoursEnabled: z.boolean(),
  // Если workHoursEnabled=true, то workHoursStart и workHoursEnd обязательны
  workHoursStart: z.string().regex(/^\d{2}:\d{2}$/, 'Формат времени: HH:MM').optional(),
  workHoursEnd: z.string().regex(/^\d{2}:\d{2}$/, 'Формат времени: HH:MM').optional(),
  
  // Рабочие дни
  workDaysEnabled: z.boolean(),
  // Если workDaysEnabled=true, то workDays обязателен
  workDays: z.array(z.number().int().min(0).max(6)).optional(),
  
  // Периодичность
  recurrence: recurrenceTypeSchema.default('NONE'),
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

export type ScheduleConfigFormData = z.infer<typeof scheduleConfigSchema>;

// ============================================
// Filter Config Schema
// ============================================

export const filterConfigSchema = z.object({
  // Фильтр по регионам
  regionIds: z.array(z.string().uuid()).optional(),
  
  // Фильтр по статусу клиента
  clientStatuses: z.array(z.string()).optional(),
  
  // Фильтр по статусу телефона
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

export type FilterConfigFormData = z.infer<typeof filterConfigSchema>;

// ============================================
// Options Config Schema
// ============================================

export const optionsConfigSchema = z.object({
  // Дедупликация
  deduplicationEnabled: z.boolean().default(false),
  deduplicationPeriodDays: z.number().int().positive().optional(),
  deduplicationCampaignIds: z.array(z.string().uuid()).optional(),
  
  // Cooldown
  cooldownEnabled: z.boolean().default(false),
  cooldownMinutes: z.number().int().positive().optional(),
  
  // Прогрев
  warmupEnabled: z.boolean().default(false),
  warmupStartRate: z.number().int().positive().optional(),
  warmupTargetRate: z.number().int().positive().optional(),
  warmupDurationHours: z.number().int().positive().optional(),
  
  // Автовозобновление
  autoResumeEnabled: z.boolean().default(true),
  
  // Остановка при ошибках
  stopOnErrorThreshold: z.number().int().positive().optional(),
  stopOnConsecutiveErrors: z.number().int().positive().optional(),
});

export type OptionsConfigFormData = z.infer<typeof optionsConfigSchema>;

// ============================================
// Campaign Schemas
// ============================================

/**
 * Схема создания кампании
 */
export const createCampaignSchema = z.object({
  name: z
    .string({ required_error: 'Название обязательно' })
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
    .string({ required_error: 'Выберите шаблон' })
    .uuid({ message: 'Некорректный шаблон' }),
  
  clientGroupId: z
    .string({ required_error: 'Выберите группу клиентов' })
    .uuid({ message: 'Некорректная группа' }),
  
  campaignType: campaignTypeSchema,
  
  messengerType: messengerTargetSchema,
  
  universalTarget: universalTargetSchema.optional().nullable(),
  
  profileIds: z
    .array(z.string().uuid({ message: 'Некорректный профиль' }))
    .min(1, { message: 'Выберите хотя бы один профиль' }),
  
  scheduleConfig: scheduleConfigSchema, // Обязательно - рабочие часы настраиваются для каждой кампании
  filterConfig: filterConfigSchema.optional(),
  optionsConfig: optionsConfigSchema.optional(),
  
  scheduledAt: z.string().datetime().optional().nullable(),
});

export type CreateCampaignFormData = z.infer<typeof createCampaignSchema>;

/**
 * Схема обновления кампании
 */
export const updateCampaignSchema = z.object({
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
    .uuid({ message: 'Некорректный шаблон' })
    .optional(),
  
  clientGroupId: z
    .string()
    .uuid({ message: 'Некорректная группа' })
    .optional(),
  
  messengerType: messengerTargetSchema.optional(),
  
  universalTarget: universalTargetSchema.optional().nullable(),
  
  scheduleConfig: scheduleConfigSchema, // Обязательно - рабочие часы настраиваются для каждой кампании
  filterConfig: filterConfigSchema.optional(),
  optionsConfig: optionsConfigSchema.optional(),
  
  scheduledAt: z.string().datetime().optional().nullable(),
});

export type UpdateCampaignFormData = z.infer<typeof updateCampaignSchema>;

/**
 * Схема запуска кампании
 */
export const startCampaignSchema = z.object({
  profileIds: z
    .array(z.string().uuid({ message: 'Некорректный профиль' }))
    .min(1, { message: 'Выберите хотя бы один профиль' })
    .optional(),
  
  force: z.boolean().default(false),
});

export type StartCampaignFormData = z.infer<typeof startCampaignSchema>;

/**
 * Схема дублирования кампании
 */
export const duplicateCampaignSchema = z.object({
  name: z
    .string()
    .min(1, { message: 'Название не может быть пустым' })
    .max(200, { message: 'Название не должно превышать 200 символов' })
    .trim()
    .optional(),
});

export type DuplicateCampaignFormData = z.infer<typeof duplicateCampaignSchema>;

/**
 * Схема обновления профилей кампании
 */
export const updateCampaignProfilesSchema = z.object({
  profileIds: z
    .array(z.string().uuid({ message: 'Некорректный профиль' }))
    .min(1, { message: 'Выберите хотя бы один профиль' }),
});

export type UpdateCampaignProfilesFormData = z.infer<typeof updateCampaignProfilesSchema>;

// ============================================
// Global Settings Schema
// ============================================

export const globalSettingsSchema = z.object({
  pauseMode: z.union([z.literal(1), z.literal(2)]).default(2),
  
  delayBetweenContactsMs: z.number().int().min(0).default(60000),
  delayBetweenMessagesMs: z.number().int().min(0).default(5000),
  
  maxContactsPerProfilePerHour: z.number().int().positive().default(100),
  maxContactsPerProfilePerDay: z.number().int().positive().default(500),
  
  typingSimulationEnabled: z.boolean().default(true),
  typingSpeedCharsPerSec: z.number().int().positive().default(50),
  
  maxRetriesOnError: z.number().int().min(0).default(3),
  retryDelayMs: z.number().int().min(0).default(30000),
  pauseOnCriticalError: z.boolean().default(true),
  
  profileHealthCheckIntervalMs: z.number().int().min(0).default(30000),
  autoResumeAfterRestart: z.boolean().default(false),
  
  keepCompletedCampaignsDays: z.number().int().min(1).default(90),
  
  warmupEnabled: z.boolean().default(false),
  warmupDay1To3Limit: z.number().int().positive().default(50),
  warmupDay4To7Limit: z.number().int().positive().default(100),
});

export type GlobalSettingsFormData = z.infer<typeof globalSettingsSchema>;

/**
 * Схема лимитов пользователя
 */
export const userLimitsSchema = z.object({
  maxActiveCampaigns: z.number().int().min(1).default(3),
  maxTemplates: z.number().int().min(1).default(100),
  maxTemplateCategories: z.number().int().min(1).default(20),
  maxFileSizeMb: z.number().int().min(1).default(50),
  maxTotalStorageMb: z.number().int().min(1).default(1000),
  allowScheduledCampaigns: z.boolean().default(true),
  allowUniversalCampaigns: z.boolean().default(true),
});

export type UserLimitsFormData = z.infer<typeof userLimitsSchema>;

// ============================================
// Query Schemas
// ============================================

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

export const listMessagesQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(50),
  status: z.union([messageStatusSchema, z.array(messageStatusSchema)]).optional(),
  messenger: messengerTypeSchema.optional(),
  profileId: z.string().uuid().optional(),
});

export const listLogsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(50),
  level: z.union([logLevelSchema, z.array(logLevelSchema)]).optional(),
  action: z.string().max(50).optional(),
});




