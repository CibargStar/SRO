/**
 * Агрегатор статистики профилей
 * 
 * Агрегирует статистику ресурсов и сетевой активности за различные периоды.
 * 
 * @module modules/profiles/analytics/stats-aggregator
 */

import { NetworkStats } from '../network-monitoring/network-stats.manager';
import { ResourceStatsHistory } from '../resource-monitoring/resource-monitor.service';

/**
 * Период агрегации
 */
export type AggregationPeriod = 'hour' | 'day' | 'week' | 'month';

/**
 * Агрегированная статистика ресурсов
 */
export interface AggregatedResourceStats {
  /** Период */
  period: AggregationPeriod;
  /** Начало периода */
  periodStart: Date;
  /** Конец периода */
  periodEnd: Date;
  /** Среднее использование CPU (%) */
  avgCpuUsage: number;
  /** Максимальное использование CPU (%) */
  maxCpuUsage: number;
  /** Минимальное использование CPU (%) */
  minCpuUsage: number;
  /** Среднее использование памяти (MB) */
  avgMemoryUsage: number;
  /** Максимальное использование памяти (MB) */
  maxMemoryUsage: number;
  /** Минимальное использование памяти (MB) */
  minMemoryUsage: number;
  /** Количество записей */
  sampleCount: number;
}

/**
 * Агрегированная статистика сетевой активности
 */
export interface AggregatedNetworkStats {
  /** Период */
  period: AggregationPeriod;
  /** Начало периода */
  periodStart: Date;
  /** Конец периода */
  periodEnd: Date;
  /** Общий входящий трафик (байты) */
  totalBytesReceived: number;
  /** Общий исходящий трафик (байты) */
  totalBytesSent: number;
  /** Средняя скорость входящего трафика (байты/сек) */
  avgReceiveRate: number;
  /** Максимальная скорость входящего трафика (байты/сек) */
  maxReceiveRate: number;
  /** Средняя скорость исходящего трафика (байты/сек) */
  avgSendRate: number;
  /** Максимальная скорость исходящего трафика (байты/сек) */
  maxSendRate: number;
  /** Среднее количество соединений */
  avgConnectionsCount: number;
  /** Количество записей */
  sampleCount: number;
}

/**
 * Агрегатор статистики
 */
export class StatsAggregator {
  /**
   * Агрегация статистики ресурсов за период
   * 
   * @param history - История статистики ресурсов
   * @param period - Период агрегации
   * @returns Агрегированная статистика
   */
  aggregateResourceStats(
    history: ResourceStatsHistory[],
    period: AggregationPeriod
  ): AggregatedResourceStats[] {
    if (history.length === 0) {
      return [];
    }

    // Группировка по периодам
    const grouped = this.groupByPeriod(history, period, (entry) => entry.timestamp);

    return Array.from(grouped.entries()).map(([periodKey, entries]) => {
      const stats = entries.map((entry) => entry.stats);
      const cpuUsages = stats.map((s) => s.cpuUsage).filter((v) => v !== null && v !== undefined);
      const memoryUsages = stats
        .map((s) => s.memoryUsage)
        .filter((v) => v !== null && v !== undefined);

      const periodDates = this.getPeriodDates(periodKey, period);

      return {
        period,
        periodStart: periodDates.start,
        periodEnd: periodDates.end,
        avgCpuUsage: this.average(cpuUsages),
        maxCpuUsage: Math.max(...cpuUsages, 0),
        minCpuUsage: Math.min(...cpuUsages, 0),
        avgMemoryUsage: this.average(memoryUsages),
        maxMemoryUsage: Math.max(...memoryUsages, 0),
        minMemoryUsage: Math.min(...memoryUsages, 0),
        sampleCount: entries.length,
      };
    });
  }

