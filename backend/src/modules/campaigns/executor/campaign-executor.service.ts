/**
 * Campaign Executor Service
 *
 * Отвечает за запуск/паузу/возобновление/отмену кампаний
 * и координацию профилей через ProfileWorker.
 *
 * Использует:
 * - LoadBalancerService для распределения очереди
 * - MessageSenderService для отправки сообщений
 * - CampaignProgressService для сохранения/эмита прогресса
 * - CampaignRepository/CampaignMessageRepository для статусов
 *
 * @module modules/campaigns/executor/campaign-executor.service
 */

import EventEmitter from 'events';
import { PrismaClient, MessengerType } from '@prisma/client';
import logger from '../../../config/logger';
import {
  CampaignRepository,
  CampaignMessageRepository,
  CampaignProfileRepository,
  CampaignLogRepository,
} from '../campaigns.repository';
import { LoadBalancerService } from '../load-balancer';
import { CampaignProgressService } from '../progress';
import { CampaignStatsService } from '../stats';
import { MessageSenderService } from '../message-sender';
import { ProfileWorker } from '../profile-worker/profile-worker';
import type { ChromeProcessService } from '../../profiles/chrome-process/chrome-process.service';
import type { ProfilesService } from '../../profiles/profiles.service';
import { WebSocketServer, WsEventType } from '../../websocket';
import { CampaignProgress } from '../progress/campaign-progress.service';
import {
  CampaignMessagePayload,
  CampaignStatusPayload,
  CampaignProgressPayload,
} from '../../websocket/websocket.types';
import { getCampaignErrorHandler, CampaignErrorHandler } from '../error-handling/campaign-error-handler';
import { CampaignSettingsRepository } from '../../campaign-settings/campaign-settings.repository';
import { NotificationDispatcherService } from '../../telegram-bot';
import { CampaignNotificationService } from '../notification/campaign-notification.service';

export interface ExecutorOptions {
  // Максимальное количество сообщений за один цикл воркера
  chunkSize?: number;
}

interface WorkerContext {
  worker: ProfileWorker;
  profileId: string;
  running: boolean;
}

export class CampaignExecutorService extends EventEmitter {
  private campaignRepository: CampaignRepository;
  private messageRepository: CampaignMessageRepository;
  private profileRepository: CampaignProfileRepository;
  private loadBalancer: LoadBalancerService;
  private progressService: CampaignProgressService;
  private statsService: CampaignStatsService;
  private sender: MessageSenderService;
  private wsServer?: WebSocketServer;
  private errorHandler: CampaignErrorHandler;
  private logRepository: CampaignLogRepository;
  private settingsRepository: CampaignSettingsRepository;
  private notificationDispatcher?: NotificationDispatcherService;
  private notificationService: CampaignNotificationService;
  private profilesService?: ProfilesService;
  // Экспонируем errorHandler через getter для использования в Recovery
  getErrorHandler(): CampaignErrorHandler {
    return this.errorHandler;
  }

  /**
   * Установка ProfilesService для управления профилями
   */
  setProfilesService(profilesService: ProfilesService): void {
    this.profilesService = profilesService;
  }

  /**
   * Установка NotificationDispatcher для отправки уведомлений
   */
  setNotificationDispatcher(dispatcher: NotificationDispatcherService): void {
    this.notificationDispatcher = dispatcher;
    this.notificationService.setDispatcher(dispatcher);
    this.errorHandler.setDispatcher(dispatcher);
  }

  // Активные воркеры по кампании
  private workers: Map<string, WorkerContext[]> = new Map();

  private defaultChunkSize: number = 5;

