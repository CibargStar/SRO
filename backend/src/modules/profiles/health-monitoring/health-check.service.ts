/**
 * Сервис проверки здоровья профилей
 * 
 * Высокоуровневый сервис для мониторинга здоровья профилей.
 * Интегрируется с ChromeProcessService и ResourceMonitorService.
 * 
 * @module modules/profiles/health-monitoring/health-check.service
 */

import { ProfileHealthManager, ProfileHealthCheck, HealthCheckConfig } from './profile-health.manager';
import { ChromeProcessService } from '../chrome-process/chrome-process.service';
import { ResourceMonitorService } from '../resource-monitoring/resource-monitor.service';
import { ProfileLimitsService } from '../limits/limits.service';
import logger from '../../../config/logger';

/**
 * Сервис проверки здоровья профилей
 */
export class HealthCheckService {
  private healthManager: ProfileHealthManager;

  constructor(
    private chromeProcessService: ChromeProcessService,
    private resourceMonitorService: ResourceMonitorService,
    private limitsService?: ProfileLimitsService
  ) {
    this.healthManager = new ProfileHealthManager();
  }

  /**
   * Проверка здоровья профиля
   * 
   * @param userId - ID пользователя
   * @param profileId - ID профиля
   * @returns Результат проверки здоровья
   */
  async checkProfileHealth(userId: string, profileId: string): Promise<ProfileHealthCheck> {
    try {
      // Получение информации о процессе
      const processInfo = this.chromeProcessService.getProcessInfo(profileId);

      // Получение статистики ресурсов
      const resourceStats = await this.resourceMonitorService.getProfileResourceStats(profileId);

      // Получение лимитов пользователя (если limitsService доступен)
      let config: HealthCheckConfig | undefined;
      if (this.limitsService) {
        try {
          const limits = await this.limitsService.getUserLimits(userId);
          if (limits.maxCpuPerProfile !== null || limits.maxMemoryPerProfile !== null) {
            config = {
              maxCpuUsage: limits.maxCpuPerProfile ? limits.maxCpuPerProfile * 100 : undefined,
              maxMemoryUsage: limits.maxMemoryPerProfile || undefined,
            };
          }
        } catch (error) {
          logger.warn('Failed to get user limits for health check', {
            error: error instanceof Error ? error.message : 'Unknown error',
            userId,
            profileId,
          });
        }
      }

      // Проверка здоровья
      const healthCheck = this.healthManager.checkProfileHealth(
        profileId,
        processInfo,
        resourceStats,
        config
      );

      logger.debug('Profile health check completed', {
        profileId,
        userId,
        status: healthCheck.status,
      });

      return healthCheck;
    } catch (error) {
      logger.error('Failed to check profile health', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
        profileId,
      });

      // Возвращаем unhealthy статус при ошибке
      return this.healthManager.checkProfileHealth(profileId, null, null);
    }
  }

  /**
   * Получение последней проверки здоровья
   * 
   * @param profileId - ID профиля
   * @returns Последняя проверка здоровья или null
   */
  getLastHealthCheck(profileId: string): ProfileHealthCheck | null {
    return this.healthManager.getLastHealthCheck(profileId);
  }

  /**
   * Получение истории проверок здоровья
   * 
   * @param profileId - ID профиля
   * @param limit - Максимальное количество записей
   * @returns История проверок здоровья
   */
  getHealthHistory(profileId: string, limit: number = 100): ProfileHealthCheck[] {
    return this.healthManager.getHealthHistory(profileId, limit);
  }

  /**
   * Получение статистики здоровья профиля
   * 
   * @param profileId - ID профиля
   * @returns Статистика здоровья
   */
  getHealthStats(profileId: string) {
    return this.healthManager.getHealthStats(profileId);
  }
}









