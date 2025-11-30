/**
 * TypeScript типы для модуля управления профилями Chrome
 * 
 * Определяет все типы данных, используемые в модуле профилей.
 */

/**
 * Статус профиля
 */
export type ProfileStatus = 'STOPPED' | 'RUNNING' | 'STARTING' | 'STOPPING' | 'ERROR';

/**
 * Основная модель профиля
 */
export interface Profile {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  profilePath: string;
  status: ProfileStatus;
  headless: boolean; // Режим работы: true = без UI, false = с UI
  createdAt: string;
  updatedAt: string;
  lastActiveAt: string | null;
}

/**
 * Query параметры для списка профилей
 */
export interface ListProfilesQuery {
  page?: number;
  limit?: number;
  status?: ProfileStatus;
  sortBy?: 'createdAt' | 'updatedAt' | 'name' | 'status' | 'lastActiveAt';
  sortOrder?: 'asc' | 'desc';
}

/**
 * Ответ со списком профилей (с пагинацией)
 */
export interface ProfilesListResponse {
  data: Profile[];
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
 * Статус профиля (краткий)
 */
export interface ProfileStatusResponse {
  id: string;
  status: ProfileStatus;
  lastActiveAt: string | null;
}

/**
 * Статистика ресурсов процесса
 */
export interface ProcessResourceStats {
  profileId: string;
  pid: number;
  cpuUsage: number;
  memoryUsage: number;
  memoryUsagePercent: number;
  timestamp: string;
}

/**
 * История статистики ресурсов
 */
export interface ResourceStatsHistory {
  profileId: string;
  timestamp: string;
  stats: {
    cpuUsage: number;
    memoryUsage: number;
  };
}

/**
 * Ответ с историей ресурсов
 */
export interface ProfileResourcesHistoryResponse {
  profileId: string;
  history: ResourceStatsHistory[];
  count: number;
}

/**
 * Статистика сетевой активности
 */
export interface NetworkStats {
  profileId: string;
  pid: number;
  bytesReceived: number;
  bytesSent: number;
  receiveRate: number;
  sendRate: number;
  connectionsCount: number;
  timestamp: string;
}

/**
 * Тип алерта
 */
export type AlertType = 
  | 'RESOURCE_LIMIT_EXCEEDED' 
  | 'PROFILE_CRASHED' 
  | 'PROFILE_RESTARTED' 
  | 'PROFILE_HEALTH_DEGRADED' 
  | 'NETWORK_LIMIT_EXCEEDED' 
  | 'PROFILE_ERROR';

/**
 * Уровень серьезности алерта
 */
export type AlertSeverity = 'info' | 'warning' | 'error' | 'critical';

/**
 * Алерт/уведомление
 */
export interface Alert {
  id: string;
  profileId: string;
  userId: string;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
  timestamp: string;
  read: boolean;
}

/**
 * Ответ со списком алертов
 */
export interface ProfileAlertsResponse {
  profileId: string;
  alerts: Alert[];
  count: number;
}

/**
 * Ответ с количеством непрочитанных алертов
 */
export interface ProfileUnreadAlertsCountResponse {
  profileId: string;
  unreadCount: number;
}

/**
 * Статус здоровья профиля
 */
export type ProfileHealthStatus = 'healthy' | 'unhealthy' | 'degraded' | 'unknown';

/**
 * Проверка здоровья профиля
 */
export interface ProfileHealthCheck {
  profileId: string;
  status: ProfileHealthStatus;
  timestamp: string;
  details: {
    processRunning: boolean;
    browserConnected: boolean;
    cpuUsage?: number;
    memoryUsage?: number;
    resourceLimitsExceeded?: boolean;
  };
}

/**
 * Период агрегации
 */
export type AggregationPeriod = 'hour' | 'day' | 'week' | 'month';

/**
 * Агрегированная статистика ресурсов
 */
export interface AggregatedResourceStats {
  period: AggregationPeriod;
  periodStart: string;
  periodEnd: string;
  avgCpuUsage: number;
  maxCpuUsage: number;
  minCpuUsage: number;
  avgMemoryUsage: number;
  maxMemoryUsage: number;
  minMemoryUsage: number;
  sampleCount: number;
}

/**
 * Агрегированная статистика сетевой активности
 */
export interface AggregatedNetworkStats {
  period: AggregationPeriod;
  periodStart: string;
  periodEnd: string;
  totalBytesReceived: number;
  totalBytesSent: number;
  avgReceiveRate: number;
  maxReceiveRate: number;
  avgSendRate: number;
  maxSendRate: number;
  avgConnectionsCount: number;
  sampleCount: number;
}

/**
 * Аналитика профиля
 */
export interface ProfileAnalytics {
  profileId: string;
  resourceStats: AggregatedResourceStats[];
  networkStats: AggregatedNetworkStats[];
  period: AggregationPeriod;
  from: string;
  to: string;
}

/**
 * Информация о Chrome процессе
 */
export interface ChromeProcessInfo {
  pid: number;
  startedAt: string;
}

/**
 * Ответ при запуске профиля
 */
export interface StartProfileResponse {
  profileId: string;
  status: ProfileStatus;
  processInfo: ChromeProcessInfo;
}

/**
 * Лимиты профилей для пользователя
 */
export interface ProfileLimits {
  userId: string;
  maxProfiles: number;
  maxCpuPerProfile: number | null;
  maxMemoryPerProfile: number | null;
  maxNetworkPerProfile: number | null;
  createdAt?: string;
  updatedAt?: string;
  updatedBy?: string | null;
}

/**
 * Данные для создания профиля
 */
export interface CreateProfileInput {
  name: string;
  description?: string | null;
  headless?: boolean; // По умолчанию true
}

/**
 * Данные для обновления профиля
 */
export interface UpdateProfileInput {
  name?: string;
  description?: string | null;
  headless?: boolean;
}

/**
 * Опции запуска профиля
 */
export interface StartProfileOptions {
  headless?: boolean;
  args?: string[];
}

/**
 * Данные для установки лимитов профилей
 */
export interface SetProfileLimitsInput {
  maxProfiles: number;
  maxCpuPerProfile?: number | null;
  maxMemoryPerProfile?: number | null;
  maxNetworkPerProfile?: number | null;
}

