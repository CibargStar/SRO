/**
 * Сервис автоматического перезапуска профилей
 * 
 * Отслеживает состояние профилей и автоматически перезапускает их
 * при сбоях или нездоровом состоянии.
 * 
 * @module modules/profiles/auto-restart/auto-restart.service
 */

import { HealthCheckService } from '../health-monitoring/health-check.service';
import { ChromeProcessService } from '../chrome-process/chrome-process.service';
import { ProfilesService } from '../profiles.service';
import { NotificationService } from '../notifications/notification.service';
import type { ProfileHealthCheck } from '../health-monitoring/profile-health.manager';
import logger from '../../../config/logger';

/**
 * Конфигурация автоматического перезапуска
 */
export interface AutoRestartConfig {
  /** Включен ли автоматический перезапуск */
  enabled: boolean;
  /** Максимальное количество попыток перезапуска */
  maxRestartAttempts: number;
  /** Интервал между попытками перезапуска в миллисекундах */
  restartInterval: number;
  /** Задержка перед перезапуском после сбоя в миллисекундах */
  restartDelay: number;
}

/**
 * Конфигурация по умолчанию
 */
export const DEFAULT_AUTO_RESTART_CONFIG: AutoRestartConfig = {
  enabled: true,
  maxRestartAttempts: 3,
  restartInterval: 60000, // 1 минута
  restartDelay: 5000, // 5 секунд
};

/**
 * Информация о перезапуске профиля
 */
interface ProfileRestartInfo {
  profileId: string;
  userId: string;
  restartAttempts: number;
  lastRestartAt: Date | null;
  lastError: string | null;
  config: AutoRestartConfig;
}

/**
 * Сервис автоматического перезапуска профилей
 */
export class AutoRestartService {
  private restartInfo: Map<string, ProfileRestartInfo> = new Map();
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private readonly checkInterval = 30000; // 30 секунд

  constructor(
    private healthCheckService: HealthCheckService,
    private chromeProcessService: ChromeProcessService,
    private profilesService: ProfilesService,
    private notificationService?: NotificationService
  ) {}

  /**
   * Запуск мониторинга и автоматического перезапуска
   * 
   * @param config - Конфигурация автоматического перезапуска
   */
  startMonitoring(config: AutoRestartConfig = DEFAULT_AUTO_RESTART_CONFIG): void {
    if (this.healthCheckInterval) {
      logger.warn('Health check monitoring already started');
      return;
    }

    logger.info('Starting auto-restart monitoring', { config });

    this.healthCheckInterval = setInterval(async () => {
      await this.checkAndRestartProfiles(config);
    }, this.checkInterval);
  }

