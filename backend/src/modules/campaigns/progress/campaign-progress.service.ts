/**
 * Campaign Progress Service
 * 
 * Отвечает за:
 * - Отслеживание прогресса кампании
 * - Расчёт ETA и скорости отправки
 * - Периодическое сохранение прогресса в БД
 * - Отправка обновлений через WebSocket
 * 
 * @module modules/campaigns/progress/campaign-progress.service
 */

import { PrismaClient, Campaign } from '@prisma/client';
import logger from '../../../config/logger';
import { CampaignRepository } from '../campaigns.repository';

// ============================================
// Типы
// ============================================

export interface CampaignProgress {
  campaignId: string;
  status: string;
  totalContacts: number;
  processedContacts: number;
  successfulContacts: number;
  failedContacts: number;
  skippedContacts: number;
  progress: number; // 0-100%
  eta: number | null; // estimated seconds remaining
  speed: number; // contacts per minute
  startedAt: Date | null;
  pausedAt: Date | null;
  elapsedTime: number; // seconds since start
  profiles: ProfileProgress[];
}

export interface ProfileProgress {
  profileId: string;
  profileName: string;
  assignedCount: number;
  processedCount: number;
  successCount: number;
  failedCount: number;
  progress: number; // 0-100%
  status: string;
}

interface ProgressTracking {
  campaignId: string;
  startTime: number; // timestamp
  lastUpdateTime: number;
  contactsAtLastUpdate: number;
  speedSamples: number[]; // last N speed measurements
  unsavedContactsCount: number;
}

// ============================================
// Campaign Progress Service
// ============================================

export class CampaignProgressService {
  private campaignRepository: CampaignRepository;
  
  // Отслеживание прогресса для активных кампаний
  private tracking: Map<string, ProgressTracking> = new Map();
  
  // Настройки
  private progressSaveInterval: number = 5; // Каждые N контактов
  private speedSamplesCount: number = 10; // Количество замеров для расчёта скорости
  
  // Колбэк для отправки обновлений (WebSocket)
  private onProgressUpdate: ((campaignId: string, progress: CampaignProgress) => void | Promise<void>) | null = null;

  constructor(private prisma: PrismaClient) {
    this.campaignRepository = new CampaignRepository(prisma);
  }

  /**
   * Установка колбэка для WebSocket обновлений
   */
  setProgressCallback(callback: (campaignId: string, progress: CampaignProgress) => void | Promise<void>): void {
    this.onProgressUpdate = callback;
  }

  /**
   * Установка интервала сохранения
   */
  setSaveInterval(contacts: number): void {
    this.progressSaveInterval = contacts;
    logger.info('Progress save interval updated', { contacts });
  }

  /**
   * Начало отслеживания кампании
   */
  startTracking(campaignId: string): void {
    const now = Date.now();
    
    this.tracking.set(campaignId, {
      campaignId,
      startTime: now,
      lastUpdateTime: now,
      contactsAtLastUpdate: 0,
      speedSamples: [],
      unsavedContactsCount: 0,
    });

    logger.info('Started progress tracking', { campaignId });
  }

  /**
   * Остановка отслеживания кампании
   */
  stopTracking(campaignId: string): void {
    this.tracking.delete(campaignId);
    logger.info('Stopped progress tracking', { campaignId });
  }

  /**
   * Получение текущего прогресса кампании
   */
  async getProgress(campaignId: string): Promise<CampaignProgress | null> {
    try {
      // Получаем кампанию с профилями
      const campaign = await this.prisma.campaign.findUnique({
        where: { id: campaignId },
        include: {
          profiles: {
            include: {
              profile: {
                select: { name: true },
              },
            },
          },
        },
      });

      if (!campaign) {
        return null;
      }

      // Расчёт прогресса
      const totalContacts = campaign.totalContacts ?? 0;
      const processedContacts = campaign.processedContacts ?? 0;
      const progress = totalContacts > 0 ? Math.round((processedContacts / totalContacts) * 100) : 0;

      // Расчёт времени
      const tracking = this.tracking.get(campaignId);
      const elapsedTime = this.calculateElapsedTime(campaign, tracking);
      const speed = this.calculateSpeed(campaignId, processedContacts, tracking);
      const eta = this.calculateETA(totalContacts, processedContacts, speed);

      // Прогресс по профилям
      const profiles: ProfileProgress[] = campaign.profiles.map((cp) => {
        const profileProgress = cp.assignedCount > 0 
          ? Math.round((cp.processedCount / cp.assignedCount) * 100) 
          : 0;

        return {
          profileId: cp.profileId,
          profileName: cp.profile.name,
          assignedCount: cp.assignedCount,
          processedCount: cp.processedCount,
          successCount: cp.successCount,
          failedCount: cp.failedCount,
          progress: profileProgress,
          status: cp.status,
        };
      });

      return {
        campaignId,
        status: campaign.status,
        totalContacts,
        processedContacts,
        successfulContacts: campaign.successfulContacts ?? 0,
        failedContacts: campaign.failedContacts ?? 0,
        skippedContacts: campaign.skippedContacts ?? 0,
        progress,
        eta,
        speed,
        startedAt: campaign.startedAt,
        pausedAt: campaign.pausedAt,
        elapsedTime,
        profiles,
      };
    } catch (error) {
      logger.error('Failed to get campaign progress', { error, campaignId });
      throw error;
    }
  }

