/**
 * Campaign Scheduler Service
 * 
 * Отвечает за:
 * - Проверку и запуск запланированных кампаний
 * - Проверку рабочих часов и дней
 * - Автоматическую паузу/возобновление кампаний вне рабочего времени
 * - Очистку старых кампаний
 * 
 * @module modules/campaigns/scheduler/campaign-scheduler.service
 */

import { PrismaClient } from '@prisma/client';
import logger from '../../../config/logger';
import { CampaignRepository } from '../campaigns.repository';

// ============================================
// Типы
// ============================================

export interface ScheduleConfig {
  startAt?: string; // ISO date for scheduled start
  workHoursStart?: number; // 0-23, e.g., 9
  workHoursEnd?: number; // 0-23, e.g., 18
  workDays?: number[]; // 0-6 (Sunday-Saturday), e.g., [1,2,3,4,5]
  timezone?: string; // e.g., 'Europe/Moscow'
  recurrence?: {
    type: 'NONE' | 'DAILY' | 'WEEKLY' | 'MONTHLY';
    interval?: number; // every N days/weeks/months
    endAt?: string; // ISO date when recurrence ends
    maxRuns?: number; // maximum number of runs
  };
}

export interface GlobalSettings {
  // ПРИМЕЧАНИЕ: Поля defaultWorkHoursStart, defaultWorkHoursEnd, defaultWorkDays больше не используются
  // Рабочие часы настраиваются индивидуально для каждой кампании
  keepCompletedCampaignsDays: number;
  autoResumeAfterRestart: boolean;
}

type SchedulerCallback = (campaignId: string) => Promise<void>;

// ============================================
// Campaign Scheduler Service
// ============================================

export class CampaignSchedulerService {
  private repository: CampaignRepository;
  private schedulerInterval: NodeJS.Timeout | null = null;
  private workHoursInterval: NodeJS.Timeout | null = null;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;

  // Колбэки для интеграции с executor
  private onCampaignReady: SchedulerCallback | null = null;
  private onCampaignPause: SchedulerCallback | null = null;
  private onCampaignResume: SchedulerCallback | null = null;

  constructor(private prisma: PrismaClient) {
    this.repository = new CampaignRepository(prisma);
  }

  /**
   * Установка колбэков для интеграции с Campaign Executor
   */
  setCallbacks(callbacks: {
    onCampaignReady?: SchedulerCallback;
    onCampaignPause?: SchedulerCallback;
    onCampaignResume?: SchedulerCallback;
  }) {
    if (callbacks.onCampaignReady) this.onCampaignReady = callbacks.onCampaignReady;
    if (callbacks.onCampaignPause) this.onCampaignPause = callbacks.onCampaignPause;
    if (callbacks.onCampaignResume) this.onCampaignResume = callbacks.onCampaignResume;
  }

  /**
   * Запуск планировщика
   */
  start() {
    if (this.isRunning) {
      logger.warn('Campaign scheduler is already running');
      return;
    }

    this.isRunning = true;

    // Проверка запланированных кампаний каждую минуту
    this.schedulerInterval = setInterval(() => {
      this.checkScheduledCampaigns().catch((error) => {
        logger.error('Error checking scheduled campaigns', { error });
      });
    }, 60 * 1000);

    // Проверка рабочих часов каждые 5 минут
    this.workHoursInterval = setInterval(() => {
      this.checkWorkHours().catch((error) => {
        logger.error('Error checking work hours', { error });
      });
    }, 5 * 60 * 1000);

    // Очистка старых кампаний раз в час
    this.cleanupInterval = setInterval(() => {
      this.cleanupOldCampaigns().catch((error) => {
        logger.error('Error cleaning up old campaigns', { error });
      });
    }, 60 * 60 * 1000);

    // Немедленная проверка при запуске
    this.checkScheduledCampaigns().catch((error) => {
      logger.error('Error in initial scheduled campaigns check', { error });
    });
    
    this.checkWorkHours().catch((error) => {
      logger.error('Error in initial work hours check', { error });
    });

    logger.info('Campaign scheduler started');
  }