  /**
   * Агрегация статистики сетевой активности за период
   * 
   * @param networkHistory - История сетевой статистики
   * @param period - Период агрегации
   * @returns Агрегированная статистика
   */
  aggregateNetworkStats(
    networkHistory: Array<{ timestamp: Date; stats: NetworkStats }>,
    period: AggregationPeriod
  ): AggregatedNetworkStats[] {
    if (networkHistory.length === 0) {
      return [];
    }

    // Группировка по периодам
    const grouped = this.groupByPeriod(networkHistory, period, (entry) => entry.timestamp);

    return Array.from(grouped.entries()).map(([periodKey, entries]) => {
      const stats = entries.map((entry) => entry.stats);
      const receiveRates = stats.map((s) => s.receiveRate).filter((v) => v !== null && v !== undefined);
      const sendRates = stats.map((s) => s.sendRate).filter((v) => v !== null && v !== undefined);
      const connectionsCounts = stats
        .map((s) => s.connectionsCount)
        .filter((v) => v !== null && v !== undefined);

      // Расчет общего трафика (приблизительно, на основе скорости)
      const totalBytesReceived = stats.reduce((sum, s) => sum + s.bytesReceived, 0);
      const totalBytesSent = stats.reduce((sum, s) => sum + s.bytesSent, 0);

      const periodDates = this.getPeriodDates(periodKey, period);

      return {
        period,
        periodStart: periodDates.start,
        periodEnd: periodDates.end,
        totalBytesReceived,
        totalBytesSent,
        avgReceiveRate: this.average(receiveRates),
        maxReceiveRate: Math.max(...receiveRates, 0),
        avgSendRate: this.average(sendRates),
        maxSendRate: Math.max(...sendRates, 0),
        avgConnectionsCount: this.average(connectionsCounts),
        sampleCount: entries.length,
      };
    });
  }

  /**
   * Группировка данных по периодам
   * 
   * @param data - Данные для группировки
   * @param period - Период агрегации
   * @param getDate - Функция получения даты из элемента
   * @returns Сгруппированные данные
   */
  private groupByPeriod<T>(
    data: T[],
    period: AggregationPeriod,
    getDate: (item: T) => Date
  ): Map<string, T[]> {
    const grouped = new Map<string, T[]>();

    for (const item of data) {
      const date = getDate(item);
      const periodKey = this.getPeriodKey(date, period);

      if (!grouped.has(periodKey)) {
        grouped.set(periodKey, []);
      }

      grouped.get(periodKey)!.push(item);
    }

    return grouped;
  }

  /**
   * Получение ключа периода для даты
   * 
   * @param date - Дата
   * @param period - Период агрегации
   * @returns Ключ периода
   */
  private getPeriodKey(date: Date, period: AggregationPeriod): string {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const hour = date.getHours();

    switch (period) {
      case 'hour':
        return `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}-${hour.toString().padStart(2, '0')}`;
      case 'day':
        return `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
      case 'week': {
        const week = Math.floor(day / 7);
        return `${year}-W${week.toString().padStart(2, '0')}`;
      }
      case 'month':
        return `${year}-${month.toString().padStart(2, '0')}`;
      default:
        return `${year}-${month}-${day}`;
    }
  }

  /**
   * Получение дат начала и конца периода
   * 
   * @param periodKey - Ключ периода
   * @param period - Период агрегации
   * @returns Даты начала и конца периода
   */
  private getPeriodDates(periodKey: string, period: AggregationPeriod): { start: Date; end: Date } {
    const parts = periodKey.split('-');
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;

    let start: Date;
    let end: Date;

    switch (period) {
      case 'hour': {
        const day = parseInt(parts[2], 10);
        const hour = parseInt(parts[3], 10);
        start = new Date(year, month, day, hour, 0, 0);
        end = new Date(year, month, day, hour, 59, 59, 999);
        break;
      }
      case 'day': {
        const day = parseInt(parts[2], 10);
        start = new Date(year, month, day, 0, 0, 0);
        end = new Date(year, month, day, 23, 59, 59, 999);
        break;
      }
      case 'week': {
        const week = parseInt(parts[1].substring(1), 10);
        const firstDay = week * 7 - 6;
        start = new Date(year, month, firstDay, 0, 0, 0);
        end = new Date(year, month, firstDay + 6, 23, 59, 59, 999);
        break;
      }
      case 'month':
      default: {
        start = new Date(year, month, 1, 0, 0, 0);
        end = new Date(year, month + 1, 0, 23, 59, 59, 999);
        break;
      }
    }

    return { start, end };
  }

  /**
   * Вычисление среднего значения
   * 
   * @param values - Массив значений
   * @returns Среднее значение
   */
  private average(values: number[]): number {
    if (values.length === 0) {
      return 0;
    }
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }
}






