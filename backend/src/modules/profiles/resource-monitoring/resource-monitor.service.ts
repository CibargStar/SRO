/**
 * Сервис мониторинга ресурсов профилей
 * 
 * Высокоуровневый сервис для мониторинга использования ресурсов Chrome процессов.
 * Интегрируется с ChromeProcessService для получения информации о процессах.
 * 
 * @module modules/profiles/resource-monitoring/resource-monitor.service
 */

import { ProcessResourcesManager, ProcessResourceStats } from './process-resources.manager';
import { ChromeProcessService } from '../chrome-process/chrome-process.service';
import type { NetworkMonitorService } from '../network-monitoring/network-monitor.service';
import logger from '../../../config/logger';

/**
 * История статистики ресурсов
 */
export interface ResourceStatsHistory {
  profileId: string;
  timestamp: Date;
  stats: ProcessResourceStats;
}

/**
 * Сервис мониторинга ресурсов
 */
export class ResourceMonitorService {
  private resourcesManager: ProcessResourcesManager;
  private statsHistory: Map<string, ResourceStatsHistory[]> = new Map();
  private readonly maxHistorySize = 1000; // Максимальное количество записей в истории
  private collectionInterval: NodeJS.Timeout | null = null;
  private readonly defaultCollectionInterval = 60000; // 1 минута

  constructor(private chromeProcessService: ChromeProcessService) {
    this.resourcesManager = new ProcessResourcesManager();
  }

  /**
   * Получение статистики ресурсов для профиля
   * 
   * @param profileId - ID профиля
   * @returns Статистика ресурсов или null
   */
  async getProfileResourceStats(profileId: string): Promise<ProcessResourceStats | null> {
    try {
      // Получение информации о процессе Chrome
      const processInfo = this.chromeProcessService.getProcessInfo(profileId);

      if (!processInfo || !processInfo.pid) {
        // Процесс не запущен
        return null;
      }

      // Получение статистики ресурсов
      const stats = await this.resourcesManager.getProcessStats(processInfo.pid, profileId);

      return stats;
    } catch (error) {
      logger.error('Failed to get profile resource stats', {
        error: error instanceof Error ? error.message : 'Unknown error',
        profileId,
      });
      return null;
    }
  }