  /**
   * Обновление прогресса (вызывается при обработке каждого контакта)
   */
  async updateProgress(
    campaignId: string,
    update: {
      successful?: number;
      failed?: number;
      skipped?: number;
      profileId?: string;
    }
  ): Promise<void> {
    try {
      const tracking = this.tracking.get(campaignId);
      
      if (!tracking) {
        logger.warn('No tracking found for campaign', { campaignId });
        return;
      }

      // Обновляем счётчики кампании
      if (update.successful) {
        await this.campaignRepository.incrementProgress(campaignId, 'successfulContacts', update.successful);
        await this.campaignRepository.incrementProgress(campaignId, 'processedContacts', update.successful);
      }

      if (update.failed) {
        await this.campaignRepository.incrementProgress(campaignId, 'failedContacts', update.failed);
        await this.campaignRepository.incrementProgress(campaignId, 'processedContacts', update.failed);
      }

      if (update.skipped) {
        await this.campaignRepository.incrementProgress(campaignId, 'skippedContacts', update.skipped);
        await this.campaignRepository.incrementProgress(campaignId, 'processedContacts', update.skipped);
      }

      // Обновляем счётчики профиля
      if (update.profileId) {
        try {
          const campaignProfile = await this.prisma.campaignProfile.findUnique({
            where: {
              campaignId_profileId: { campaignId, profileId: update.profileId },
            },
          });

          if (campaignProfile) {
            const profileUpdate: Record<string, { increment: number }> = {
              processedCount: { increment: 1 },
            };

            if (update.successful) {
              profileUpdate.successCount = { increment: 1 };
            }
            if (update.failed) {
              profileUpdate.failedCount = { increment: 1 };
            }

            await this.prisma.campaignProfile.update({
              where: { id: campaignProfile.id },
              data: profileUpdate,
            });
          } else {
            // Логируем предупреждение, но не прерываем обновление прогресса кампании
            logger.warn('Campaign profile not found for progress update', {
              campaignId,
              profileId: update.profileId,
            });
          }
        } catch (profileError) {
          // Ошибка обновления профиля не должна прерывать обновление прогресса кампании
          logger.error('Failed to update profile progress', {
            error: profileError,
            campaignId,
            profileId: update.profileId,
          });
        }
      }

      // Увеличиваем счётчик несохранённых контактов
      tracking.unsavedContactsCount++;

      // Обновляем скорость на основе изменения processedContacts
      await this.refreshSpeedSample(campaignId, tracking);

      // Сохраняем в БД каждые N контактов
      if (tracking.unsavedContactsCount >= this.progressSaveInterval) {
        await this.saveProgressToDb(campaignId);
        tracking.unsavedContactsCount = 0;
      }

      // Отправляем обновление через WebSocket
      await this.emitProgress(campaignId);
    } catch (error) {
      logger.error('Failed to update progress', { error, campaignId, update });
      throw error;
    }
  }

  /**
   * Принудительное сохранение прогресса в БД
   */
  async saveProgressToDb(campaignId: string): Promise<void> {
    try {
      // Прогресс уже сохраняется через incrementProgress
      // Здесь можно добавить дополнительную логику при необходимости
      await Promise.resolve();
      logger.debug('Progress saved to DB', { campaignId });
    } catch (error) {
      logger.error('Failed to save progress to DB', { error, campaignId });
      throw error;
    }
  }

