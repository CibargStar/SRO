/**
 * Campaign Stats Service
 * 
 * Отвечает за:
 * - Сбор и агрегацию статистики кампании
 * - Статистика по мессенджерам (WA vs TG)
 * - Статистика по профилям
 * - Экспорт результатов в CSV
 * 
 * @module modules/campaigns/stats/campaign-stats.service
 */

import { PrismaClient } from '@prisma/client';
import logger from '../../../config/logger';
import { CampaignLogRepository } from '../campaigns.repository';

// ============================================
// Типы
// ============================================

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
  startedAt: Date | null;
  completedAt: Date | null;
  duration: number | null; // в секундах
  avgContactTime: number | null; // среднее время на контакт в секундах
  
  // По мессенджерам
  byMessenger: {
    whatsapp: MessengerStats;
    telegram: MessengerStats;
    unknown: MessengerStats;
  };
  
  // По профилям
  byProfile: ProfileStats[];
  
  // Ошибки
  errorCount: number;
  topErrors: ErrorStats[];
}

export interface MessengerStats {
  total: number;
  sent: number;
  failed: number;
  skipped: number;
  successRate: number;
}

export interface ProfileStats {
  profileId: string;
  profileName: string;
  assignedCount: number;
  processedCount: number;
  successCount: number;
  failedCount: number;
  progress: number;
  successRate: number;
}

export interface ErrorStats {
  error: string;
  count: number;
  percentage: number;
}

export interface ExportOptions {
  format: 'csv' | 'json';
  includeContacts: boolean;
  includeLogs: boolean;
  includeErrors: boolean;
}

// ============================================
// Campaign Stats Service
// ============================================

export class CampaignStatsService {
  private logRepository: CampaignLogRepository;

  constructor(private prisma: PrismaClient) {
    this.logRepository = new CampaignLogRepository(prisma);
  }

