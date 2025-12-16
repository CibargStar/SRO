/**
 * TypeScript типы для модуля управления кампаниями рассылок
 * 
 * Определяет все типы данных, используемые в модуле кампаний.
 */

import type { Template } from './template';

// ============================================
// Enums
// ============================================

/**
 * Тип кампании
 */
export type CampaignType = 'ONE_TIME' | 'SCHEDULED';

/**
 * Статус кампании
 */
export type CampaignStatus =
  | 'DRAFT'
  | 'SCHEDULED'
  | 'QUEUED'
  | 'RUNNING'
  | 'PAUSED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'ERROR';

/**
 * Статус профиля в кампании
 */
export type CampaignProfileStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'ERROR';

/**
 * Статус сообщения
 */
export type MessageStatus = 'PENDING' | 'PROCESSING' | 'SENT' | 'FAILED' | 'SKIPPED';

/**
 * Целевой мессенджер
 */
export type MessengerTarget = 'WHATSAPP_ONLY' | 'TELEGRAM_ONLY' | 'UNIVERSAL';

/**
 * Тип мессенджера
 */
export type MessengerType = 'WHATSAPP' | 'TELEGRAM';

/**
 * Целевой мессенджер для Universal-режима
 */
export type UniversalTarget = 'BOTH' | 'WHATSAPP_FIRST' | 'TELEGRAM_FIRST';

/**
 * Уровень логирования
 */
export type LogLevel = 'INFO' | 'WARNING' | 'ERROR';

/**
 * Периодичность запуска
 */
export type RecurrenceType = 'NONE' | 'DAILY' | 'WEEKLY' | 'MONTHLY';

// ============================================
// Configurations
// ============================================

/**
 * Конфигурация расписания кампании
 */
export interface ScheduleConfig {
  // Время работы (рабочие часы)
  workHoursEnabled?: boolean;
  workHoursStart?: string; // HH:MM
  workHoursEnd?: string; // HH:MM
  
  // Рабочие дни (0 = Воскресенье, 1 = Понедельник, ..., 6 = Суббота)
  workDaysEnabled?: boolean;
  workDays?: number[];
  
  // Периодичность (для SCHEDULED)
  recurrence?: RecurrenceType;
  recurrenceEndDate?: string; // ISO datetime
  
  // Таймзона
  timezone?: string;
}

/**
 * Конфигурация фильтров базы клиентов
 */
export interface FilterConfig {
  // Фильтр по регионам
  regionIds?: string[];
  
  // Фильтр по статусу клиента
  clientStatuses?: string[];
  
  // Фильтр по статусу телефона в мессенджерах
  whatsAppStatus?: string[];
  telegramStatus?: string[];
  
  // Фильтр по дате последней кампании
  lastCampaignBefore?: string;
  lastCampaignAfter?: string;
  neverCampaigned?: boolean;
  
  // Фильтр по количеству кампаний
  maxCampaignCount?: number;
  
  // Ограничение количества контактов
  limitContacts?: number;
  
  // Случайный порядок
  randomOrder?: boolean;
}

/**
 * Дополнительные опции кампании
 */
export interface OptionsConfig {
  // Дедупликация
  deduplicationEnabled?: boolean;
  deduplicationPeriodDays?: number;
  deduplicationCampaignIds?: string[];
  
  // Cooldown между кампаниями
  cooldownEnabled?: boolean;
  cooldownMinutes?: number;
  
  // Rate limiting с прогревом
  warmupEnabled?: boolean;
  warmupStartRate?: number;
  warmupTargetRate?: number;
  warmupDurationHours?: number;
  
  // Автовозобновление после рестарта сервера
  autoResumeEnabled?: boolean;
  
  // Остановка при ошибках
  stopOnErrorThreshold?: number;
  stopOnConsecutiveErrors?: number;
}

// ============================================
// Main Models
// ============================================

/**
 * Группа клиентов (краткая информация)
 */
export interface ClientGroupBrief {
  id: string;
  name: string;
  clientCount?: number;
}

/**
 * Профиль (краткая информация)
 */
