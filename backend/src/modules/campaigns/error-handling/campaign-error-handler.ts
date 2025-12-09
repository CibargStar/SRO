/**
 * Campaign Error Handler
 *
 * Централизованная отправка ошибок кампаний в WebSocket и лог.
 * Будет расширяться интеграцией с RecoveryService, NotificationService, Telegram.
 */

import logger from '../../../config/logger';
import { WebSocketServer, WsEventType } from '../../websocket';
import { CampaignErrorPayload } from '../../websocket/websocket.types';
import { CampaignLogRepository } from '../campaigns.repository';
import { NotificationDispatcherService } from '../../telegram-bot';

export interface CampaignErrorContext {
  campaignId: string;
  userId: string;
  profileId?: string;
  isCritical?: boolean;
}

interface CampaignErrorHandlerHooks {
  onCriticalPause?: (campaignId: string) => Promise<void>;
  onProfileIssue?: (campaignId: string, profileId?: string) => Promise<void>;
  onNetworkIssue?: (campaignId: string, profileId?: string) => Promise<void>;
}

export class CampaignErrorHandler {
  constructor(
    private wsServer?: WebSocketServer,
    private logRepo?: CampaignLogRepository,
    private hooks?: CampaignErrorHandlerHooks,
    private dispatcher?: NotificationDispatcherService
  ) {}

  setDispatcher(dispatcher?: NotificationDispatcherService): void {
    this.dispatcher = dispatcher;
  }

  emitError(context: CampaignErrorContext, message: string): void {
    logger.error('Campaign error', { ...context, message });
    if (!this.wsServer) {
      return;
    }

    const payload: CampaignErrorPayload = {
      campaignId: context.campaignId,
      error: message,
      profileId: context.profileId,
      isCritical: Boolean(context.isCritical),
    };

    this.wsServer.emitCampaignEvent(
      context.campaignId,
      context.userId,
      WsEventType.CAMPAIGN_ERROR,
      payload
    );

    // Telegram/WS комбинированные уведомления
    if (this.dispatcher) {
      const campaignName = context.campaignId;
      void this.dispatcher.notifyCampaignError(context.userId, context.campaignId, campaignName, message);
    }

    // Логируем в CampaignLog (если доступен репозиторий)
    void this.logRepo?.create({
      campaignId: context.campaignId,
      level: 'ERROR',
      action: context.isCritical ? 'CRITICAL_ERROR' : 'ERROR',
      message,
      metadata: context.profileId ? JSON.stringify({ profileId: context.profileId }) : null,
    });
  }

  handleProfileError(context: CampaignErrorContext, message: string): void {
    this.emitError(context, message);
    if (this.dispatcher) {
      const profileName = context.profileId ?? 'profile';
      void this.dispatcher.notifyProfileIssue(context.userId, context.profileId ?? profileName, profileName, message);
    }
    void this.hooks?.onProfileIssue?.(context.campaignId, context.profileId);
  }

  handleMessengerError(context: CampaignErrorContext, message: string): void {
    this.emitError(context, message);
  }

  handleNetworkError(context: CampaignErrorContext, message: string): void {
    this.emitError(context, message);
    void this.hooks?.onNetworkIssue?.(context.campaignId, context.profileId);
  }

  handleCriticalError(context: CampaignErrorContext, message: string): void {
    this.emitError({ ...context, isCritical: true }, message);
    void this.hooks?.onCriticalPause?.(context.campaignId);
  }
}

let handlerInstance: CampaignErrorHandler | null = null;

export function getCampaignErrorHandler(
  wsServer?: WebSocketServer,
  logRepo?: CampaignLogRepository,
  hooks?: CampaignErrorHandlerHooks
): CampaignErrorHandler {
  handlerInstance ??= new CampaignErrorHandler(wsServer, logRepo, hooks);
  return handlerInstance;
}