  /**
   * Остановка планировщика
   */
  stop() {
    if (!this.isRunning) {
      logger.warn('Campaign scheduler is not running');
      return;
    }

    if (this.schedulerInterval) {
      clearInterval(this.schedulerInterval);
      this.schedulerInterval = null;
    }

    if (this.workHoursInterval) {
      clearInterval(this.workHoursInterval);
      this.workHoursInterval = null;
    }

    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    this.isRunning = false;
    logger.info('Campaign scheduler stopped');
  }

  /**
   * Проверка запланированных кампаний
   */
  async checkScheduledCampaigns(): Promise<void> {
    try {
      const now = new Date();
      
      // Получаем кампании, которые должны быть запущены
      const scheduledCampaigns = await this.repository.findScheduled(now);

      for (const campaign of scheduledCampaigns) {
        // Проверяем, можно ли запустить кампанию сейчас (рабочие часы)
        const scheduleConfig = this.parseScheduleConfig(campaign.scheduleConfig);
        
        if (this.isWithinWorkHours(scheduleConfig, now)) {
          logger.info('Starting scheduled campaign', { campaignId: campaign.id, name: campaign.name });

          // Переводим в статус QUEUED
          await this.repository.update(campaign.id, { status: 'QUEUED' });

          // Вызываем колбэк для запуска
          if (this.onCampaignReady) {
            await this.onCampaignReady(campaign.id);
          }
        } else {
          logger.info('Scheduled campaign postponed (outside work hours)', {
            campaignId: campaign.id,
            name: campaign.name,
          });
        }
      }
    } catch (error) {
      logger.error('Failed to check scheduled campaigns', { error });
      throw error;
    }
  }

  /**
   * Проверка рабочих часов для всех активных кампаний
   */
  async checkWorkHours(): Promise<void> {
    try {
      const now = new Date();

      // Проверяем RUNNING кампании - нужно ли приостановить
      const runningCampaigns = await this.repository.findRunning();
      
      for (const campaign of runningCampaigns) {
        const scheduleConfig = this.parseScheduleConfig(campaign.scheduleConfig);
        
        if (!this.isWithinWorkHours(scheduleConfig, now)) {
          logger.info('Pausing campaign (outside work hours)', {
            campaignId: campaign.id,
            name: campaign.name,
          });

          await this.repository.update(campaign.id, {
            status: 'PAUSED',
          });

          await this.repository.updateProgress(campaign.id, {
            pausedAt: now,
          });

          if (this.onCampaignPause) {
            await this.onCampaignPause(campaign.id);
          }
        }
      }

      // Проверяем PAUSED кампании - можно ли возобновить
      const pausedCampaigns = await this.repository.findPaused();
      
      for (const campaign of pausedCampaigns) {
        const scheduleConfig = this.parseScheduleConfig(campaign.scheduleConfig);
        
        // Возобновляем только если кампания была поставлена на паузу из-за рабочих часов
        // (а не вручную пользователем)
        if (this.isWithinWorkHours(scheduleConfig, now)) {
          // Проверяем, была ли пауза автоматической
          // (если pausedAt близко к границе рабочих часов)
          const wasAutoPaused = this.wasAutoPaused(campaign);
          
          if (wasAutoPaused) {
            logger.info('Resuming campaign (within work hours)', {
              campaignId: campaign.id,
              name: campaign.name,
            });

            await this.repository.update(campaign.id, { status: 'RUNNING' });

            if (this.onCampaignResume) {
              await this.onCampaignResume(campaign.id);
            }
          }
        }
      }
    } catch (error) {
      logger.error('Failed to check work hours', { error });
      throw error;
    }
  }