  /**
   * Остановка мониторинга
   */
  stopMonitoring(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
      logger.info('Auto-restart monitoring stopped');
    }
  }

  /**
   * Проверка и перезапуск профилей
   * 
   * @param config - Конфигурация автоматического перезапуска
   */
  private async checkAndRestartProfiles(config: AutoRestartConfig): Promise<void> {
    if (!config.enabled) {
      return;
    }

    try {
      const allProcesses = this.chromeProcessService.getAllProcesses();

      for (const processInfo of allProcesses) {
        const profileId = processInfo.profileId;

        // Получение информации о перезапуске
        let restartInfo = this.restartInfo.get(profileId);
        
        // Получение userId из профиля через ProfilesService
        let userId = restartInfo?.userId || '';
        if (!userId) {
          try {
            // Получаем профиль через ProfilesService (используем публичный метод для внутреннего использования)
            const profile = await this.profilesService.getProfileByIdInternal(profileId);
            if (profile) {
              userId = profile.userId;
            } else {
              logger.warn('Profile not found for restart check', { profileId });
              continue;
            }
          } catch (error) {
            logger.error('Failed to get profile for restart check', {
              error: error instanceof Error ? error.message : 'Unknown error',
              profileId,
            });
            continue;
          }
        }

        if (!restartInfo) {
          restartInfo = {
            profileId,
            userId,
            restartAttempts: 0,
            lastRestartAt: null,
            lastError: null,
            config,
          };
          this.restartInfo.set(profileId, restartInfo);
        } else {
          // Обновляем userId если он был пустым
          restartInfo.userId = userId;
        }

        // Проверка здоровья профиля
        try {
          const healthCheck = await this.healthCheckService.checkProfileHealth(userId, profileId);

          // Если профиль нездоров, пытаемся перезапустить
          if (healthCheck.status === 'unhealthy' || healthCheck.status === 'degraded') {
            await this.handleUnhealthyProfile(profileId, restartInfo, healthCheck);
          } else if (healthCheck.status === 'healthy') {
            // Сброс счетчика попыток при здоровом состоянии
            restartInfo.restartAttempts = 0;
            restartInfo.lastError = null;
          }
        } catch (error) {
          logger.error('Error checking profile health', {
            error: error instanceof Error ? error.message : 'Unknown error',
            profileId,
          });
        }
      }
    } catch (error) {
      logger.error('Error in checkAndRestartProfiles', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Обработка нездорового профиля
   * 
   * @param profileId - ID профиля
   * @param restartInfo - Информация о перезапуске
   * @param healthCheck - Результат проверки здоровья
   */
  private async handleUnhealthyProfile(
    profileId: string,
    restartInfo: ProfileRestartInfo,
    healthCheck: ProfileHealthCheck
  ): Promise<void> {
    // Проверка лимита попыток перезапуска
    if (restartInfo.restartAttempts >= restartInfo.config.maxRestartAttempts) {
      logger.warn('Max restart attempts reached for profile', {
        profileId,
        attempts: restartInfo.restartAttempts,
      });
      return;
    }

    // Проверка интервала между перезапусками
    if (restartInfo.lastRestartAt) {
      const timeSinceLastRestart = Date.now() - restartInfo.lastRestartAt.getTime();
      if (timeSinceLastRestart < restartInfo.config.restartInterval) {
        return; // Еще не прошло достаточно времени
      }
    }

    logger.info('Attempting to restart unhealthy profile', {
      profileId,
      attempts: restartInfo.restartAttempts + 1,
      status: healthCheck.status,
    });

    try {
      // Задержка перед перезапуском
      await new Promise((resolve) => setTimeout(resolve, restartInfo.config.restartDelay));

      // Остановка профиля через ProfilesService для правильной синхронизации статусов
      await this.profilesService.stopProfile(profileId, restartInfo.userId, true);

      // Задержка перед запуском
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Запуск профиля
      await this.profilesService.startProfile(profileId, restartInfo.userId);

      // Обновление информации о перезапуске
      restartInfo.restartAttempts += 1;
      restartInfo.lastRestartAt = new Date();
      restartInfo.lastError = null;

      logger.info('Profile restarted successfully', {
        profileId,
        attempts: restartInfo.restartAttempts,
      });

      // Создание уведомления о перезапуске
      if (this.notificationService) {
        this.notificationService.notifyProfileRestarted(
          profileId,
          restartInfo.userId,
          restartInfo.restartAttempts
        );
      }
    } catch (error) {
      restartInfo.restartAttempts += 1;
      restartInfo.lastRestartAt = new Date();
      restartInfo.lastError = error instanceof Error ? error.message : 'Unknown error';

      logger.error('Failed to restart profile', {
        error: restartInfo.lastError,
        profileId,
        attempts: restartInfo.restartAttempts,
      });

      // Создание уведомления о сбое
      if (this.notificationService) {
        this.notificationService.notifyProfileCrashed(
          profileId,
          restartInfo.userId,
          restartInfo.lastError || 'Unknown error'
        );
      }
    }
  }

  /**
   * Получение информации о перезапуске профиля
   * 
   * @param profileId - ID профиля
   * @returns Информация о перезапуске или null
   */
  getRestartInfo(profileId: string): ProfileRestartInfo | null {
    return this.restartInfo.get(profileId) || null;
  }

  /**
   * Сброс информации о перезапуске профиля
   * 
   * @param profileId - ID профиля
   */
  resetRestartInfo(profileId: string): void {
    this.restartInfo.delete(profileId);
    logger.debug('Restart info reset', { profileId });
  }

  /**
   * Очистка всей информации о перезапуске
   */
  clearAllRestartInfo(): void {
    this.restartInfo.clear();
    logger.debug('All restart info cleared');
  }
}