  /**
   * Отправка прогресса через WebSocket
   */
  async emitProgress(campaignId: string): Promise<void> {
    try {
      if (!this.onProgressUpdate) {
        return;
      }

      const progress = await this.getProgress(campaignId);
      
      if (progress) {
        await this.onProgressUpdate(campaignId, progress);
      }
    } catch (error) {
      logger.error('Failed to emit progress', { error, campaignId });
    }
  }

  /**
   * Расчёт прошедшего времени
   */
  private calculateElapsedTime(campaign: Campaign, tracking?: ProgressTracking): number {
    if (!campaign.startedAt) {
      return 0;
    }

    const now = Date.now();
    const startTime = tracking?.startTime ?? campaign.startedAt.getTime();
    
    // Если кампания на паузе, считаем время до паузы
    if (campaign.pausedAt) {
      return Math.floor((campaign.pausedAt.getTime() - startTime) / 1000);
    }

    return Math.floor((now - startTime) / 1000);
  }

  /**
   * Расчёт скорости отправки (контактов в минуту)
   */
  private calculateSpeed(_campaignId: string, currentContacts: number, tracking?: ProgressTracking): number {
    if (!tracking) {
      return 0;
    }

    // Если есть замеры скорости, используем их среднее
    if (tracking.speedSamples.length > 0) {
      const sum = tracking.speedSamples.reduce((a, b) => a + b, 0);
      return Math.round(sum / tracking.speedSamples.length);
    }

    // Иначе считаем по общему времени
    const elapsedMinutes = (Date.now() - tracking.startTime) / (1000 * 60);
    
    if (elapsedMinutes < 0.1) { // Меньше 6 секунд
      return 0;
    }

    return Math.round(currentContacts / elapsedMinutes);
  }

  /**
   * Обновление замеров скорости, учитывая прирост обработанных контактов
   */
  private async refreshSpeedSample(campaignId: string, tracking: ProgressTracking): Promise<void> {
    const now = Date.now();
    const timeSinceLastUpdate = (now - tracking.lastUpdateTime) / 1000; // сек

    // Получаем текущее значение processedContacts
    const campaign = await this.prisma.campaign.findUnique({
      where: { id: campaignId },
      select: { processedContacts: true },
    });
    if (!campaign) {
      return;
    }

    const currentProcessed = campaign.processedContacts ?? 0;
    const deltaContacts = currentProcessed - tracking.contactsAtLastUpdate;

    if (timeSinceLastUpdate > 0 && deltaContacts > 0) {
      const speedPerMinute = (deltaContacts / timeSinceLastUpdate) * 60;
      tracking.speedSamples.push(speedPerMinute);
      if (tracking.speedSamples.length > this.speedSamplesCount) {
        tracking.speedSamples.shift();
      }
      tracking.contactsAtLastUpdate = currentProcessed;
    }

    tracking.lastUpdateTime = now;
  }

  /**
   * Расчёт ETA (оставшееся время в секундах)
   */
  calculateETA(totalContacts: number, processedContacts: number, speed: number): number | null {
    if (speed <= 0 || processedContacts >= totalContacts) {
      return null;
    }

    const remainingContacts = totalContacts - processedContacts;
    const minutesRemaining = remainingContacts / speed;
    
    return Math.round(minutesRemaining * 60);
  }

  /**
   * Форматирование ETA для отображения
   */
  formatETA(seconds: number | null): string {
    if (seconds === null || seconds <= 0) {
      return 'Расчёт...';
    }

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `~${hours}ч ${minutes}мин`;
    }

    if (minutes > 0) {
      return `~${minutes}мин ${secs}сек`;
    }

