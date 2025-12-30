/**
 * Сервис аналитики профилей
 * 
 * Предоставляет аналитику и отчетность по использованию ресурсов профилей.
 * 
 * @module modules/profiles/analytics/analytics.service
 */

import { StatsAggregator, AggregatedResourceStats, AggregatedNetworkStats, AggregationPeriod } from './stats-aggregator';
import { ResourceMonitorService } from '../resource-monitoring/resource-monitor.service';
import { NetworkMonitorService } from '../network-monitoring/network-monitor.service';
import { NetworkStats } from '../network-monitoring/network-stats.manager';
import logger from '../../../config/logger';

/**
 * Полная аналитика профиля
 */
export interface ProfileAnalytics {
  /** ID профиля */
  profileId: string;
  /** Агрегированная статистика ресурсов */
  resourceStats: AggregatedResourceStats[];
  /** Агрегированная статистика сетевой активности */
  networkStats: AggregatedNetworkStats[];
  /** Период агрегации */
  period: AggregationPeriod;
  /** Начало периода анализа */
  from: Date;
  /** Конец периода анализа */
  to: Date;
}

/**
 * Сервис аналитики
 */
export class AnalyticsService {
  private aggregator: StatsAggregator;
  private networkHistory: Map<string, Array<{ timestamp: Date; stats: NetworkStats }>> = new Map();
  private readonly maxNetworkHistorySize = 1000;

  constructor(
    private resourceMonitorService: ResourceMonitorService,
    _networkMonitorService: NetworkMonitorService
  ) {
    this.aggregator = new StatsAggregator();
  }

  /**
   * Получение аналитики профиля
   * 
   * @param profileId - ID профиля
   * @param period - Период агрегации
   * @param from - Начальная дата (опционально)
   * @param to - Конечная дата (опционально)
   * @returns Аналитика профиля
   */
  async getProfileAnalytics(
    profileId: string,
    period: AggregationPeriod = 'day',
    from?: Date,
    to?: Date
  ): Promise<ProfileAnalytics> {
    try {
      // Получение истории статистики ресурсов
      const resourceHistory = this.resourceMonitorService.getResourceStatsHistory(
        profileId,
        10000, // Большой лимит для агрегации
        from,
        to
      );

      // Получение истории сетевой статистики
      const networkHistory = this.getNetworkHistory(profileId, from, to);

      // Агрегация статистики ресурсов
      const aggregatedResourceStats = this.aggregator.aggregateResourceStats(
        resourceHistory,
        period
      );

      // Агрегация статистики сетевой активности
      const aggregatedNetworkStats = this.aggregator.aggregateNetworkStats(
        networkHistory,
        period
      );

      // Определение периода анализа
      const analysisFrom = from || (resourceHistory.length > 0 ? resourceHistory[0].timestamp : new Date());
      const analysisTo = to || new Date();

      return {
        profileId,
        resourceStats: aggregatedResourceStats,
        networkStats: aggregatedNetworkStats,
        period,
        from: analysisFrom,
        to: analysisTo,
      };
    } catch (error) {
      logger.error('Failed to get profile analytics', {
        error: error instanceof Error ? error.message : 'Unknown error',
        profileId,
        period,
      });
      throw error;
    }
  }

  /**
   * Получение истории сетевой статистики
   * 
   * @param profileId - ID профиля
   * @param from - Начальная дата (опционально)
   * @param to - Конечная дата (опционально)
   * @returns История сетевой статистики
   */
  private getNetworkHistory(
    profileId: string,
    from?: Date,
    to?: Date
  ): Array<{ timestamp: Date; stats: NetworkStats }> {
    const history = this.networkHistory.get(profileId) || [];

    let filtered = history;

    // Фильтрация по датам
    if (from || to) {
      filtered = history.filter((entry) => {
        if (from && entry.timestamp < from) return false;
        if (to && entry.timestamp > to) return false;
        return true;
      });
    }

    return filtered;
  }

  /**
   * Добавление записи сетевой статистики в историю
   * 
   * @param profileId - ID профиля
   * @param stats - Статистика сетевой активности
   */
  addNetworkStatsToHistory(profileId: string, stats: NetworkStats): void {
    if (!this.networkHistory.has(profileId)) {
      this.networkHistory.set(profileId, []);
    }

    const history = this.networkHistory.get(profileId)!;
    history.push({
      timestamp: stats.timestamp,
      stats,
    });

    // Ограничение размера истории
    if (history.length > this.maxNetworkHistorySize) {
      history.shift();
    }
  }

  /**
   * Очистка истории сетевой статистики
   * 
   * @param profileId - ID профиля (опционально)
   */
  clearNetworkHistory(profileId?: string): void {
    if (profileId) {
      this.networkHistory.delete(profileId);
    } else {
      this.networkHistory.clear();
    }
  }
}






