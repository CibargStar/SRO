/**
 * Сервис мониторинга сетевой активности профилей
 * 
 * Высокоуровневый сервис для мониторинга сетевой активности Chrome процессов.
 * Интегрируется с ChromeProcessService для получения информации о процессах.
 * 
 * @module modules/profiles/network-monitoring/network-monitor.service
 */

import { NetworkStatsManager, NetworkStats } from './network-stats.manager';
import { ChromeProcessService } from '../chrome-process/chrome-process.service';
import logger from '../../../config/logger';

/**
 * Сервис мониторинга сетевой активности
 */
export class NetworkMonitorService {
  private networkManager: NetworkStatsManager;

  constructor(private chromeProcessService: ChromeProcessService) {
    this.networkManager = new NetworkStatsManager();
  }

  /**
   * Получение статистики сетевой активности для профиля
   * 
   * @param profileId - ID профиля
   * @returns Статистика сетевой активности или null
   */
  async getProfileNetworkStats(profileId: string): Promise<NetworkStats | null> {
    try {
      // Получение информации о процессе Chrome
      const processInfo = this.chromeProcessService.getProcessInfo(profileId);

      if (!processInfo || !processInfo.pid) {
        // Процесс не запущен
        return null;
      }

      // Проверка кэша
      const cached = this.networkManager.getCachedStats(profileId);
      if (cached) {
        return cached;
      }

      // Получение статистики сетевой активности
      const stats = await this.networkManager.getNetworkStats(processInfo.pid, profileId);

      return stats;
    } catch (error) {
      logger.error('Failed to get profile network stats', {
        error: error instanceof Error ? error.message : 'Unknown error',
        profileId,
      });
      return null;
    }
  }

  /**
   * Получение статистики сетевой активности для всех запущенных профилей
   * 
   * @returns Массив статистик сетевой активности
   */
  async getAllProfilesNetworkStats(): Promise<NetworkStats[]> {
    try {
      const allProcesses = this.chromeProcessService.getAllProcesses();
      const statsPromises = allProcesses
        .filter((p) => p.pid !== undefined)
        .map((p) => this.networkManager.getNetworkStats(p.pid!, p.profileId));

      const stats = await Promise.all(statsPromises);
      return stats.filter((s): s is NetworkStats => s !== null);
    } catch (error) {
      logger.error('Failed to get all profiles network stats', {
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
  getCachedStats(profileId: string): NetworkStats | null {
    return this.networkManager.getCachedStats(profileId);
  }

  /**
   * Очистка кэша статистики
   * 
   * @param profileId - ID профиля (опционально)
   */
  clearCache(profileId?: string): void {
    this.networkManager.clearCache(profileId);
  }

  /**
   * Проверка превышения лимита сетевой активности
   * 
   * @param profileId - ID профиля
   * @param maxNetworkPerProfile - Максимальная сетевая активность в байтах/сек
   * @returns true если лимит превышен
   */
  async checkNetworkLimit(
    profileId: string,
    maxNetworkPerProfile: number
  ): Promise<{ exceeded: boolean; currentRate: number; maxRate: number }> {
    const stats = await this.getProfileNetworkStats(profileId);
    if (!stats) {
      return { exceeded: false, currentRate: 0, maxRate: maxNetworkPerProfile };
    }

    // Общая скорость (входящий + исходящий трафик)
    const totalRate = stats.receiveRate + stats.sendRate;
    const exceeded = totalRate > maxNetworkPerProfile;

    return {
      exceeded,
      currentRate: totalRate,
      maxRate: maxNetworkPerProfile,
    };
  }
}