  /**
   * Проверка, находится ли текущее время в рабочих часах
   * 
   * ВАЖНО: Используются только настройки кампании. Глобальные настройки больше не используются.
   * Если рабочие часы/дни отключены (workHoursEnabled=false или workDaysEnabled=false),
   * то соответствующая проверка не выполняется (кампания работает 24/7 по этому параметру).
   */
  isWithinWorkHours(
    scheduleConfig: ScheduleConfig | null,
    date: Date
  ): boolean {
    // Если конфигурации нет - считаем что рабочие часы не ограничены (24/7)
    if (!scheduleConfig) {
      return true;
    }

    const timezone = scheduleConfig.timezone ?? 'Europe/Moscow';

    // Если рабочие часы отключены - не проверяем время (24/7 по часам)
    if (scheduleConfig.workHoursEnabled === false) {
      // Проверяем только рабочие дни, если они включены
      if (scheduleConfig.workDaysEnabled === true && scheduleConfig.workDays) {
        const localTime = this.getLocalTime(date, timezone);
        const currentDay = localTime.getDay();
        return scheduleConfig.workDays.includes(currentDay);
      }
      // Если и рабочие дни отключены - кампания работает 24/7
      return true;
    }

    // Если рабочие дни отключены - не проверяем день (24/7 по дням)
    if (scheduleConfig.workDaysEnabled === false) {
      // Проверяем только рабочие часы, если они включены
      if (scheduleConfig.workHoursEnabled === true && scheduleConfig.workHoursStart && scheduleConfig.workHoursEnd) {
        const localTime = this.getLocalTime(date, timezone);
        const currentHour = localTime.getHours();
        const workHoursStart = this.parseHour(scheduleConfig.workHoursStart);
        const workHoursEnd = this.parseHour(scheduleConfig.workHoursEnd);
        return currentHour >= workHoursStart && currentHour < workHoursEnd;
      }
      // Если и рабочие часы отключены - кампания работает 24/7
      return true;
    }

    // Если оба включены - проверяем и часы, и дни
    if (scheduleConfig.workHoursEnabled === true && scheduleConfig.workDaysEnabled === true) {
      if (!scheduleConfig.workHoursStart || !scheduleConfig.workHoursEnd || !scheduleConfig.workDays) {
        // Если настройки неполные - логируем предупреждение и разрешаем работу
        logger.warn('Incomplete work hours/days configuration, allowing campaign to run', {
          hasWorkHours: !!(scheduleConfig.workHoursStart && scheduleConfig.workHoursEnd),
          hasWorkDays: !!scheduleConfig.workDays,
        });
        return true;
      }

      const localTime = this.getLocalTime(date, timezone);
      const currentHour = localTime.getHours();
      const currentDay = localTime.getDay();
      const workHoursStart = this.parseHour(scheduleConfig.workHoursStart);
      const workHoursEnd = this.parseHour(scheduleConfig.workHoursEnd);

      // Проверяем день недели
      if (!scheduleConfig.workDays.includes(currentDay)) {
        return false;
      }

      // Проверяем часы
      if (currentHour < workHoursStart || currentHour >= workHoursEnd) {
        return false;
      }

      return true;
    }

    // Если оба отключены - кампания работает 24/7
    return true;
  }

  /**
   * Проверка рабочего дня
   */
  isWorkDay(date: Date, workDays: number[], timezone: string = 'Europe/Moscow'): boolean {
    const localTime = this.getLocalTime(date, timezone);
    return workDays.includes(localTime.getDay());
  }

  /**
   * Получение локального времени для таймзоны
   */
  private getLocalTime(date: Date, timezone: string): Date {
    try {
      const options: Intl.DateTimeFormatOptions = {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      };

      const formatter = new Intl.DateTimeFormat('en-CA', options);
      const parts = formatter.formatToParts(date);

      const dateParts: Record<string, string> = {};
      parts.forEach((part) => {
        dateParts[part.type] = part.value;
      });

      return new Date(
        parseInt(dateParts.year),
        parseInt(dateParts.month) - 1,
        parseInt(dateParts.day),
        parseInt(dateParts.hour),
        parseInt(dateParts.minute),
        parseInt(dateParts.second)
      );
    } catch (error) {
      logger.warn('Failed to convert timezone, using UTC', { timezone, error });
      return date;
    }
  }