export interface ProfileBrief {
  id: string;
  name: string;
  status?: string;
  isAvailable?: boolean;
}

/**
 * Профиль в кампании
 */
export interface CampaignProfile {
  id: string;
  campaignId: string;
  profileId: string;
  profile?: ProfileBrief;
  
  // Распределение нагрузки
  assignedCount: number;
  processedCount: number;
  successCount: number;
  failedCount: number;
  
  // Статус
  status: CampaignProfileStatus;
  lastError: string | null;
  
  createdAt: string;
  updatedAt: string;
}

/**
 * Сообщение кампании
 */
export interface CampaignMessage {
  id: string;
  campaignId: string;
  
  // Получатель
  clientId: string;
  clientPhoneId: string;
  clientName?: string;
  phoneNumber?: string;
  
  // Исполнитель
  profileId: string | null;
  profileName?: string;
  
  // Мессенджер и статус
  messenger: MessengerType | null;
  status: MessageStatus;
  
  // Для Multi-шаблонов
  messagesSent: number;
  totalMessages: number;
  
  // Обработка ошибок
  errorMessage: string | null;
  retryCount: number;
  
  // Временные метки
  scheduledAt: string | null;
  sentAt: string | null;
  
  createdAt: string;
  updatedAt: string;
}

/**
 * Лог события кампании
 */
export interface CampaignLog {
  id: string;
  campaignId: string;
  
  level: LogLevel;
  action: string;
  message: string;
  metadata: string | null;
  
  createdAt: string;
}

/**
 * Кампания рассылок
 */
export interface Campaign {
  id: string;
  userId: string;
  
  name: string;
  description: string | null;
  
  // Связи
  templateId: string;
  template?: Template;
  clientGroupId: string;
  clientGroup?: ClientGroupBrief;
  
  // Настройки типа
  campaignType: CampaignType;
  messengerType: MessengerTarget;
  universalTarget: UniversalTarget | null;
  
  // Статус
  status: CampaignStatus;
  
  // Прогресс выполнения
  totalContacts: number;
  processedContacts: number;
  successfulContacts: number;
  failedContacts: number;
  skippedContacts: number;
  
  // Конфигурации (parsed JSON)
  scheduleConfig: ScheduleConfig | null;
  filterConfig: FilterConfig | null;
  optionsConfig: OptionsConfig | null;
  
  // Временные метки
  scheduledAt: string | null;
  startedAt: string | null;
  pausedAt: string | null;
  completedAt: string | null;
  archivedAt: string | null;
  
  createdAt: string;
  updatedAt: string;
  
  // Связи (опционально загружаемые)
  profiles?: CampaignProfile[];
  _count?: {
    profiles: number;
    messages: number;
    logs: number;
  };
}

// ============================================
// Progress & Stats
// ============================================

/**
 * Прогресс выполнения кампании
 */
export interface CampaignProgress {
  campaignId: string;
  status: CampaignStatus;
  
  // Счётчики
  totalContacts: number;
  processedContacts: number;
  successfulContacts: number;
  failedContacts: number;
  skippedContacts: number;
  
  // Процент завершения
  progressPercent: number;
  
  // Скорость и ETA
  contactsPerMinute: number;
  estimatedSecondsRemaining: number | null;
  estimatedCompletionTime: string | null;
  
  // Прогресс по профилям
  profilesProgress: Array<{
    profileId: string;
    profileName: string;
    status: CampaignProfileStatus;
    assignedCount: number;
    processedCount: number;
    successCount: number;
    failedCount: number;
    progressPercent: number;
  }>;
  
  // Временные метки
  startedAt: string | null;
  lastUpdateAt: string;
}

/**
 * Статистика кампании
 */
export interface CampaignStats {
  campaignId: string;
  name: string;
  status: string;
  
  // Общая статистика
  totalContacts: number;
  processedContacts: number;
  successfulContacts: number;
  failedContacts: number;
  skippedContacts: number;
  
  // Процентные показатели
  progress: number;
  successRate: number;
  failureRate: number;
  skipRate: number;
  
  // Временные метрики
  startedAt: string | null;
  completedAt: string | null;
  duration: number | null; // в секундах
  avgContactTime: number | null; // среднее время на контакт в секундах
  