  /**
   * Получение полной статистики кампании
   */
  async getStats(campaignId: string): Promise<CampaignStats | null> {
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

      // Получаем статистику по мессенджерам
      const messengerStats = await this.getStatsByMessenger(campaignId);

      // Получаем статистику по профилям
      const profileStats = await this.getStatsByProfile(campaignId);

      // Получаем топ ошибок
      const topErrors = await this.getTopErrors(campaignId);

      // Подсчёт количества ошибок в логах
      const errorCount = await this.logRepository.countErrors(campaignId);

      // Расчёт общих показателей
      const totalContacts = campaign.totalContacts || 0;
      const processedContacts = campaign.processedContacts || 0;
      const successfulContacts = campaign.successfulContacts || 0;
      const failedContacts = campaign.failedContacts || 0;
      const skippedContacts = campaign.skippedContacts || 0;

      const progress = totalContacts > 0 ? Math.round((processedContacts / totalContacts) * 100) : 0;
      const successRate = processedContacts > 0 ? Math.round((successfulContacts / processedContacts) * 100) : 0;
      const failureRate = processedContacts > 0 ? Math.round((failedContacts / processedContacts) * 100) : 0;
      const skipRate = processedContacts > 0 ? Math.round((skippedContacts / processedContacts) * 100) : 0;

      // Расчёт времени
      let duration: number | null = null;
      let avgContactTime: number | null = null;

      if (campaign.startedAt) {
        const endTime = campaign.completedAt || new Date();
        duration = Math.round((endTime.getTime() - campaign.startedAt.getTime()) / 1000);
        
        if (processedContacts > 0) {
          avgContactTime = Math.round(duration / processedContacts);
        }
      }

      return {
        campaignId,
        name: campaign.name,
        status: campaign.status,
        totalContacts,
        processedContacts,
        successfulContacts,
        failedContacts,
        skippedContacts,
        progress,
        successRate,
        failureRate,
        skipRate,
        startedAt: campaign.startedAt,
        completedAt: campaign.completedAt,
        duration,
        avgContactTime,
        byMessenger: messengerStats,
        byProfile: profileStats,
        errorCount,
        topErrors,
      };
    } catch (error) {
      logger.error('Failed to get campaign stats', { error, campaignId });
      throw error;
    }
  }

  /**
   * Получение статистики по мессенджерам
   */
  async getStatsByMessenger(campaignId: string): Promise<{
    whatsapp: MessengerStats;
    telegram: MessengerStats;
    unknown: MessengerStats;
  }> {
    try {
      // Группировка по мессенджеру и статусу
      const stats = await this.prisma.campaignMessage.groupBy({
        by: ['messenger', 'status'],
        where: { campaignId },
        _count: { id: true },
      });

      // Инициализация результатов
      const result = {
        whatsapp: { total: 0, sent: 0, failed: 0, skipped: 0, successRate: 0 },
        telegram: { total: 0, sent: 0, failed: 0, skipped: 0, successRate: 0 },
        unknown: { total: 0, sent: 0, failed: 0, skipped: 0, successRate: 0 },
      };

      // Распределение по мессенджерам
      stats.forEach((s) => {
        const messenger = s.messenger;
        const key: keyof typeof result = 
          messenger === 'WHATSAPP' ? 'whatsapp' :
          messenger === 'TELEGRAM' ? 'telegram' :
          'unknown';

        result[key].total += s._count.id;

        switch (s.status) {
          case 'SENT':
            result[key].sent += s._count.id;
            break;
          case 'FAILED':
            result[key].failed += s._count.id;
            break;
          case 'SKIPPED':
            result[key].skipped += s._count.id;
            break;
        }
      });

      // Расчёт success rate
      Object.keys(result).forEach((key) => {
        const k = key as keyof typeof result;
        const processed = result[k].sent + result[k].failed + result[k].skipped;
        result[k].successRate = processed > 0 
          ? Math.round((result[k].sent / processed) * 100) 
          : 0;
      });

      return result;
    } catch (error) {
      logger.error('Failed to get stats by messenger', { error, campaignId });
      throw error;
    }
  }

  /**
   * Получение статистики по профилям
   */
  async getStatsByProfile(campaignId: string): Promise<ProfileStats[]> {
    try {
      const campaignProfiles = await this.prisma.campaignProfile.findMany({
        where: { campaignId },
        include: {
          profile: {
            select: { name: true },
          },
        },
      });

      return campaignProfiles.map((cp) => {
        const progress = cp.assignedCount > 0 
          ? Math.round((cp.processedCount / cp.assignedCount) * 100) 
          : 0;
        const successRate = cp.processedCount > 0 
          ? Math.round((cp.successCount / cp.processedCount) * 100) 
          : 0;

        return {
          profileId: cp.profileId,
          profileName: cp.profile.name,
          assignedCount: cp.assignedCount,
          processedCount: cp.processedCount,
          successCount: cp.successCount,
          failedCount: cp.failedCount,
          progress,
          successRate,
        };
      });
    } catch (error) {
      logger.error('Failed to get stats by profile', { error, campaignId });
      throw error;
    }
  }

  /**
   * Получение топ ошибок
   */
  async getTopErrors(campaignId: string, limit: number = 10): Promise<ErrorStats[]> {
    try {
      // Получаем сообщения с ошибками
      const failedMessages = await this.prisma.campaignMessage.findMany({
        where: {
          campaignId,
          status: 'FAILED',
          errorMessage: { not: null },
        },
        select: { errorMessage: true },
      });

      // Группируем по тексту ошибки
      const errorCounts: Record<string, number> = {};
      
      failedMessages.forEach((m) => {
        if (m.errorMessage) {
          // Нормализуем текст ошибки (убираем детали)
          const normalizedError = this.normalizeError(m.errorMessage);
          errorCounts[normalizedError] = (errorCounts[normalizedError] || 0) + 1;
        }
      });

      // Сортируем и берём top N
      const totalErrors = failedMessages.length;
      const topErrors = Object.entries(errorCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
        .map(([error, count]) => ({
          error,
          count,
          percentage: totalErrors > 0 ? Math.round((count / totalErrors) * 100) : 0,
        }));

      return topErrors;
    } catch (error) {
      logger.error('Failed to get top errors', { error, campaignId });
      throw error;
    }
  }

  /**
   * Нормализация текста ошибки
   */
  private normalizeError(error: string): string {
    // Убираем динамические части (номера телефонов, ID и т.д.)
    return error
      .replace(/\+?\d{10,15}/g, '[phone]')
      .replace(/[a-f0-9-]{36}/gi, '[id]')
      .substring(0, 100);
  }

  /**
   * Экспорт результатов кампании в CSV
   */
  async exportToCsv(campaignId: string, options: ExportOptions = {
    format: 'csv',
    includeContacts: true,
    includeLogs: false,
    includeErrors: true,
  }): Promise<string> {
    try {
      const campaign = await this.prisma.campaign.findUnique({
        where: { id: campaignId },
        select: { name: true, status: true, startedAt: true, completedAt: true },
      });

      if (!campaign) {
        throw new Error('Campaign not found');
      }

      // Получаем статистику
      const stats = await this.getStats(campaignId);
      if (!stats) {
        throw new Error('Stats not found');
      }

      let csvContent = '';

      // Заголовок с общей информацией
      csvContent += 'Отчёт по кампании\n';
      csvContent += `Название,${this.escapeCsvValue(campaign.name)}\n`;
      csvContent += `Статус,${stats.status}\n`;
      csvContent += `Дата начала,${stats.startedAt ? stats.startedAt.toISOString() : '-'}\n`;
      csvContent += `Дата завершения,${stats.completedAt ? stats.completedAt.toISOString() : '-'}\n`;
      csvContent += '\n';

      // Общая статистика
      csvContent += 'Общая статистика\n';
      csvContent += 'Показатель,Значение\n';
      csvContent += `Всего контактов,${stats.totalContacts}\n`;
      csvContent += `Обработано,${stats.processedContacts}\n`;
      csvContent += `Успешно,${stats.successfulContacts}\n`;
      csvContent += `Ошибки,${stats.failedContacts}\n`;
      csvContent += `Пропущено,${stats.skippedContacts}\n`;
      csvContent += `Прогресс,${stats.progress}%\n`;
      csvContent += `Успешность,${stats.successRate}%\n`;
      csvContent += '\n';

      // Статистика по мессенджерам
      csvContent += 'Статистика по мессенджерам\n';
      csvContent += 'Мессенджер,Всего,Отправлено,Ошибки,Пропущено,Успешность\n';
      csvContent += `WhatsApp,${stats.byMessenger.whatsapp.total},${stats.byMessenger.whatsapp.sent},${stats.byMessenger.whatsapp.failed},${stats.byMessenger.whatsapp.skipped},${stats.byMessenger.whatsapp.successRate}%\n`;
      csvContent += `Telegram,${stats.byMessenger.telegram.total},${stats.byMessenger.telegram.sent},${stats.byMessenger.telegram.failed},${stats.byMessenger.telegram.skipped},${stats.byMessenger.telegram.successRate}%\n`;
      csvContent += '\n';

      // Статистика по профилям
      csvContent += 'Статистика по профилям\n';
      csvContent += 'Профиль,Назначено,Обработано,Успешно,Ошибки,Прогресс,Успешность\n';
      stats.byProfile.forEach((p) => {
        csvContent += `${this.escapeCsvValue(p.profileName)},${p.assignedCount},${p.processedCount},${p.successCount},${p.failedCount},${p.progress}%,${p.successRate}%\n`;
      });
      csvContent += '\n';

      // Топ ошибок
      if (options.includeErrors && stats.topErrors.length > 0) {
        csvContent += 'Топ ошибок\n';
        csvContent += 'Ошибка,Количество,Процент\n';
        stats.topErrors.forEach((e) => {
          csvContent += `${this.escapeCsvValue(e.error)},${e.count},${e.percentage}%\n`;
        });
        csvContent += '\n';
      }

      // Детализация по контактам
      if (options.includeContacts) {
        csvContent += await this.getContactsExport(campaignId);
      }

      // Логи
      if (options.includeLogs) {
        csvContent += await this.getLogsExport(campaignId);
      }

      return csvContent;
    } catch (error) {
      logger.error('Failed to export to CSV', { error, campaignId });
      throw error;
    }
  }

  /**
   * Экспорт списка контактов
   */
  private async getContactsExport(campaignId: string): Promise<string> {
    const messages = await this.prisma.campaignMessage.findMany({
      where: { campaignId },
      include: {
        client: {
          select: { firstName: true, lastName: true },
        },
        clientPhone: {
          select: { phone: true },
        },
        profile: {
          select: { name: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    let csv = 'Детализация по контактам\n';
    csv += 'Имя,Фамилия,Телефон,Мессенджер,Статус,Профиль,Время отправки,Ошибка\n';

    messages.forEach((m) => {
      csv += `${this.escapeCsvValue(m.client.firstName || '')},`;
      csv += `${this.escapeCsvValue(m.client.lastName || '')},`;
      csv += `${m.clientPhone.phone},`;
      csv += `${m.messenger || '-'},`;
      csv += `${m.status},`;
      csv += `${this.escapeCsvValue(m.profile?.name || '-')},`;
      csv += `${m.sentAt ? m.sentAt.toISOString() : '-'},`;
      csv += `${this.escapeCsvValue(m.errorMessage || '')}\n`;
    });

    csv += '\n';
    return csv;
  }

  /**
   * Экспорт логов
   */
  private async getLogsExport(campaignId: string): Promise<string> {
    const logs = await this.prisma.campaignLog.findMany({
      where: { campaignId },
      orderBy: { createdAt: 'desc' },
      take: 1000, // Ограничение
    });

    let csv = 'Логи событий\n';
    csv += 'Время,Уровень,Действие,Сообщение\n';

    logs.forEach((log) => {
      csv += `${log.createdAt.toISOString()},`;
      csv += `${log.level},`;
      csv += `${log.action},`;
      csv += `${this.escapeCsvValue(log.message)}\n`;
    });

    csv += '\n';
    return csv;
  }

  /**
   * Экранирование значения для CSV
   */
  private escapeCsvValue(value: string): string {
    if (!value) return '';
    
    // Если значение содержит запятую, кавычки или перевод строки - оборачиваем в кавычки
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    
    return value;
  }

  /**
   * Получение сводки за период
   */
  async getSummaryForPeriod(userId: string, startDate: Date, endDate: Date): Promise<{
    totalCampaigns: number;
    completedCampaigns: number;
    totalContacts: number;
    successfulContacts: number;
    failedContacts: number;
    averageSuccessRate: number;
    byMessenger: {
      whatsapp: number;
      telegram: number;
    };
  }> {
    try {
      const campaigns = await this.prisma.campaign.findMany({
        where: {
          userId,
          createdAt: { gte: startDate, lte: endDate },
          status: { in: ['COMPLETED', 'RUNNING', 'PAUSED', 'CANCELLED'] },
        },
        select: {
          status: true,
          totalContacts: true,
          successfulContacts: true,
          failedContacts: true,
        },
      });

      let totalContacts = 0;
      let successfulContacts = 0;
      let failedContacts = 0;
      let completedCampaigns = 0;

      campaigns.forEach((c) => {
        totalContacts += c.totalContacts || 0;
        successfulContacts += c.successfulContacts || 0;
        failedContacts += c.failedContacts || 0;
        if (c.status === 'COMPLETED') {
          completedCampaigns++;
        }
      });

      const averageSuccessRate = totalContacts > 0 
        ? Math.round((successfulContacts / totalContacts) * 100) 
        : 0;

      // Статистика по мессенджерам за период
      const messengerStats = await this.prisma.campaignMessage.groupBy({
        by: ['messenger'],
        where: {
          campaign: {
            userId,
            createdAt: { gte: startDate, lte: endDate },
          },
          status: 'SENT',
        },
        _count: { id: true },
      });

      const byMessenger = { whatsapp: 0, telegram: 0 };
      messengerStats.forEach((s) => {
        if (s.messenger === 'WHATSAPP') byMessenger.whatsapp = s._count.id;
        if (s.messenger === 'TELEGRAM') byMessenger.telegram = s._count.id;
      });

      return {
        totalCampaigns: campaigns.length,
        completedCampaigns,
        totalContacts,
        successfulContacts,
        failedContacts,
        averageSuccessRate,
        byMessenger,
      };
    } catch (error) {
      logger.error('Failed to get summary for period', { error, userId, startDate, endDate });
      throw error;
    }
  }
}