  /**
   * Парсинг строки "HH:mm" в час (0-23)
   */
  private parseHour(value: string): number {
    const [h] = value.split(':').map((v) => parseInt(v, 10));
    if (Number.isNaN(h)) return 0;
    return Math.min(Math.max(h, 0), 23);
  }

  /**
   * Парсинг конфигурации расписания
   */
  private parseScheduleConfig(configJson: string | null): ScheduleConfig | null {
    if (!configJson) return null;

    try {
      return JSON.parse(configJson) as ScheduleConfig;
    } catch (error) {
      logger.warn('Failed to parse schedule config', { error, configJson });
      return null;
    }
  }

  /**
   * Проверка, была ли пауза автоматической
   */
  private wasAutoPaused(campaign: { pausedAt: Date | null }): boolean {
    if (!campaign.pausedAt) return false;

    // Считаем паузу автоматической, если она произошла менее 12 часов назад
    const twelveHoursAgo = new Date();
    twelveHoursAgo.setHours(twelveHoursAgo.getHours() - 12);

    return campaign.pausedAt > twelveHoursAgo;
  }

  /**
   * Получение глобальных настроек
   */
  private async getGlobalSettings(): Promise<GlobalSettings | null> {
    try {
      const settings = await this.prisma.campaignGlobalSettings.findFirst();
      
      if (!settings) return null;

      return {
        keepCompletedCampaignsDays: settings.keepCompletedCampaignsDays,
        autoResumeAfterRestart: settings.autoResumeAfterRestart,
      };
    } catch (error) {
      logger.error('Failed to get global settings', { error });
      return null;
    }
  }

