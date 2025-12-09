import { WebSocketServer, WsEventType } from '../../websocket';
import { CampaignStats } from '../stats/campaign-stats.service';
import { NotificationDispatcherService } from '../../telegram-bot';

export class CampaignNotificationService {
  constructor(
    private wsServer?: WebSocketServer,
    private dispatcher?: NotificationDispatcherService
  ) {}

  setDispatcher(dispatcher?: NotificationDispatcherService): void {
    this.dispatcher = dispatcher;
  }

  setWebSocketServer(ws?: WebSocketServer): void {
    this.wsServer = ws;
  }

  async notifyStarted(userId: string, campaignId: string, campaignName: string): Promise<void> {
    this.wsServer?.emitCampaignEvent(campaignId, userId, WsEventType.CAMPAIGN_STATUS, {
      campaignId,
      status: 'RUNNING',
    });
    await this.dispatcher?.notifyCampaignStarted(userId, campaignId, campaignName);
  }

  async notifyStatus(
    userId: string,
    campaignId: string,
    status: 'PAUSED' | 'RUNNING' | 'CANCELLED',
    campaignName?: string,
    reason?: string
  ): Promise<void> {
    this.wsServer?.emitCampaignEvent(campaignId, userId, WsEventType.CAMPAIGN_STATUS, {
      campaignId,
      status,
      reason,
    });
    if (!this.dispatcher || !campaignName) return;
    await this.dispatcher.notifyCampaignStatus(userId, campaignId, campaignName, status, reason);
  }

  async notifyCompleted(
    userId: string,
    campaignId: string,
    campaignName: string,
    stats: CampaignStats
  ): Promise<void> {
    this.wsServer?.emitCampaignEvent(campaignId, userId, WsEventType.CAMPAIGN_COMPLETED, {
      campaignId,
      stats,
    });
    await this.dispatcher?.notifyCampaignCompleted(userId, campaignId, campaignName, {
      total: stats.totalContacts,
      successful: stats.successfulContacts,
      failed: stats.failedContacts,
      skipped: stats.skippedContacts,
    });
  }

  async notifyProgress(
    userId: string,
    campaignId: string,
    campaignName: string,
    progress: number
  ): Promise<void> {
    this.wsServer?.emitCampaignEvent(campaignId, userId, WsEventType.CAMPAIGN_PROGRESS, {
      campaignId,
      progress,
    });
    await this.dispatcher?.notifyCampaignProgress(userId, campaignId, campaignName, progress);
  }

  async notifyError(userId: string, campaignId: string, campaignName: string, error: string): Promise<void> {
    this.wsServer?.emitCampaignEvent(campaignId, userId, WsEventType.CAMPAIGN_ERROR, {
      campaignId,
      error,
    });
    await this.dispatcher?.notifyCampaignError(userId, campaignId, campaignName, error);
  }
}