    return `~${secs}сек`;
  }

  /**
   * Получение сводной статистики кампании
   */
  async getSummary(campaignId: string): Promise<{
    totalContacts: number;
    processed: number;
    successful: number;
    failed: number;
    skipped: number;
    pending: number;
    progress: number;
    successRate: number;
    failureRate: number;
  }> {
    try {
      const campaign = await this.campaignRepository.findById(campaignId);
      
      if (!campaign) {
        throw new Error('Campaign not found');
      }

      const totalContacts = campaign.totalContacts ?? 0;
      const processed = campaign.processedContacts ?? 0;
      const successful = campaign.successfulContacts ?? 0;
      const failed = campaign.failedContacts ?? 0;
      const skipped = campaign.skippedContacts ?? 0;
      const pending = totalContacts - processed;

      const progress = totalContacts > 0 ? Math.round((processed / totalContacts) * 100) : 0;
      const successRate = processed > 0 ? Math.round((successful / processed) * 100) : 0;
      const failureRate = processed > 0 ? Math.round((failed / processed) * 100) : 0;

      return {
        totalContacts,
        processed,
        successful,
        failed,
        skipped,
        pending,
        progress,
        successRate,
        failureRate,
      };
    } catch (error) {
      logger.error('Failed to get campaign summary', { error, campaignId });
      throw error;
    }
  }

  /**
   * Получение активных кампаний с прогрессом
   */
  async getActiveCampaignsProgress(userId?: string): Promise<CampaignProgress[]> {
    try {
      const where: Record<string, unknown> = {
        status: { in: ['RUNNING', 'PAUSED'] },
      };

      if (userId) {
        where.userId = userId;
      }

      const campaigns = await this.prisma.campaign.findMany({
        where,
        select: { id: true },
      });

      const progressList: CampaignProgress[] = [];

      for (const campaign of campaigns) {
        const progress = await this.getProgress(campaign.id);
        if (progress) {
          progressList.push(progress);
        }
      }

      return progressList;
    } catch (error) {
      logger.error('Failed to get active campaigns progress', { error, userId });
      throw error;
    }
  }

  /**
   * Проверка завершения кампании
   * Проверяет не только количество обработанных контактов, но и что все сообщения действительно отправлены
   */
  async checkCompletion(campaignId: string): Promise<boolean> {
    try {
      const campaign = await this.campaignRepository.findById(campaignId);
      
      if (!campaign) {
        return false;
      }

      const totalContacts = campaign.totalContacts ?? 0;
      const processedContacts = campaign.processedContacts ?? 0;

      // Базовая проверка по количеству обработанных контактов
      if (processedContacts < totalContacts) {
        return false;
      }

      // Дополнительная проверка: убеждаемся, что нет pending или processing сообщений
      const pendingCount = await this.prisma.campaignMessage.count({
        where: {
          campaignId,
          status: { in: ['PENDING', 'PROCESSING'] },
        },
      });

      if (pendingCount > 0) {
        logger.debug('Campaign not completed - pending messages exist', {
          campaignId,
          pendingCount,
          processedContacts,
          totalContacts,
        });
        return false;
      }

      // Проверяем, что количество отправленных сообщений соответствует ожидаемому
      const sentCount = await this.prisma.campaignMessage.count({
        where: {
          campaignId,
          status: 'SENT',
        },
      });

      const failedCount = await this.prisma.campaignMessage.count({
        where: {
          campaignId,
          status: 'FAILED',
        },
      });

      const skippedCount = await this.prisma.campaignMessage.count({
        where: {
          campaignId,
          status: 'SKIPPED',
        },
      });

      const totalMessages = sentCount + failedCount + skippedCount;

      // Если общее количество сообщений меньше ожидаемого, кампания еще не завершена
      if (totalMessages < totalContacts) {
        logger.debug('Campaign not completed - message count mismatch', {
          campaignId,
          totalMessages,
          totalContacts,
          sentCount,
          failedCount,
          skippedCount,
        });
        return false;
      }

      logger.info('Campaign completion verified', {
        campaignId,
        processedContacts,
        totalContacts,
        sentCount,
        failedCount,
        skippedCount,
      });

      return true;
    } catch (error) {
      logger.error('Failed to check campaign completion', { error, campaignId });
      return false;
    }
  }

  /**
   * Отметка кампании как завершённой
   */
  async markCompleted(campaignId: string): Promise<void> {
    try {
      await this.campaignRepository.updateProgress(campaignId, {
        status: 'COMPLETED',
        completedAt: new Date(),
      });

      // Обновляем статусы профилей
      await this.prisma.campaignProfile.updateMany({
        where: {
          campaignId,
          status: { in: ['PENDING', 'RUNNING'] },
        },
        data: { status: 'COMPLETED' },
      });

      this.stopTracking(campaignId);

      logger.info('Campaign marked as completed', { campaignId });
    } catch (error) {
      logger.error('Failed to mark campaign as completed', { error, campaignId });
      throw error;
    }
  }

  /**
   * Получение статуса отслеживания
   */
  isTracking(campaignId: string): boolean {
    return this.tracking.has(campaignId);
  }

  /**
   * Получение количества отслеживаемых кампаний
   */
  getTrackingCount(): number {
    return this.tracking.size;
  }
}