  private safeParseWorkDays(value: string): number[] {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed.filter((v) => typeof v === 'number');
      }
    } catch (e) {
      logger.warn('Failed to parse defaultWorkDays, using weekdays', { value });
    }
    return [1, 2, 3, 4, 5];
  }

  /**
   * Очистка старых кампаний
   */
  async cleanupOldCampaigns(): Promise<void> {
    try {
      const globalSettings = await this.getGlobalSettings();
      const retentionDays = globalSettings?.keepCompletedCampaignsDays ?? 30;

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

      // Находим старые завершённые кампании, которые ещё не архивированы
      const oldCampaigns = await this.repository.findOldCompleted(cutoffDate, true);

      for (const campaign of oldCampaigns) {
        logger.info('Archiving old campaign', { campaignId: campaign.id, name: campaign.name });
        await this.repository.archive(campaign.id);
      }

      if (oldCampaigns.length > 0) {
        logger.info('Old campaigns archived', { count: oldCampaigns.length });
      }
    } catch (error) {
      logger.error('Failed to cleanup old campaigns', { error });
      throw error;
    }
  }

  /**
   * Принудительная проверка и запуск конкретной кампании
   */
  async triggerCampaign(campaignId: string): Promise<boolean> {
    try {
      const campaign = await this.repository.findById(campaignId);
      
      if (!campaign) {
        logger.warn('Campaign not found for trigger', { campaignId });
        return false;
      }

      if (campaign.status !== 'SCHEDULED' && campaign.status !== 'QUEUED') {
        logger.warn('Campaign cannot be triggered', { campaignId, status: campaign.status });
        return false;
      }

      const scheduleConfig = this.parseScheduleConfig(campaign.scheduleConfig);
      const now = new Date();

      if (!this.isWithinWorkHours(scheduleConfig, now)) {
        logger.warn('Cannot trigger campaign outside work hours', { campaignId });
        return false;
      }

      // Переводим в QUEUED для немедленного запуска
      if (campaign.status === 'SCHEDULED') {
        await this.repository.update(campaignId, { status: 'QUEUED' });
      }

      if (this.onCampaignReady) {
        await this.onCampaignReady(campaignId);
      }

      return true;
    } catch (error) {
      logger.error('Failed to trigger campaign', { error, campaignId });
      return false;
    }
  }

  /**
   * Получение следующего времени запуска для кампании
   */
  getNextRunTime(campaign: { scheduledAt: Date | null; scheduleConfig: string | null }): Date | null {
    if (!campaign.scheduledAt) return null;

    const scheduleConfig = this.parseScheduleConfig(campaign.scheduleConfig);
    
    // Если запланированное время в прошлом, вычисляем следующее время
    const now = new Date();
    if (campaign.scheduledAt <= now) {
      if (scheduleConfig?.recurrence?.type === 'NONE' || !scheduleConfig?.recurrence) {
        return null; // Нет рекуррентности
      }

      // Вычисляем следующее время на основе рекуррентности
      return this.calculateNextRecurrence(campaign.scheduledAt, scheduleConfig);
    }

    return campaign.scheduledAt;
  }

  /**
   * Вычисление следующего времени рекуррентного запуска
   */
  private calculateNextRecurrence(baseDate: Date, scheduleConfig: ScheduleConfig): Date | null {
    const recurrence = scheduleConfig.recurrence;
    if (!recurrence || recurrence.type === 'NONE') return null;

    const now = new Date();
    let nextDate = new Date(baseDate);
    const interval = recurrence.interval || 1;

    // Проверяем максимальную дату
    if (recurrence.endAt && new Date(recurrence.endAt) < now) {
      return null;
    }

    while (nextDate <= now) {
      switch (recurrence.type) {
        case 'DAILY':
          nextDate.setDate(nextDate.getDate() + interval);
          break;
        case 'WEEKLY':
          nextDate.setDate(nextDate.getDate() + (interval * 7));
          break;
        case 'MONTHLY':
          nextDate.setMonth(nextDate.getMonth() + interval);
          break;
      }
    }

    // Проверяем, не превышена ли конечная дата
    if (recurrence.endAt && nextDate > new Date(recurrence.endAt)) {
      return null;
    }

    return nextDate;
  }

  /**
   * Восстановление кампаний после перезапуска сервера
   */
  async restoreAfterRestart(): Promise<void> {
    try {
      const globalSettings = await this.getGlobalSettings();

      if (!globalSettings?.autoResumeAfterRestart) {
        logger.info('Auto-resume after restart is disabled');
        return;
      }

      const now = new Date();

      // Находим кампании, которые были в статусе RUNNING
      // (они могли быть прерваны при перезапуске)
      const campaigns = await this.prisma.campaign.findMany({
        where: {
          status: { in: ['RUNNING', 'QUEUED'] },
        },
      });

      for (const campaign of campaigns) {
        const scheduleConfig = this.parseScheduleConfig(campaign.scheduleConfig);

        if (this.isWithinWorkHours(scheduleConfig, now)) {
          logger.info('Restoring campaign after restart', {
            campaignId: campaign.id,
            name: campaign.name,
          });

          // Переводим в QUEUED для повторного запуска
          await this.repository.update(campaign.id, { status: 'QUEUED' });

          if (this.onCampaignReady) {
            await this.onCampaignReady(campaign.id);
          }
        } else {
          logger.info('Campaign not restored (outside work hours)', {
            campaignId: campaign.id,
            name: campaign.name,
          });

          // Ставим на паузу
          await this.repository.update(campaign.id, { status: 'PAUSED' });
          await this.repository.updateProgress(campaign.id, { pausedAt: now });
        }
      }

      logger.info('Campaign restoration after restart completed', { count: campaigns.length });
    } catch (error) {
      logger.error('Failed to restore campaigns after restart', { error });
      throw error;
    }
  }

  /**
   * Получение статуса планировщика
   */
  getStatus(): { isRunning: boolean; hasCallbacks: boolean } {
    return {
      isRunning: this.isRunning,
      hasCallbacks: !!(this.onCampaignReady || this.onCampaignPause || this.onCampaignResume),
    };
  }
}