  constructor(prisma: PrismaClient, wsServer?: WebSocketServer, chromeProcessService?: ChromeProcessService) {
    super();
    this.campaignRepository = new CampaignRepository(prisma);
    this.messageRepository = new CampaignMessageRepository(prisma);
    this.profileRepository = new CampaignProfileRepository(prisma);
    this.logRepository = new CampaignLogRepository(prisma);
    this.loadBalancer = new LoadBalancerService(prisma);
    this.progressService = new CampaignProgressService(prisma);
    this.statsService = new CampaignStatsService(prisma);
    this.sender = new MessageSenderService(chromeProcessService);
    this.wsServer = wsServer;
    this.settingsRepository = new CampaignSettingsRepository(prisma);
    this.notificationService = new CampaignNotificationService(wsServer);
    this.errorHandler = getCampaignErrorHandler(wsServer, this.logRepository, {
      onCriticalPause: async (cid: string): Promise<void> => {
        // Пытаемся аккуратно поставить кампанию на паузу
        await this.pauseCampaignSafe(cid);
      },
      onProfileIssue: async (cid: string, pid?: string): Promise<void> => {
        // Для серьёзных проблем профиля — тоже стопаем кампанию, чтобы избежать порчи статуса
        await this.pauseCampaignSafe(cid, pid);
      },
      onNetworkIssue: async (cid: string, pid?: string): Promise<void> => {
        // Сеть/разрыв — аккуратная пауза, чтобы можно было возобновить
        await this.pauseCampaignSafe(cid, pid);
      },
    });

    // Колбэк для WS обновлений прогресса
    this.progressService.setProgressCallback(async (campaignId, progress) => {
      await this.emitCampaignProgress(campaignId, progress);
    });
  }

