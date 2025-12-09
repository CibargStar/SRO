/**
 * Notification Dispatcher Service
 *
 * Диспетчер уведомлений, который выбирает канал доставки (Telegram, WebSocket)
 * и проверяет настройки пользователя перед отправкой.
 *
 * @module modules/telegram-bot/notification-dispatcher.service
 */

import { PrismaClient } from '@prisma/client';
import logger from '../../config/logger';
import { UserBotManagerService } from './user-bot-manager.service';
import { WebSocketServer, WsEventType } from '../websocket';

export type NotificationType =
  | 'campaign_started'
  | 'campaign_completed'
  | 'campaign_error'
  | 'campaign_progress_50'
  | 'campaign_progress_75'
  | 'campaign_progress_90'
  | 'campaign_status'
  | 'profile_issue'
  | 'login_required';

export interface NotificationPayload {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  campaignId?: string;
  campaignName?: string;
  profileId?: string;
  metadata?: Record<string, unknown>;
}

export class NotificationDispatcherService {
  constructor(
    private prisma: PrismaClient,
    private botManager: UserBotManagerService,
    private wsServer?: WebSocketServer
  ) {}

  /**
   * Отправка уведомления через выбранные каналы
   */
  async dispatch(payload: NotificationPayload): Promise<void> {
    try {
      // Проверяем настройки пользователя
      const settings = await this.prisma.userTelegramBot.findUnique({
        where: { userId: payload.userId },
      });

      // Проверяем, включено ли уведомление этого типа
      if (!this.shouldNotify(settings, payload.type)) {
        logger.debug('Notification skipped due to user settings', {
          userId: payload.userId,
          type: payload.type,
        });
        return;
      }

      // Форматируем сообщение
      const formattedMessage = this.formatMessage(payload);

      // Отправка через Telegram (если настроен)
      if (settings?.isVerified && settings.chatId) {
        await this.botManager.sendNotification(payload.userId, formattedMessage).catch((error) => {
          logger.error('Failed to send Telegram notification', {
            userId: payload.userId,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        });
      }

      // Отправка через WebSocket (всегда, если подключен)
      if (this.wsServer) {
        this.wsServer.sendToUser(payload.userId, WsEventType.PROFILE_ALERT, {
          type: payload.type,
          severity: payload.type.includes('error') ? 'error' : 'info',
          title: payload.title,
          message: payload.message,
          campaignId: payload.campaignId,
          profileId: payload.profileId,
          metadata: payload.metadata,
        });
      }
    } catch (error) {
      logger.error('Failed to dispatch notification', {
        userId: payload.userId,
        type: payload.type,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Проверка, нужно ли отправлять уведомление по настройкам пользователя
   */
  private shouldNotify(
    settings: { [key: string]: unknown } | null,
    type: NotificationType
  ): boolean {
    if (!settings || !settings.isVerified) {
      return false;
    }

    switch (type) {
      case 'campaign_started':
        return Boolean(settings.notifyOnStart);
      case 'campaign_completed':
        return Boolean(settings.notifyOnComplete);
      case 'campaign_error':
        return Boolean(settings.notifyOnError);
      case 'campaign_progress_50':
        return Boolean(settings.notifyOnProgress50);
      case 'campaign_progress_75':
        return Boolean(settings.notifyOnProgress75);
      case 'campaign_progress_90':
        return Boolean(settings.notifyOnProgress90);
      case 'profile_issue':
        return Boolean(settings.notifyOnProfileIssue);
      case 'login_required':
        return Boolean(settings.notifyOnLoginRequired);
      default:
        return false;
    }
  }

  /**
   * Форматирование сообщения для Telegram
   */
  private formatMessage(payload: NotificationPayload): string {
    const { type, title, message, campaignName } = payload;

    let emoji = '📢';
    switch (type) {
      case 'campaign_started':
        emoji = '🚀';
        break;
      case 'campaign_completed':
        emoji = '✅';
        break;
      case 'campaign_error':
        emoji = '❌';
        break;
      case 'campaign_progress_50':
      case 'campaign_progress_75':
      case 'campaign_progress_90':
        emoji = '📊';
        break;
      case 'profile_issue':
        emoji = '⚠️';
        break;
      case 'login_required':
        emoji = '🔐';
        break;
    }

    if (campaignName) {
      return `${emoji} <b>${title}</b>\n${message}`;
    }

    return `${emoji} <b>${title}</b>\n${message}`;
  }

  /**
   * Уведомление о запуске кампании
   */
  async notifyCampaignStarted(
    userId: string,
    campaignId: string,
    campaignName: string
  ): Promise<void> {
    await this.dispatch({
      userId,
      type: 'campaign_started',
      title: 'Кампания запущена',
      message: `Кампания "${campaignName}" успешно запущена.`,
      campaignId,
      campaignName,
    });
  }

  /**
   * Уведомление об изменении статуса кампании
   */
  async notifyCampaignStatus(
    userId: string,
    campaignId: string,
    campaignName: string,
    status: 'PAUSED' | 'RUNNING' | 'CANCELLED',
    reason?: string
  ): Promise<void> {
    const readable =
      status === 'PAUSED' ? 'поставлена на паузу' : status === 'RUNNING' ? 'возобновлена' : 'отменена';
    const title =
      status === 'PAUSED' ? 'Кампания на паузе' : status === 'RUNNING' ? 'Кампания возобновлена' : 'Кампания отменена';
    const reasonText = reason ? ` Причина: ${reason}` : '';

    await this.dispatch({
      userId,
      type: 'campaign_status',
      title,
      message: `Кампания "${campaignName}" ${readable}.${reasonText}`,
      campaignId,
      campaignName,
      metadata: { status, reason },
    });
  }

  /**
   * Уведомление о завершении кампании
   */
  async notifyCampaignCompleted(
    userId: string,
    campaignId: string,
    campaignName: string,
    stats?: {
      total: number;
      successful: number;
      failed: number;
      skipped: number;
    }
  ): Promise<void> {
    let message = `Кампания "${campaignName}" завершена.`;
    if (stats) {
      message += `\n\n📊 Статистика:\n`;
      message += `├── Всего: ${stats.total} контактов\n`;
      message += `├── ✅ Успешно: ${stats.successful} (${((stats.successful / stats.total) * 100).toFixed(1)}%)\n`;
      message += `├── ❌ Ошибки: ${stats.failed} (${((stats.failed / stats.total) * 100).toFixed(1)}%)\n`;
      message += `└── ⏭️ Пропущено: ${stats.skipped} (${((stats.skipped / stats.total) * 100).toFixed(1)}%)`;
    }

    await this.dispatch({
      userId,
      type: 'campaign_completed',
      title: 'Кампания завершена',
      message,
      campaignId,
      campaignName,
      metadata: stats,
    });
  }

  /**
   * Уведомление об ошибке кампании
   */
  async notifyCampaignError(
    userId: string,
    campaignId: string,
    campaignName: string,
    error: string
  ): Promise<void> {
    await this.dispatch({
      userId,
      type: 'campaign_error',
      title: 'Ошибка кампании',
      message: `Кампания "${campaignName}" завершилась с ошибкой:\n${error}`,
      campaignId,
      campaignName,
      metadata: { error },
    });
  }

  /**
   * Уведомление о прогрессе кампании
   */
  async notifyCampaignProgress(
    userId: string,
    campaignId: string,
    campaignName: string,
    progress: number
  ): Promise<void> {
    let type: NotificationType = 'campaign_progress_50';
    if (progress >= 90) {
      type = 'campaign_progress_90';
    } else if (progress >= 75) {
      type = 'campaign_progress_75';
    }

    await this.dispatch({
      userId,
      type,
      title: 'Прогресс кампании',
      message: `Кампания "${campaignName}": ${progress}% выполнено`,
      campaignId,
      campaignName,
      metadata: { progress },
    });
  }

  /**
   * Уведомление о проблеме с профилем
   */
  async notifyProfileIssue(
    userId: string,
    profileId: string,
    profileName: string,
    issue: string
  ): Promise<void> {
    await this.dispatch({
      userId,
      type: 'profile_issue',
      title: 'Проблема с профилем',
      message: `Профиль "${profileName}": ${issue}`,
      profileId,
      metadata: { issue },
    });
  }

  /**
   * Уведомление о необходимости повторного входа
   */
  async notifyLoginRequired(
    userId: string,
    profileId: string,
    profileName: string,
    messenger: 'whatsapp' | 'telegram'
  ): Promise<void> {
    await this.dispatch({
      userId,
      type: 'login_required',
      title: 'Требуется вход в мессенджер',
      message: `Профиль "${profileName}": требуется повторный вход в ${messenger === 'whatsapp' ? 'WhatsApp' : 'Telegram'}`,
      profileId,
      metadata: { messenger },
    });
  }
}