  // Статистика по мессенджерам
  byMessenger: {
    whatsapp: {
      total: number;
      sent: number;
      failed: number;
      skipped: number;
      successRate: number;
    };
    telegram: {
      total: number;
      sent: number;
      failed: number;
      skipped: number;
      successRate: number;
    };
    unknown: {
      total: number;
      sent: number;
      failed: number;
      skipped: number;
      successRate: number;
    };
  };
  
  // Статистика по профилям
  byProfile: Array<{
    profileId: string;
    profileName: string;
    assignedCount: number;
    processedCount: number;
    successCount: number;
    failedCount: number;
    progress: number;
    successRate: number;
  }>;
  
  // Ошибки
  errorCount: number;
  topErrors: Array<{
    error: string;
    count: number;
    percentage: number;
  }>;
}

// ============================================
// API Input Types
// ============================================

/**
 * Данные для создания кампании
 */
export interface CreateCampaignInput {
  name: string;
  description?: string | null;
  templateId: string;
  clientGroupId: string;
  campaignType: CampaignType;
  messengerType: MessengerTarget;
  universalTarget?: UniversalTarget | null;
  profileIds: string[];
  scheduleConfig?: ScheduleConfig;
  filterConfig?: FilterConfig;
  optionsConfig?: OptionsConfig;
  scheduledAt?: string | null;
}

/**
 * Данные для обновления кампании
 */
export interface UpdateCampaignInput {
  name?: string;
  description?: string | null;
  templateId?: string;
  clientGroupId?: string;
  messengerType?: MessengerTarget;
  universalTarget?: UniversalTarget | null;
  scheduleConfig?: ScheduleConfig;
  filterConfig?: FilterConfig;
  optionsConfig?: OptionsConfig;
  scheduledAt?: string | null;
}

/**
 * Данные для запуска кампании
 */
export interface StartCampaignInput {
  profileIds?: string[];
  force?: boolean;
}

/**
 * Данные для дублирования кампании
 */
export interface DuplicateCampaignInput {
  name?: string;
}

/**
 * Данные для обновления профилей кампании
 */
export interface UpdateCampaignProfilesInput {
  profileIds: string[];
}

// ============================================
// API Query Types
// ============================================

/**
 * Query параметры для списка кампаний
 */
export interface ListCampaignsQuery {
  page?: number;
  limit?: number;
  status?: CampaignStatus | CampaignStatus[];
  campaignType?: CampaignType;
  messengerType?: MessengerTarget;
  search?: string;
  sortBy?: 'createdAt' | 'updatedAt' | 'name' | 'scheduledAt' | 'startedAt';
  sortOrder?: 'asc' | 'desc';
  includeArchived?: boolean;
}

/**
 * Query параметры для списка сообщений кампании
 */
export interface ListMessagesQuery {
  page?: number;
  limit?: number;
  status?: MessageStatus | MessageStatus[];
  messenger?: MessengerType;
  profileId?: string;
}

/**
 * Query параметры для списка логов кампании
 */
export interface ListLogsQuery {
  page?: number;
  limit?: number;
  level?: LogLevel | LogLevel[];
  action?: string;
}

// ============================================
// API Response Types
// ============================================

/**
 * Ответ со списком кампаний
 */
