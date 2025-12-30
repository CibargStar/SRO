/**
 * Типы для WebSocket событий
 * 
 * Соответствуют типам из backend/src/modules/websocket/websocket.types.ts
 */

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
  previousStatus?: string;
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
 * Payload для события завершения кампании
 */
export interface CampaignCompletedPayload {
  campaignId: string;
}