  /**
   * Запуск кампании (из QUEUED -> RUNNING)
   */
  async startCampaign(
    campaignId: string,
    options?: ExecutorOptions
  ): Promise<void> {
    const campaign = await this.campaignRepository.findById(campaignId);
    if (!campaign) {
      throw new Error(`Campaign not found: ${campaignId}`);
    }
    if (campaign.status !== 'QUEUED' && campaign.status !== 'RUNNING') {
      throw new Error(`Campaign not runnable: ${campaignId} is in status ${campaign.status}`);
    }

    const previousStatus = campaign.status;

    // Перевод в RUNNING
    await this.campaignRepository.update(campaignId, { status: 'RUNNING' });
    await this.campaignRepository.updateProgress(campaignId, {
      startedAt: campaign.startedAt ?? new Date(),
    });

    // Подготовка воркеров по профилям
    const campaignProfiles = await this.profileRepository.findByCampaignId(
      campaignId
    );

    // Проверка и автоматический запуск остановленных профилей
    if (this.profilesService) {
      const profileStartPromises: Promise<void>[] = [];
      
      for (const cp of campaignProfiles) {
        const profileStatus = cp.profile.status;
        if (profileStatus === 'STOPPED') {
          const startPromise = (async () => {
            try {
              logger.info('Auto-starting stopped profile for campaign', {
                campaignId,
                profileId: cp.profileId,
                userId: cp.profile.userId,
              });
              if (this.profilesService) {
                await this.profilesService.startProfile(
                  cp.profileId,
                  cp.profile.userId
                );
              } else {
                throw new Error('ProfilesService is not available');
              }
              
              // Небольшая задержка для инициализации профиля
              await new Promise((resolve) => setTimeout(resolve, 2000));
              
              logger.info('Profile started successfully', {
                campaignId,
                profileId: cp.profileId,
              });
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : 'Unknown error';
              logger.error('Failed to auto-start profile for campaign', {
                campaignId,
                profileId: cp.profileId,
                userId: cp.profile.userId,
                error: errorMessage,
              });
              // Продолжаем работу, но логируем ошибку
              // Воркер все равно будет создан, но может не работать корректно
            }
          })();
          profileStartPromises.push(startPromise);
        } else if (profileStatus !== 'RUNNING' && profileStatus !== 'STARTING') {
          logger.warn('Profile is not in a runnable state', {
            campaignId,
            profileId: cp.profileId,
            status: profileStatus,
          });
        }
      }
      
      // Ждем запуска всех профилей (с таймаутом)
      if (profileStartPromises.length > 0) {
        try {
          await Promise.allSettled(profileStartPromises);
          logger.info('Profile auto-start completed', {
            campaignId,
            startedCount: profileStartPromises.length,
          });
        } catch (error) {
          logger.warn('Some profiles failed to start', {
            campaignId,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }
    } else {
      logger.warn('ProfilesService is not available, skipping profile auto-start', {
        campaignId,
      });
    }

    const settings = await this.settingsRepository.getOrCreate();
    const pauseMode: 1 | 2 = settings.pauseMode === 2 ? 2 : 1;
    const delayBetweenMessagesMs = settings.minDelayBetweenMessagesMs && settings.maxDelayBetweenMessagesMs
      ? { minMs: settings.minDelayBetweenMessagesMs, maxMs: settings.maxDelayBetweenMessagesMs }
      : undefined;
    const delayBetweenContactsMs = settings.minDelayBetweenContactsMs && settings.maxDelayBetweenContactsMs
      ? { minMs: settings.minDelayBetweenContactsMs, maxMs: settings.maxDelayBetweenContactsMs }
      : undefined;
    const typingDelayMs =
      settings.typingSpeedCharsPerSec && settings.typingSpeedCharsPerSec > 0
        ? {
            minMs: Math.max(300, Math.floor((1 / settings.typingSpeedCharsPerSec) * 500)),
            maxMs: Math.max(600, Math.floor((1 / settings.typingSpeedCharsPerSec) * 1200)),
          }
        : undefined;
    const typingSimulationEnabled = Boolean(settings.typingSimulationEnabled);

    const workerContexts: WorkerContext[] = [];
    for (const cp of campaignProfiles) {
      const worker = new ProfileWorker({
        campaignId,
        profileId: cp.profileId,
        chunkSize: options?.chunkSize ?? this.defaultChunkSize,
        messageRepository: this.messageRepository,
        loadBalancer: this.loadBalancer,
        sender: this.sender,
        universalTarget: campaign.universalTarget,
        pauseMode,
        delayBetweenMessagesMs,
        delayBetweenContactsMs,
        typingSimulationEnabled,
        typingDelayMs,
        onMessageProcessed: async (result): Promise<void> =>
          this.handleMessageProcessed(campaignId, cp.profileId, result),
      });
      workerContexts.push({ worker, profileId: cp.profileId, running: false });
    }

    this.workers.set(campaignId, workerContexts);

    // Стартуем всех
    for (const ctx of workerContexts) {
      ctx.running = true;
      ctx.worker.start().catch((error: unknown) => {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger.error('Worker failed', { error: errorMessage, campaignId, profileId: ctx.profileId });
        this.errorHandler.handleProfileError(
          { campaignId, userId: campaign.userId, profileId: ctx.profileId },
          errorMessage
        );
        this.emit('error', { campaignId, profileId: ctx.profileId, error: errorMessage });
      });
    }

    // Старт трекинга прогресса
    this.progressService.startTracking(campaignId);
    this.emitStatus(campaignId, campaign.userId, 'RUNNING', previousStatus);

    this.emit('started', { campaignId });
    logger.info('Campaign started', { campaignId, profiles: workerContexts.length });

    // Уведомление о запуске
    await this.notificationService.notifyStarted(campaign.userId, campaignId, campaign.name).catch((error) => {
      logger.error('Failed to send campaign started notification', {
        campaignId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    });
  }

  /**
   * Пауза кампании
   */
  async pauseCampaign(campaignId: string): Promise<void> {
    const campaign = await this.campaignRepository.findById(campaignId);
    const previousStatus = campaign?.status ?? 'UNKNOWN';

    await this.campaignRepository.update(campaignId, { status: 'PAUSED' });
    await this.stopWorkers(campaignId);
    
    // Сбрасываем сообщения в статусе PROCESSING обратно в PENDING
    // чтобы они могли быть обработаны при возобновлении
    try {
      const processingMessages = await this.messageRepository.findByCampaignId(campaignId, {
        page: 1,
        limit: 1000, // Достаточно большое число для получения всех
        status: 'PROCESSING',
      });

      if (processingMessages.data.length > 0) {
        // Сбрасываем статус обратно в PENDING
        await Promise.all(
          processingMessages.data.map((msg) =>
            this.messageRepository.update(msg.id, { status: 'PENDING' }).catch((error) => {
              logger.error('Failed to reset message status to PENDING', {
                messageId: msg.id,
                error: error instanceof Error ? error.message : 'Unknown error',
              });
            })
          )
        );

        logger.info('Reset processing messages to PENDING on pause', {
          campaignId,
          count: processingMessages.data.length,
        });
      }
    } catch (error) {
      logger.error('Failed to reset processing messages on pause', {
        campaignId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    if (campaign) {
      this.emitStatus(campaignId, campaign.userId, 'PAUSED', previousStatus);
      await this.notificationService.notifyStatus(campaign.userId, campaignId, 'PAUSED', campaign.name).catch((error) =>
        logger.error('Failed to send campaign paused notification', {
          campaignId,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      );
    }
    this.emit('paused', { campaignId });
  }

  /**
   * Возобновление кампании (из PAUSED -> RUNNING)
   */
  async resumeCampaign(
    campaignId: string,
    options?: ExecutorOptions
  ): Promise<void> {
    const campaign = await this.campaignRepository.findById(campaignId);
    if (!campaign) {
      throw new Error(`Campaign not found: ${campaignId}`);
    }
    if (campaign.status !== 'PAUSED') {
      throw new Error(`Campaign not paused: ${campaignId} is in status ${campaign.status}`);
    }

    await this.campaignRepository.update(campaignId, { status: 'RUNNING' });
    await this.startCampaign(campaignId, options);
    this.emitStatus(campaignId, campaign.userId, 'RUNNING', 'PAUSED');
    await this.notificationService.notifyStatus(campaign.userId, campaignId, 'RUNNING', campaign.name).catch((error) =>
      logger.error('Failed to send campaign resumed notification', {
        campaignId,
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    );
    this.emit('resumed', { campaignId });
  }

  /**
   * Отмена кампании
   */
  async cancelCampaign(campaignId: string): Promise<void> {
    const campaign = await this.campaignRepository.findById(campaignId);
    const previousStatus = campaign?.status ?? 'UNKNOWN';

    await this.campaignRepository.update(campaignId, { status: 'CANCELLED' });
    await this.stopWorkers(campaignId);
    
    // Помечаем все сообщения в статусе PROCESSING как SKIPPED
    // так как кампания отменена
    try {
      const processingMessages = await this.messageRepository.findByCampaignId(campaignId, {
        page: 1,
        limit: 1000, // Достаточно большое число для получения всех
        status: 'PROCESSING',
      });

      if (processingMessages.data.length > 0) {
        // Помечаем как SKIPPED
        await Promise.all(
          processingMessages.data.map((msg) =>
            this.messageRepository.update(msg.id, {
              status: 'SKIPPED',
              errorMessage: 'Campaign was cancelled',
            }).catch((error) => {
              logger.error('Failed to mark message as SKIPPED on cancel', {
                messageId: msg.id,
                error: error instanceof Error ? error.message : 'Unknown error',
              });
            })
          )
        );

        // Обновляем статистику кампании
        await this.progressService.updateProgress(campaignId, {
          skipped: processingMessages.data.length,
        });

        logger.info('Marked processing messages as SKIPPED on cancel', {
          campaignId,
          count: processingMessages.data.length,
        });
      }
    } catch (error) {
      logger.error('Failed to handle processing messages on cancel', {
        campaignId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    await this.campaignRepository.updateProgress(campaignId, {
      completedAt: new Date(),
    });
    if (campaign) {
      this.emitStatus(campaignId, campaign.userId, 'CANCELLED', previousStatus);
      await this.notificationService.notifyStatus(campaign.userId, campaignId, 'CANCELLED', campaign.name).catch((error) =>
        logger.error('Failed to send campaign cancelled notification', {
          campaignId,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      );
    }
    this.emit('cancelled', { campaignId });
  }

  /**
   * Обработка результата отправки сообщения
   */
  private async handleMessageProcessed(
    campaignId: string,
    profileId: string,
    result: {
      messageId: string;
      status: 'SENT' | 'FAILED' | 'SKIPPED';
      messenger: MessengerType | null;
      clientId: string | null;
      phoneId: string | null;
      errorMessage?: string;
    }
  ): Promise<void> {
    try {
      // Обновляем статистику кампании
      if (result.status === 'SENT') {
        await this.progressService.updateProgress(campaignId, {
          successful: 1,
          profileId,
        });
      } else if (result.status === 'FAILED') {
        await this.progressService.updateProgress(campaignId, {
          failed: 1,
          profileId,
        });
      } else if (result.status === 'SKIPPED') {
        await this.progressService.updateProgress(campaignId, {
          skipped: 1,
          profileId,
        });
      }

      // Обновляем конкретное сообщение - важно обновить статус, чтобы не осталось в PROCESSING
      try {
        if (result.status === 'FAILED') {
          // Для failed используем специальный метод, который увеличивает retryCount
          const message = await this.messageRepository.findById(result.messageId);
          if (message) {
            await this.messageRepository.update(result.messageId, {
              status: 'FAILED',
              messenger: result.messenger ?? undefined,
              errorMessage: result.errorMessage,
              retryCount: (message.retryCount || 0) + 1,
            });
          } else {
            logger.warn('Message not found when updating status', {
              messageId: result.messageId,
              campaignId,
            });
          }
        } else {
          await this.messageRepository.update(result.messageId, {
            status: result.status === 'SENT' ? 'SENT' : 'SKIPPED',
            messenger: result.messenger ?? undefined,
            sentAt: result.status === 'SENT' ? new Date() : undefined,
            errorMessage: result.errorMessage,
          });
        }
      } catch (updateError) {
        // Критическая ошибка - сообщение может остаться в PROCESSING
        logger.error('Failed to update message status', {
          error: updateError instanceof Error ? updateError.message : 'Unknown error',
          messageId: result.messageId,
          campaignId,
          status: result.status,
        });
        // Пытаемся хотя бы пометить как FAILED, если не удалось обновить
        try {
          await this.messageRepository.update(result.messageId, {
            status: 'FAILED',
            errorMessage: `Failed to update status: ${result.errorMessage || 'Unknown error'}`,
          });
        } catch (fallbackError) {
          logger.error('Failed to update message status even with fallback', {
            error: fallbackError instanceof Error ? fallbackError.message : 'Unknown error',
            messageId: result.messageId,
          });
        }
      }

      // Эмит прогресса
      await this.progressService.emitProgress(campaignId).catch((error) => {
        logger.error('Failed to emit progress', {
          error: error instanceof Error ? error.message : 'Unknown error',
          campaignId,
        });
      });

      // Эмит ошибки при неудаче
      if (result.status === 'FAILED' && result.errorMessage) {
        try {
          const campaign = await this.campaignRepository.findById(campaignId);
          if (campaign) {
            this.errorHandler.handleMessengerError(
              {
                campaignId,
                userId: campaign.userId,
                profileId,
              },
              result.errorMessage
            );
          }
        } catch (error) {
          logger.error('Failed to handle messenger error', {
            error: error instanceof Error ? error.message : 'Unknown error',
            campaignId,
            profileId,
          });
        }
      }

      // Эмит события message
      await this.emitMessage(campaignId, {
        campaignId,
        messageId: result.messageId,
        clientId: result.clientId ?? '',
        phoneId: result.phoneId ?? '',
        status: result.status,
        messenger: result.messenger,
        errorMessage: result.errorMessage ?? null,
      }).catch((error) => {
        logger.error('Failed to emit message event', {
          error: error instanceof Error ? error.message : 'Unknown error',
          campaignId,
          messageId: result.messageId,
        });
      });

      // Проверка завершения
      try {
        const completed = await this.progressService.checkCompletion(campaignId);
        if (completed) {
          await this.finishCampaign(campaignId);
        }
      } catch (error) {
        logger.error('Failed to check campaign completion', {
          error: error instanceof Error ? error.message : 'Unknown error',
          campaignId,
        });
      }
    } catch (error) {
      // Критическая ошибка при обработке результата сообщения
      logger.error('Critical error in handleMessageProcessed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        campaignId,
        profileId,
        messageId: result.messageId,
      });
      // Пытаемся хотя бы пометить сообщение как FAILED
      try {
        await this.messageRepository.update(result.messageId, {
          status: 'FAILED',
          errorMessage: `Critical error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        });
      } catch (updateError) {
        logger.error('Failed to mark message as failed after critical error', {
          error: updateError instanceof Error ? updateError.message : 'Unknown error',
          messageId: result.messageId,
        });
      }
    }
  }

  /**
   * Завершение кампании
   */
  private async finishCampaign(campaignId: string): Promise<void> {
    await this.stopWorkers(campaignId);
    await this.progressService.markCompleted(campaignId);
    const campaign = await this.campaignRepository.findById(campaignId);
    if (campaign) {
      this.emitStatus(campaignId, campaign.userId, 'COMPLETED', campaign.status);
      this.emitCompletion(campaignId, campaign.userId);

      // Уведомление о завершении с статистикой
      const stats = await this.statsService.getStats(campaignId);
      if (stats) {
        await this.notificationService.notifyCompleted(
          campaign.userId,
          campaignId,
          campaign.name,
          stats
        ).catch((error) => {
          logger.error('Failed to send campaign completed notification', {
            campaignId,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        });
      }
    }
    this.emit('completed', { campaignId });
    logger.info('Campaign completed', { campaignId });
  }

  /**
   * Остановка воркеров кампании
   */
  private async stopWorkers(campaignId: string): Promise<void> {
    const contexts = this.workers.get(campaignId);
    if (!contexts) {
      return;
    }

    for (const ctx of contexts) {
      if (ctx.running) {
        await ctx.worker.stop();
        ctx.running = false;
      }
    }

    this.workers.delete(campaignId);
  }

  // ============================
  // WS Helpers
  // ============================
  private emitStatus(campaignId: string, userId: string, status: string, previousStatus: string): void {
    if (!this.wsServer) {
      return;
    }
    const payload: CampaignStatusPayload = {
      campaignId,
      status,
      previousStatus,
    };
    this.wsServer.emitCampaignEvent(campaignId, userId, WsEventType.CAMPAIGN_STATUS, payload);
    this.logStatus(campaignId, status, previousStatus);
  }

  private async emitMessage(campaignId: string, payload: CampaignMessagePayload): Promise<void> {
    if (!this.wsServer) {
      return;
    }
    const campaign = await this.campaignRepository.findById(campaignId);
    if (!campaign) {
      return;
    }
    this.wsServer.emitCampaignEvent(campaignId, campaign.userId, WsEventType.CAMPAIGN_MESSAGE, payload);
  }

  private async emitCampaignProgress(campaignId: string, progress: CampaignProgress): Promise<void> {
    if (!this.wsServer) {
      return;
    }
    const campaign = await this.campaignRepository.findById(campaignId);
    if (!campaign) {
      return;
    }

    // Уведомления о прогрессе (50%, 75%, 90%)
    if (progress.progress >= 50) {
      const progressPercent = Math.round(progress.progress);
      if (progressPercent === 50 || progressPercent === 75 || progressPercent === 90) {
        await this.notificationService.notifyProgress(
          campaign.userId,
          campaignId,
          campaign.name,
          progressPercent
        ).catch((error) => {
          logger.error('Failed to send campaign progress notification', {
            campaignId,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        });
      }
    }

    const payload: CampaignProgressPayload = {
      campaignId,
      totalContacts: progress.totalContacts,
      processedContacts: progress.processedContacts,
      successfulContacts: progress.successfulContacts,
      failedContacts: progress.failedContacts,
      skippedContacts: progress.skippedContacts,
      percentComplete: progress.progress,
      eta: progress.eta ? String(progress.eta) : null,
      speed: progress.speed,
    };
    this.wsServer.emitCampaignEvent(campaignId, campaign.userId, WsEventType.CAMPAIGN_PROGRESS, payload);
  }

  private emitCompletion(campaignId: string, userId: string): void {
    if (!this.wsServer) {
      return;
    }
    this.wsServer.emitCampaignEvent(campaignId, userId, WsEventType.CAMPAIGN_COMPLETED, { campaignId });
  }

  private async logStatus(campaignId: string, status: string, previousStatus: string): Promise<void> {
    try {
      await this.logRepository.create({
        campaignId,
        level: 'INFO',
        action: 'status_change',
        message: `Status: ${previousStatus} -> ${status}`,
      });
    } catch (error: unknown) {
      logger.error('Failed to log campaign status', {
        campaignId,
        status,
        previousStatus,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }


  // Провайдеры для Recovery/External
  handleCriticalError(campaignId: string, userId: string, profileId: string | undefined, message: string): void {
    this.errorHandler.handleCriticalError({ campaignId, userId, profileId }, message);
    
    // Уведомление об ошибке
    if (this.notificationDispatcher) {
      const dispatcher = this.notificationDispatcher;
      this.campaignRepository.findById(campaignId).then((campaign) => {
        if (campaign && dispatcher) {
          dispatcher.notifyCampaignError(
            userId,
            campaignId,
            campaign.name,
            message
          ).catch((error) => {
            logger.error('Failed to send campaign error notification', {
              campaignId,
              error: error instanceof Error ? error.message : 'Unknown error',
            });
          });
        }
      }).catch(() => {
        // Игнорируем ошибку получения кампании
      });
    }
  }

  handleNetworkError(campaignId: string, userId: string, profileId: string | undefined, message: string): void {
    this.errorHandler.handleNetworkError({ campaignId, userId, profileId }, message);
  }

  handleProfileDisconnect(campaignId: string, userId: string, profileId: string, message: string): void {
    this.errorHandler.handleProfileError({ campaignId, userId, profileId }, message);
  }

  private async pauseCampaignSafe(campaignId: string, profileId?: string): Promise<void> {
    try {
      await this.pauseCampaign(campaignId);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to pause campaign on error', { campaignId, profileId, message });
    }
  }
}