export interface CampaignsListResponse {
  data: Campaign[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

/**
 * Кампания для админ-списка (с данными пользователя)
 */
export interface AdminCampaign extends Campaign {
  user?: {
    id: string;
    email: string;
    name: string | null;
  };
}

export interface AdminCampaignsListResponse {
  data: AdminCampaign[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

/**
 * Ответ со списком сообщений
 */
export interface MessagesListResponse {
  data: CampaignMessage[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

/**
 * Ответ со списком логов
 */
export interface LogsListResponse {
  data: CampaignLog[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

/**
 * Результат валидации кампании
 */
export interface CampaignValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  contactsCount: number;
  profilesValid: boolean;
  templateValid: boolean;
  groupValid: boolean;
}

/**
 * Результат расчёта контактов
 */
export interface CalculatedContacts {
  clientIds: string[];
  totalCount: number;
  byMessenger: {
    whatsapp: number;
    telegram: number;
  };
}

// ============================================
// Admin Settings Types
// ============================================

/**
 * Глобальные настройки кампаний (ROOT)
 */
export interface CampaignGlobalSettings {
  id: string;
  
  // Режим паузы: 1 = между номерами, 2 = между клиентами
  pauseMode: 1 | 2;
  
  // Тайминги (в миллисекундах)
  minDelayBetweenContactsMs: number;
  maxDelayBetweenContactsMs: number;
  minDelayBetweenMessagesMs: number;
  maxDelayBetweenMessagesMs: number;
  
  // Лимиты
  maxContactsPerProfilePerHour: number;
  maxContactsPerProfilePerDay: number;
  
  // Рабочее время по умолчанию
  defaultWorkHoursStart: string;
  defaultWorkHoursEnd: string;
  defaultWorkDays: number[];
  
  // Имитация набора
  typingSimulationEnabled: boolean;
  typingSpeedCharsPerSec: number;
  
  // Обработка ошибок
  maxRetriesOnError: number;
  retryDelayMs: number;
  pauseOnCriticalError: boolean;
  
  // Мониторинг
  profileHealthCheckIntervalMs: number;
  autoResumeAfterRestart: boolean;
  
  // Хранение
  keepCompletedCampaignsDays: number;
  
  // Прогрев профилей
  warmupEnabled: boolean;
  warmupDay1To3Limit: number;
  warmupDay4To7Limit: number;
  
  updatedAt: string;
  updatedBy: string | null;
}

/**
 * Лимиты кампаний для пользователя
 */
export interface UserCampaignLimits {
  id: string;
  userId: string;
  
  // Лимиты кампаний
  maxActiveCampaigns: number;
  maxTemplates: number;
  maxTemplateCategories: number;
  
  // Лимиты файлов
  maxFileSizeMb: number;
  maxTotalStorageMb: number;
  
  // Разрешения
  allowScheduledCampaigns: boolean;
  allowUniversalCampaigns: boolean;
  
  createdAt: string;
  updatedAt: string;
  updatedBy: string | null;
}

/**
 * Данные для обновления глобальных настроек
 */
export interface UpdateGlobalSettingsInput {
  pauseMode?: 1 | 2;
  minDelayBetweenContactsMs?: number;
  maxDelayBetweenContactsMs?: number;
  minDelayBetweenMessagesMs?: number;
  maxDelayBetweenMessagesMs?: number;
  maxContactsPerProfilePerHour?: number;
  maxContactsPerProfilePerDay?: number;
  defaultWorkHoursStart?: string;
  defaultWorkHoursEnd?: string;
  defaultWorkDays?: number[];
  typingSimulationEnabled?: boolean;
  typingSpeedCharsPerSec?: number;
  maxRetriesOnError?: number;
  retryDelayMs?: number;
  pauseOnCriticalError?: boolean;
  profileHealthCheckIntervalMs?: number;
  autoResumeAfterRestart?: boolean;
  keepCompletedCampaignsDays?: number;
  warmupEnabled?: boolean;
  warmupDay1To3Limit?: number;
  warmupDay4To7Limit?: number;
}

/**
 * Данные для обновления лимитов пользователя (ROOT)
 */
export interface SetUserLimitsInput {
  maxActiveCampaigns?: number;
  maxTemplates?: number;
  maxTemplateCategories?: number;
  maxFileSizeMb?: number;
  maxTotalStorageMb?: number;
  allowScheduledCampaigns?: boolean;
  allowUniversalCampaigns?: boolean;
}

/**
 * Данные для обновления лимитов пользователя
 */
export interface UpdateUserLimitsInput {
  maxActiveCampaigns?: number;
  maxTemplates?: number;
  maxTemplateCategories?: number;
  maxFileSizeMb?: number;
  maxTotalStorageMb?: number;
  allowScheduledCampaigns?: boolean;
  allowUniversalCampaigns?: boolean;
}

// ============================================
// Constants
// ============================================

/**
 * Метки статусов кампании
 */
export const CAMPAIGN_STATUS_LABELS: Record<CampaignStatus, string> = {
  DRAFT: 'Черновик',
  SCHEDULED: 'Запланирована',
  QUEUED: 'В очереди',
  RUNNING: 'Выполняется',
  PAUSED: 'На паузе',
  COMPLETED: 'Завершена',
  CANCELLED: 'Отменена',
  ERROR: 'Ошибка',
};

/**
 * Цвета статусов кампании
 */
export const CAMPAIGN_STATUS_COLORS: Record<CampaignStatus, 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info'> = {
  DRAFT: 'default',
  SCHEDULED: 'info',
  QUEUED: 'info',
  RUNNING: 'primary',
  PAUSED: 'warning',
  COMPLETED: 'success',
  CANCELLED: 'default',
  ERROR: 'error',
};

/**
 * Метки типов кампании
 */
export const CAMPAIGN_TYPE_LABELS: Record<CampaignType, string> = {
  ONE_TIME: 'Одноразовая',
  SCHEDULED: 'Запланированная',
};

/**
 * Метки целевых мессенджеров
 */
export const MESSENGER_TARGET_LABELS: Record<MessengerTarget, string> = {
  WHATSAPP_ONLY: 'Только WhatsApp',
  TELEGRAM_ONLY: 'Только Telegram',
  UNIVERSAL: 'Универсальная',
};

/**
 * Метки универсальных целей
 */
export const UNIVERSAL_TARGET_LABELS: Record<UniversalTarget, string> = {
  BOTH: 'Оба мессенджера',
  WHATSAPP_FIRST: 'Сначала WhatsApp',
  TELEGRAM_FIRST: 'Сначала Telegram',
};

/**
 * Метки статусов сообщений
 */
export const MESSAGE_STATUS_LABELS: Record<MessageStatus, string> = {
  PENDING: 'Ожидает',
  PROCESSING: 'Обрабатывается',
  SENT: 'Отправлено',
  FAILED: 'Ошибка',
  SKIPPED: 'Пропущено',
};

/**
 * Цвета статусов сообщений
 */
export const MESSAGE_STATUS_COLORS: Record<MessageStatus, 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info'> = {
  PENDING: 'default',
  PROCESSING: 'info',
  SENT: 'success',
  FAILED: 'error',
  SKIPPED: 'warning',
};

/**
 * Метки уровней логов
 */
export const LOG_LEVEL_LABELS: Record<LogLevel, string> = {
  INFO: 'Информация',
  WARNING: 'Предупреждение',
  ERROR: 'Ошибка',
};

/**
 * Цвета уровней логов
 */
export const LOG_LEVEL_COLORS: Record<LogLevel, 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info'> = {
  INFO: 'info',
  WARNING: 'warning',
  ERROR: 'error',
};

/**
 * Метки статусов профилей в кампании
 */
export const CAMPAIGN_PROFILE_STATUS_LABELS: Record<CampaignProfileStatus, string> = {
  PENDING: 'Ожидает',
  RUNNING: 'Работает',
  COMPLETED: 'Завершил',
  ERROR: 'Ошибка',
};

/**
 * Цвета статусов профилей в кампании
 */
export const CAMPAIGN_PROFILE_STATUS_COLORS: Record<CampaignProfileStatus, 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info'> = {
  PENDING: 'default',
  RUNNING: 'primary',
  COMPLETED: 'success',
  ERROR: 'error',
};

/**
 * Метки периодичности
 */
export const RECURRENCE_LABELS: Record<RecurrenceType, string> = {
  NONE: 'Без повтора',
  DAILY: 'Ежедневно',
  WEEKLY: 'Еженедельно',
  MONTHLY: 'Ежемесячно',
};

/**
 * Дни недели
 */
export const WEEK_DAYS = [
  { value: 0, label: 'Вс' },
  { value: 1, label: 'Пн' },
  { value: 2, label: 'Вт' },
  { value: 3, label: 'Ср' },
  { value: 4, label: 'Чт' },
  { value: 5, label: 'Пт' },
  { value: 6, label: 'Сб' },
];

