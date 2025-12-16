/**
 * Типы для WebSocket модуля
 */

/**
 * Типы WebSocket событий
 */
export enum WsEventType {
  // Системные события
  CONNECT = 'connect',
  DISCONNECT = 'disconnect',
  ERROR = 'error',
  PING = 'ping',
  PONG = 'pong',
  
  // Подписки на комнаты
  SUBSCRIBE = 'subscribe',
  UNSUBSCRIBE = 'unsubscribe',
  
  // События профилей
  PROFILE_STATUS = 'profile:status',
  PROFILE_RESOURCES = 'profile:resources',
  PROFILE_HEALTH = 'profile:health',
  PROFILE_ALERT = 'profile:alert',
  
  // События мессенджеров
  MESSENGER_STATUS = 'messenger:status',
  
  // События кампаний
  CAMPAIGN_STATUS = 'campaign:status',
  CAMPAIGN_PROGRESS = 'campaign:progress',
  CAMPAIGN_MESSAGE = 'campaign:message',
  CAMPAIGN_ERROR = 'campaign:error',
  CAMPAIGN_COMPLETED = 'campaign:completed',
}

/**
 * Типы комнат
 */
export enum WsRoomType {
  // Комната пользователя (получает все события своих ресурсов)
  USER = 'user',
  // Комната профиля
  PROFILE = 'profile',
  // Комната кампании
  CAMPAIGN = 'campaign',
  // Комната администратора (ROOT) - получает все события
  ADMIN = 'admin',
}

/**
 * Базовое WebSocket сообщение
 */
export interface WsMessage<T = unknown> {
  type: WsEventType | string;
  payload: T;
  timestamp: string;
  // ID комнаты (опционально, для broadcast)
  room?: string;
}

/**
 * Сообщение подписки на комнату
 */
export interface WsSubscribeMessage {
  room: string;
}

/**
 * Сообщение отписки от комнаты
 */
export interface WsUnsubscribeMessage {
  room: string;
}

/**
 * Информация о подключенном клиенте
 */
export interface WsClientInfo {
  id: string;
  userId: string;
  userRole: string;
  connectedAt: Date;
  lastPingAt: Date;
  rooms: Set<string>;
}

/**
 * Payload для события статуса профиля
 */
export interface ProfileStatusPayload {
  profileId: string;
  status: string;
  lastActiveAt: string | null;
}

/**
 * Payload для события ресурсов профиля
 */
export interface ProfileResourcesPayload {
  profileId: string;
  pid: number;
  cpuUsage: number;
  memoryUsage: number;
  memoryUsagePercent: number;
  timestamp: string;
}

/**
 * Payload для события здоровья профиля
 */
export interface ProfileHealthPayload {
  profileId: string;
  status: string;
  details: {
    processRunning: boolean;
    browserConnected: boolean;
    cpuUsage?: number;
    memoryUsage?: number;
    resourceLimitsExceeded?: boolean;
  };
}

/**
 * Payload для события статуса мессенджера
 */
export interface MessengerStatusPayload {
  profileId: string;
  serviceId: string;
  serviceName: string;
  status: string;
  lastCheckedAt: string | null;
}

/**
 * Payload для события прогресса кампании
 */
export interface CampaignProgressPayload {
  campaignId: string;
  totalContacts: number;
  processedContacts: number;
  successfulContacts: number;
  failedContacts: number;
  skippedContacts: number;
  percentComplete: number;
  eta: string | null;
  speed: number;
}

/**
 * Payload для события статуса кампании
 */
export interface CampaignStatusPayload {
  campaignId: string;
  status: string;
  previousStatus: string;
}

/**
 * Payload для события сообщения кампании
 */
export interface CampaignMessagePayload {
  campaignId: string;
  messageId: string;
  clientId: string;
  phoneId: string;
  status: string;
  messenger: string | null;
  errorMessage: string | null;
}

/**
 * Payload для события ошибки кампании
 */
export interface CampaignErrorPayload {
  campaignId: string;
  error: string;
  profileId?: string;
  isCritical: boolean;
}

/**
 * Payload для алерта профиля
 */
export interface ProfileAlertPayload {
  id: string;
  profileId: string;
  userId: string;
  type: string;
  severity: string;
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
  timestamp: string;
}

/**
 * Утилита для создания имени комнаты
 */
export function createRoomName(type: WsRoomType, id: string): string {
  return `${type}:${id}`;
}

/**
 * Утилита для парсинга имени комнаты
 */
export function parseRoomName(room: string): { type: string; id: string } | null {
  const parts = room.split(':');
  if (parts.length !== 2) {
    return null;
  }
  return { type: parts[0], id: parts[1] };
}