  /**
   * Получение статистики ресурсов для всех запущенных профилей
   * 
   * @returns Массив статистик ресурсов
   */
  async getAllProfilesResourceStats(): Promise<ProcessResourceStats[]> {
    try {
      const allProcesses = this.chromeProcessService.getAllProcesses();
      const statsPromises = allProcesses
        .filter((p) => p.pid !== undefined)
        .map((p) => this.resourcesManager.getProcessStats(p.pid!, p.profileId));

      const stats = await Promise.all(statsPromises);
      return stats.filter((s): s is ProcessResourceStats => s !== null);
    } catch (error) {
      logger.error('Failed to get all profiles resource stats', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return [];
    }
  }

  /**
   * Получение кэшированной статистики
   * 
   * @param profileId - ID профиля
   * @returns Кэшированная статистика или null
   */
  getCachedStats(profileId: string): ProcessResourceStats | null {
    return this.resourcesManager.getCachedStats(profileId);
  }

  /**
   * Очистка кэша статистики
   * 
   * @param profileId - ID профиля (опционально)
   */
  clearCache(profileId?: string): void {
    this.resourcesManager.clearCache(profileId);
  }

  /**
   * Проверка превышения лимитов ресурсов
   * 
   * @param profileId - ID профиля
   * @param limits - Лимиты ресурсов
   * @returns true если лимиты превышены
   */
  async checkResourceLimits(
    profileId: string,
    limits: {
      maxCpuPerProfile?: number | null;
      maxMemoryPerProfile?: number | null;
      maxNetworkPerProfile?: number | null;
    },
    networkMonitorService?: NetworkMonitorService // Опционально для избежания циклических зависимостей
  ): Promise<{ exceeded: boolean; details: { cpu?: boolean; memory?: boolean; network?: boolean } }> {
    const stats = await this.getProfileResourceStats(profileId);
    if (!stats) {
      return { exceeded: false, details: {} };
    }

    const details: { cpu?: boolean; memory?: boolean; network?: boolean } = {};
    let exceeded = false;

    // Проверка CPU (если лимит установлен)
    if (limits.maxCpuPerProfile !== null && limits.maxCpuPerProfile !== undefined) {
      const maxCpuPercent = limits.maxCpuPerProfile * 100;
      if (stats.cpuUsage > maxCpuPercent) {
        details.cpu = true;
        exceeded = true;
      }
    }

    // Проверка памяти (если лимит установлен)
    if (limits.maxMemoryPerProfile !== null && limits.maxMemoryPerProfile !== undefined) {
      if (stats.memoryUsage > limits.maxMemoryPerProfile) {
        details.memory = true;
        exceeded = true;
      }
    }

    // Проверка сетевой активности (если лимит установлен и networkMonitorService доступен)
    if (
      limits.maxNetworkPerProfile !== null &&
      limits.maxNetworkPerProfile !== undefined &&
      networkMonitorService
    ) {
      try {
        const networkCheck = await networkMonitorService.checkNetworkLimit(
          profileId,
          limits.maxNetworkPerProfile
        );
        if (networkCheck.exceeded) {
          details.network = true;
          exceeded = true;
        }
      } catch (error) {
        logger.warn('Failed to check network limit', {
          error: error instanceof Error ? error.message : 'Unknown error',
          profileId,
        });
      }
    }

    return { exceeded, details };
  }

  /**
   * Запуск периодического сбора статистики
   * 
   * @param interval - Интервал сбора в миллисекундах (по умолчанию 1 минута)
   */
  startPeriodicCollection(interval: number = this.defaultCollectionInterval): void {
    if (this.collectionInterval) {
      logger.warn('Periodic stats collection already started');
      return;
    }

    logger.info('Starting periodic resource stats collection', { interval });

    this.collectionInterval = setInterval(async () => {
      await this.collectAllProfilesStats();
    }, interval);
  }

  /**
   * Остановка периодического сбора статистики
   */
  stopPeriodicCollection(): void {
    if (this.collectionInterval) {
      clearInterval(this.collectionInterval);
      this.collectionInterval = null;
      logger.info('Periodic resource stats collection stopped');
    }
  }

  /**
   * Сбор статистики для всех запущенных профилей
   */
  private async collectAllProfilesStats(): Promise<void> {
    try {
      const allStats = await this.getAllProfilesResourceStats();
      const timestamp = new Date();

      for (const stats of allStats) {
        const historyEntry: ResourceStatsHistory = {
          profileId: stats.profileId,
          timestamp,
          stats,
        };

        this.addToHistory(stats.profileId, historyEntry);

        // Вызов callback для проверки лимитов (если установлен)
        if (this.onStatsCollected) {
          try {
            await this.onStatsCollected(stats.profileId, stats);
          } catch (error) {
            logger.error('Error in stats collected callback', {
              error: error instanceof Error ? error.message : 'Unknown error',
              profileId: stats.profileId,
            });
          }
        }
      }
    } catch (error) {
      logger.error('Failed to collect profiles stats', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Callback для обработки собранной статистики (для проверки лимитов)
   */
  private onStatsCollected?: (profileId: string, stats: ProcessResourceStats) => Promise<void>;

  /**
   * Установка callback для обработки собранной статистики
   * 
   * @param callback - Функция обратного вызова
   */
  setStatsCollectedCallback(
    callback: (profileId: string, stats: ProcessResourceStats) => Promise<void>
  ): void {
    this.onStatsCollected = callback;
  }

  /**
   * Получение истории статистики ресурсов профиля
   * 
   * @param profileId - ID профиля
   * @param limit - Максимальное количество записей
   * @param from - Начальная дата (опционально)
   * @param to - Конечная дата (опционально)
   * @returns История статистики
   */
  getResourceStatsHistory(
    profileId: string,
    limit: number = 100,
    from?: Date,
    to?: Date
  ): ResourceStatsHistory[] {
    const history = this.statsHistory.get(profileId) || [];

    let filtered = history;

    // Фильтрация по датам
    if (from || to) {
      filtered = history.filter((entry) => {
        if (from && entry.timestamp < from) return false;
        if (to && entry.timestamp > to) return false;
        return true;
      });
    }

    // Ограничение количества записей
    return filtered.slice(-limit);
  }

  /**
   * Добавление записи в историю
   * 
   * @param profileId - ID профиля
   * @param entry - Запись истории
   */
  private addToHistory(profileId: string, entry: ResourceStatsHistory): void {
    if (!this.statsHistory.has(profileId)) {
      this.statsHistory.set(profileId, []);
    }

    const history = this.statsHistory.get(profileId)!;
    history.push(entry);

    // Ограничение размера истории
    if (history.length > this.maxHistorySize) {
      history.shift();
    }
  }

  /**
   * Очистка истории статистики
   * 
   * @param profileId - ID профиля (опционально)
   */
  clearHistory(profileId?: string): void {
    if (profileId) {
      this.statsHistory.delete(profileId);
    } else {
      this.statsHistory.clear();
    }
  }
}

