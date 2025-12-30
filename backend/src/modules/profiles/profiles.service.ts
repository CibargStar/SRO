/**
 * Сервис управления профилями Chrome
 * 
 * Содержит бизнес-логику для работы с профилями:
 * - Создание профилей с изоляцией
 * - Проверка прав доступа
 * - Управление статусами профилей
 * 
 * @module modules/profiles/profiles.service
 */

import { ProfileStatus } from '@prisma/client';
import { ProfilesRepository } from './profiles.repository';
import { CreateProfileInput, UpdateProfileInput, ListProfilesQuery } from './profiles.schemas';
import { IsolationService } from './isolation/isolation.service';
import { ChromeProcessService } from './chrome-process/chrome-process.service';
import { ProfileLimitsService } from './limits/limits.service';
import { ResourceMonitorService } from './resource-monitoring/resource-monitor.service';
import { ProcessResourceStats } from './resource-monitoring/process-resources.manager';
import { NetworkMonitorService } from './network-monitoring/network-monitor.service';
import { NetworkStats } from './network-monitoring/network-stats.manager';
import { HealthCheckService } from './health-monitoring/health-check.service';
import { AutoRestartService } from './auto-restart/auto-restart.service';
import { NotificationService } from './notifications/notification.service';
import { NotificationDispatcherService } from '../telegram-bot';
import { AnalyticsService, ProfileAnalytics } from './analytics/analytics.service';
import { AggregationPeriod } from './analytics/stats-aggregator';
import logger from '../../config/logger';
import { randomUUID } from 'crypto';
import { WebSocketServer, WsEventType } from '../websocket';
import { ProfileStatusPayload, ProfileResourcesPayload } from '../websocket/websocket.types';
import { LaunchCheckService } from './messenger-accounts/launch-check';

/* eslint-disable @typescript-eslint/explicit-function-return-type */

/**
 * Сервис для работы с профилями
 */
export class ProfilesService {
  private isolationService: IsolationService;
  public chromeProcessService: ChromeProcessService; // Публичный для graceful shutdown
  private limitsService?: ProfileLimitsService; // Опционально, может быть не инициализирован
  private resourceMonitorService: ResourceMonitorService;
  private networkMonitorService: NetworkMonitorService;
  private notificationService: NotificationService;
  private analyticsService: AnalyticsService;
  private healthCheckService: HealthCheckService;
  private autoRestartService: AutoRestartService;
  private wsServer?: WebSocketServer;
  private launchCheckService?: LaunchCheckService;
  
  // Защита от race conditions: отслеживание операций запуска/остановки
  private operationLocks: Map<string, 'starting' | 'stopping'> = new Map();

  constructor(
    private repository: ProfilesRepository,
    basePath: string = './profiles',
    limitsService?: ProfileLimitsService
  ) {
    this.isolationService = new IsolationService(basePath);
    this.chromeProcessService = new ChromeProcessService(this.isolationService);
    this.resourceMonitorService = new ResourceMonitorService(this.chromeProcessService);
    this.networkMonitorService = new NetworkMonitorService(this.chromeProcessService);
    this.notificationService = new NotificationService();
    this.analyticsService = new AnalyticsService(this.resourceMonitorService, this.networkMonitorService);
    this.limitsService = limitsService;
    
    // Инициализация health monitoring и auto-restart
    this.healthCheckService = new HealthCheckService(
      this.chromeProcessService,
      this.resourceMonitorService,
      this.limitsService
    );
    this.autoRestartService = new AutoRestartService(
      this.healthCheckService,
      this.chromeProcessService,
      this,
      this.notificationService
    );
    
    // Настройка callback для обновления статуса профиля при неожиданном закрытии браузера
    this.chromeProcessService.setDisconnectCallback((profileId: string) => {
      this.handleBrowserDisconnect(profileId).catch((error) => {
        logger.error('Error handling browser disconnect', {
          error: error instanceof Error ? error.message : 'Unknown error',
          profileId,
        });
      });
    });
  }

  setWebSocketServer(wsServer: WebSocketServer): void {
    this.wsServer = wsServer;
    this.notificationService.setWebSocketServer(wsServer);
  }

  setNotificationDispatcher(dispatcher: NotificationDispatcherService): void {
    this.notificationService.setNotificationDispatcher(dispatcher);
  }

  /**
   * Обработка неожиданного закрытия браузера
   * 
   * Обновляет статус профиля в БД на STOPPED.
   * 
   * @param profileId - ID профиля
   */
  private async handleBrowserDisconnect(profileId: string): Promise<void> {
    try {
      const profile = await this.getProfileByIdInternal(profileId);
      if (!profile) {
        return;
      }

      // Обновляем статус только если профиль был в состоянии RUNNING или STARTING
      if (profile.status === 'RUNNING' || profile.status === 'STARTING') {
        await this.updateProfileStatus(profileId, 'STOPPED');
        logger.info('Profile status updated to STOPPED after browser disconnect', { profileId });
      }
    } catch (error) {
      logger.error('Failed to update profile status after browser disconnect', {
        error: error instanceof Error ? error.message : 'Unknown error',
        profileId,
      });
    }
  }

  /**
   * Запуск фоновых сервисов мониторинга
   */
  startBackgroundServices(): void {
    // Настройка callback для проверки лимитов и сбора статистики при сборе статистики ресурсов
    this.resourceMonitorService.setStatsCollectedCallback(async (profileId, stats) => {
      try {
        // Получение userId из профиля (используем внутренний метод)
        const profile = await this.getProfileByIdInternal(profileId);
        if (!profile) {
          return;
        }

        // Проверка превышения лимитов и автоматическая остановка
        await this.checkAndEnforceResourceLimits(profileId, profile.userId);

        // Сбор сетевой статистики для аналитики
        try {
          const networkStats = await this.networkMonitorService.getProfileNetworkStats(profileId);
          if (networkStats) {
            this.analyticsService.addNetworkStatsToHistory(profileId, networkStats);
          }
        } catch (networkError) {
          logger.warn('Failed to collect network stats for analytics', {
            error: networkError instanceof Error ? networkError.message : 'Unknown error',
            profileId,
          });
        }

        // Эмит ресурсов в WebSocket
        if (this.wsServer) {
          const payload: ProfileResourcesPayload = {
            profileId,
            pid: stats.pid,
            cpuUsage: stats.cpuUsage,
            memoryUsage: stats.memoryUsage,
            memoryUsagePercent: stats.memoryUsagePercent,
            timestamp: stats.timestamp.toISOString(),
          };
          this.wsServer.emitProfileEvent(profileId, profile.userId, WsEventType.PROFILE_RESOURCES, payload);
        }
      } catch (error) {
        logger.error('Error in resource limits check callback', {
          error: error instanceof Error ? error.message : 'Unknown error',
          profileId,
        });
      }
    });

    // Запуск периодического сбора статистики
    this.resourceMonitorService.startPeriodicCollection();
    
    // Запуск автоматического перезапуска
    this.autoRestartService.startMonitoring();
    
    logger.info('Background services started for profiles module');
  }

  /**
   * Остановка фоновых сервисов мониторинга
   */
  stopBackgroundServices(): void {
    // Остановка периодического сбора статистики
    this.resourceMonitorService.stopPeriodicCollection();
    
    // Остановка автоматического перезапуска
    this.autoRestartService.stopMonitoring();
    
    logger.info('Background services stopped for profiles module');
  }

  /**
   * Восстановление профилей при старте сервиса
   * 
   * Проверяет все профили со статусом RUNNING в БД и восстанавливает их состояние:
   * - Если браузер не запущен - пытается запустить его
   * - Если запуск не удался - обновляет статус на STOPPED
   */
  async restoreRunningProfiles(): Promise<void> {
    try {
      logger.info('Starting restoration of running profiles...');

      // Получаем все профили со статусом RUNNING
      const runningProfiles = await this.repository.findRunningProfiles();

      if (runningProfiles.length === 0) {
        logger.info('No running profiles to restore');
        return;
      }

      logger.info(`Found ${runningProfiles.length} profiles with RUNNING status to restore`);

      // Восстанавливаем каждый профиль
      const restorePromises = runningProfiles.map(async (profile) => {
        try {
          // Проверяем, действительно ли браузер запущен
          const isActuallyRunning = this.chromeProcessService.isProfileRunning(profile.id);

          if (isActuallyRunning) {
            logger.debug('Profile is actually running, no action needed', {
              profileId: profile.id,
              userId: profile.userId,
            });
            return;
          }

          // Браузер не запущен, но статус в БД RUNNING - нужно восстановить
          logger.info('Profile has RUNNING status but browser is not running, attempting to restore', {
            profileId: profile.id,
            userId: profile.userId,
            name: profile.name,
          });

          // Пытаемся запустить профиль
          try {
            // Получаем лимиты ресурсов пользователя (если доступны)
            let resourceLimits: { maxCpuPerProfile?: number | null; maxMemoryPerProfile?: number | null } | undefined;
            if (this.limitsService) {
              try {
                const limits = await this.limitsService.getUserLimits(profile.userId);
                resourceLimits = {
                  maxCpuPerProfile: limits.maxCpuPerProfile,
                  maxMemoryPerProfile: limits.maxMemoryPerProfile,
                };
              } catch (error) {
                logger.warn('Failed to get user limits for profile restoration', {
                  error: error instanceof Error ? error.message : 'Unknown error',
                  userId: profile.userId,
                  profileId: profile.id,
                });
              }
            }

            // Запускаем профиль с сохраненными настройками headless
            // Используем chromeProcessService напрямую, так как это восстановление при старте сервиса
            // и мы уже знаем, что статус в БД RUNNING
            await this.chromeProcessService.startProfile(
              profile.userId,
              profile.id,
              {
                headless: profile.headless ?? true,
              },
              resourceLimits
            );

            // Обновляем статус на RUNNING (если еще не обновлен) и время последней активности
            // Это важно для синхронизации, так как мы используем chromeProcessService напрямую
            await this.updateProfileStatus(profile.id, 'RUNNING');
            await this.updateLastActiveAt(profile.id);

            logger.info('Profile restored successfully', {
              profileId: profile.id,
              userId: profile.userId,
            });

            // Проверка статусов аккаунтов мессенджеров после восстановления
            if (this.launchCheckService) {
              logger.info('Starting messenger accounts check for restored profile', {
                profileId: profile.id,
                userId: profile.userId,
              });

              void this.launchCheckService
                .checkMessengerAccountsOnLaunch(profile.id, profile.userId)
                .catch((error: unknown) => {
                  logger.warn('Failed to check messenger accounts after profile restoration', {
                    error: error instanceof Error ? error.message : 'Unknown error',
                    profileId: profile.id,
                    userId: profile.userId,
                  });
                });
            }
          } catch (startError) {
            // Если запуск не удался - обновляем статус на STOPPED
            logger.warn('Failed to restore profile, setting status to STOPPED', {
              error: startError instanceof Error ? startError.message : 'Unknown error',
              profileId: profile.id,
              userId: profile.userId,
            });

            await this.updateProfileStatus(profile.id, 'STOPPED');

            // Создаем уведомление об ошибке восстановления
            this.notificationService.notifyProfileError(
              profile.id,
              profile.userId,
              `Failed to restore profile after service restart: ${startError instanceof Error ? startError.message : 'Unknown error'}`
            );
          }
        } catch (error) {
          logger.error('Error restoring profile', {
            error: error instanceof Error ? error.message : 'Unknown error',
            profileId: profile.id,
            userId: profile.userId,
          });
        }
      });

      // Ждем завершения всех операций восстановления
      await Promise.allSettled(restorePromises);

      logger.info('Profile restoration completed');
    } catch (error) {
      logger.error('Failed to restore running profiles', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      // Не бросаем ошибку, чтобы не блокировать старт сервиса
    }
  }

  /**
   * Создание нового профиля
   * 
   * Логика:
   * 1. Проверяет права доступа (пользователь может создавать только свои профили)
   * 2. Создает изолированную директорию для профиля
   * 3. Создает запись в БД
   * 
   * @param userId - ID пользователя-владельца
   * @param data - Данные профиля
   * @returns Созданный профиль
   */
  async createProfile(userId: string, data: CreateProfileInput) {
    try {
      // Проверка лимитов профилей (если limitsService инициализирован)
      if (this.limitsService) {
        await this.limitsService.canCreateProfile(userId);
      }

      // Генерация уникального ID для профиля (будет использован для директории)
      // Примечание: ID будет сгенерирован Prisma при создании записи, но нам нужен UUID заранее для директории
      const profileId = randomUUID();

      let profilePath: string | null = null;
      try {
        // Создание изолированной директории профиля через isolation service
        profilePath = await this.isolationService.createIsolatedProfileDirectory(userId, profileId);

        // Создание записи в БД с указанным ID
        // Примечание: Prisma может генерировать ID автоматически, но мы используем наш UUID для согласованности
        const profile = await this.repository.createWithId(userId, data, profilePath, profileId);

        logger.info('Profile created successfully', { profileId: profile.id, userId, profilePath });
        return profile;
      } catch (createError) {
        // Если создание записи в БД не удалось, но директория создана - удаляем директорию
        if (profilePath) {
          try {
            await this.isolationService.deleteIsolatedProfileDirectory(userId, profileId);
            logger.info('Cleaned up profile directory after failed DB creation', { profileId, userId });
          } catch (cleanupError) {
            logger.error('Failed to cleanup profile directory after failed DB creation', {
              error: cleanupError instanceof Error ? cleanupError.message : 'Unknown error',
              profileId,
              userId,
            });
          }
        }
        throw createError;
      }
    } catch (error) {
      logger.error('Failed to create profile', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
        data,
      });
      throw error;
    }
  }

  /**
   * Получение профиля по ID с проверкой прав доступа
   * 
   * @param profileId - ID профиля
   * @param userId - ID пользователя (для проверки прав)
   * @returns Профиль или null
   * @throws Error если профиль принадлежит другому пользователю
   */
  async getProfileById(profileId: string, userId: string) {
    const profile = await this.repository.findById(profileId);

    if (!profile) {
      return null;
    }

    // Проверка прав доступа
    if (profile.userId !== userId) {
      logger.warn('Access denied to profile', { profileId, userId, ownerId: profile.userId });
      throw new Error('Access denied');
    }

    return profile;
  }

  /**
   * Получение списка профилей пользователя
   * 
   * @param userId - ID пользователя
   * @param query - Параметры запроса
   * @returns Список профилей с метаданными пагинации
   */
  async listProfiles(userId: string, query: ListProfilesQuery) {
    return this.repository.findMany(userId, query);
  }

  /**
   * Обновление профиля с проверкой прав доступа
   * 
   * @param profileId - ID профиля
   * @param userId - ID пользователя (для проверки прав)
   * @param data - Данные для обновления
   * @returns Обновленный профиль
   * @throws Error если профиль не найден или принадлежит другому пользователю
   */
  async updateProfile(profileId: string, userId: string, data: UpdateProfileInput) {
    // Проверка существования и прав доступа
    const profile = await this.getProfileById(profileId, userId);
    if (!profile) {
      throw new Error('Profile not found');
    }

    logger.info('Updating profile', { profileId, userId, data });

    // Обновление профиля
    const updatedProfile = await this.repository.update(profileId, data);
    
    logger.info('Profile updated successfully', { profileId, updatedProfile: { ...updatedProfile, profilePath: '[hidden]' } });
    
    return updatedProfile;
  }

  /**
   * Удаление профиля с проверкой прав доступа
   * 
   * @param profileId - ID профиля
   * @param userId - ID пользователя (для проверки прав)
   * @throws Error если профиль не найден или принадлежит другому пользователю
   */
  async deleteProfile(profileId: string, userId: string) {
    // Проверка существования и прав доступа
    const profile = await this.getProfileById(profileId, userId);
    if (!profile) {
      throw new Error('Profile not found');
    }

    try {
      // Остановка Chrome процесса перед удалением (если запущен)
      // Используем stopProfile для правильной синхронизации статусов
      try {
        if (this.chromeProcessService.isProfileRunning(profileId)) {
          logger.info('Stopping Chrome process before profile deletion', { profileId, userId });
          // Используем stopProfile для правильной синхронизации статусов в БД
          await this.stopProfile(profileId, userId, true);
        } else if (profile.status !== 'STOPPED') {
          // Если процесс не запущен, но статус не STOPPED - обновляем статус
          await this.updateProfileStatus(profileId, 'STOPPED');
        }
      } catch (stopError) {
        logger.warn('Failed to stop Chrome process before deletion, continuing', {
          error: stopError instanceof Error ? stopError.message : 'Unknown error',
          profileId,
          userId,
        });
        // Пытаемся хотя бы обновить статус на STOPPED
        try {
          await this.updateProfileStatus(profileId, 'STOPPED');
        } catch (statusError) {
          logger.warn('Failed to update profile status before deletion', {
            error: statusError instanceof Error ? statusError.message : 'Unknown error',
            profileId,
          });
        }
      }

      // Удаление изолированной директории профиля
      await this.isolationService.deleteIsolatedProfileDirectory(userId, profileId);

      // Удаление записи из БД
      await this.repository.delete(profileId);

      logger.info('Profile deleted successfully', { profileId, userId });
    } catch (error) {
      // Логируем ошибку, но продолжаем удаление записи из БД
      logger.error('Failed to delete profile directory, but continuing with DB deletion', {
        error: error instanceof Error ? error.message : 'Unknown error',
        profileId,
        userId,
      });

      // Удаляем запись из БД даже если директория не удалилась
      await this.repository.delete(profileId);

      // Пробрасываем ошибку для информирования вызывающего кода
      throw error;
    }
  }

  /**
   * Получение статуса профиля
   * 
   * @param profileId - ID профиля
   * @param userId - ID пользователя (для проверки прав)
   * @returns Статус профиля
   * @throws Error если профиль не найден или принадлежит другому пользователю
   */
  async getProfileStatus(profileId: string, userId: string) {
    const profile = await this.getProfileById(profileId, userId);
    if (!profile) {
      throw new Error('Profile not found');
    }

    return {
      id: profile.id,
      status: profile.status,
      lastActiveAt: profile.lastActiveAt,
    };
  }

  /**
   * Обновление статуса профиля (внутренний метод)
   * 
   * @param profileId - ID профиля
   * @param status - Новый статус
   */
  async updateProfileStatus(profileId: string, status: ProfileStatus) {
    const profile = await this.repository.findById(profileId);
    const updated = await this.repository.updateStatus(profileId, status);

    if (this.wsServer && profile) {
      const payload: ProfileStatusPayload = {
        profileId,
        status,
        lastActiveAt: updated.lastActiveAt ? updated.lastActiveAt.toISOString() : null,
      };
      this.wsServer.emitProfileEvent(profileId, profile.userId, WsEventType.PROFILE_STATUS, payload);
    }

    return updated;
  }

  /**
   * Обновление времени последней активности профиля (внутренний метод)
   * 
   * @param profileId - ID профиля
   */
  async updateLastActiveAt(profileId: string) {
    return this.repository.updateLastActiveAt(profileId);
  }

  /**
   * Получение пути к директории профиля
   * 
   * @param userId - ID пользователя
   * @param profileId - ID профиля
   * @returns Путь к директории профиля
   */
  getProfilePath(userId: string, profileId: string): string {
    return this.isolationService.getProfilePath(userId, profileId);
  }

  /**
   * Получение размера директории профиля
   * 
   * @param userId - ID пользователя
   * @param profileId - ID профиля
   * @returns Размер директории в байтах
   */
  async getProfileDirectorySize(userId: string, profileId: string): Promise<number> {
    return this.isolationService.getProfileDirectorySize(userId, profileId);
  }

  /**
   * Проверка существования директории профиля
   * 
   * @param userId - ID пользователя
   * @param profileId - ID профиля
   * @returns true если директория существует, false иначе
   */
  async profileDirectoryExists(userId: string, profileId: string): Promise<boolean> {
    return this.isolationService.profileDirectoryExists(userId, profileId);
  }

  /**
   * Установка сервиса проверки при запуске профиля
   * 
   * @param service - Сервис проверки при запуске
   */
  setLaunchCheckService(service: LaunchCheckService): void {
    this.launchCheckService = service;
  }

  /**
   * Запуск Chrome для профиля
   * 
   * @param profileId - ID профиля
   * @param userId - ID пользователя (для проверки прав)
   * @param options - Опции запуска Chrome
   * @returns Информация о запущенном процессе
   * @throws Error если профиль не найден или принадлежит другому пользователю
   */

  async startProfile(
    profileId: string,
    userId: string,
    options?: {
      headless?: boolean;
      args?: string[];
    }
  ) {
    // Защита от race conditions: проверяем, не выполняется ли уже операция над этим профилем
    const existingOperation = this.operationLocks.get(profileId);
    if (existingOperation === 'starting') {
      throw new Error('Profile is already being started');
    }
    if (existingOperation === 'stopping') {
      throw new Error('Profile is being stopped, please wait');
    }

    // Устанавливаем блокировку
    this.operationLocks.set(profileId, 'starting');

    try {
      // Проверка существования и прав доступа
      const profile = await this.getProfileById(profileId, userId);
      if (!profile) {
        throw new Error('Profile not found');
      }

    // Проверка статуса профиля и реального состояния процесса
    if (profile.status === 'RUNNING') {
      const processInfo = this.chromeProcessService.getProcessInfo(profileId);
      const isActuallyRunning = this.chromeProcessService.isProfileRunning(profileId);
      
      if (processInfo && isActuallyRunning) {
        logger.debug('Profile already running', { profileId, userId });
        // Снимаем блокировку перед возвратом
        this.operationLocks.delete(profileId);
        return {
          profileId: profile.id,
          status: 'RUNNING',
          processInfo: {
            pid: processInfo.pid,
            startedAt: processInfo.startedAt,
          },
        };
      }
      
      // Профиль в статусе RUNNING, но процесс не запущен - рассинхронизация
      // Обновляем статус и продолжаем запуск
      logger.warn('Profile status is RUNNING but process is not running, fixing status', {
        profileId,
        userId,
        hasProcessInfo: !!processInfo,
        isActuallyRunning,
      });
      await this.updateProfileStatus(profileId, 'STOPPED');
    } else if (profile.status === 'STARTING') {
      // Профиль в статусе STARTING - возможно предыдущий запуск не завершился
      // Проверяем реальное состояние процесса
      const isActuallyRunning = this.chromeProcessService.isProfileRunning(profileId);
      if (!isActuallyRunning) {
        // Процесс не запущен, но статус STARTING - рассинхронизация
        logger.warn('Profile status is STARTING but process is not running, fixing status', {
          profileId,
          userId,
        });
        await this.updateProfileStatus(profileId, 'STOPPED');
      } else {
        // Процесс запущен, но статус STARTING - обновляем на RUNNING
        logger.info('Profile process is running but status is STARTING, updating to RUNNING', {
          profileId,
          userId,
        });
        await this.updateProfileStatus(profileId, 'RUNNING');
        // Снимаем блокировку перед возвратом
        this.operationLocks.delete(profileId);
        const processInfo = this.chromeProcessService.getProcessInfo(profileId);
        return {
          profileId: profile.id,
          status: 'RUNNING' as ProfileStatus,
          processInfo: {
            pid: processInfo?.pid,
            startedAt: processInfo?.startedAt ?? new Date(),
          },
        };
      }
    } else if (profile.status === 'STOPPING') {
      // Профиль останавливается - ждем завершения или принудительно останавливаем
      logger.warn('Profile is stopping, waiting for completion', { profileId, userId });
      // Ждем немного для завершения остановки
      await new Promise((resolve) => setTimeout(resolve, 2000));
      // Проверяем снова
      const stillStopping = (await this.repository.findById(profileId))?.status === 'STOPPING';
      if (stillStopping) {
        // Все еще останавливается - принудительно обновляем статус
        logger.warn('Profile still stopping after wait, forcing status update', { profileId, userId });
        await this.updateProfileStatus(profileId, 'STOPPED');
      }
    } else if (profile.status === 'ERROR') {
      // Профиль в статусе ERROR - можно попробовать запустить снова
      logger.info('Profile is in ERROR status, attempting to start', { profileId, userId });
    }

    // Обновление статуса на STARTING
    await this.updateProfileStatus(profileId, 'STARTING');

      // Используем headless из профиля, если не передан в options
      // ВАЖНО: Для WhatsApp Web используем headless: false по умолчанию
      const headless = options?.headless ?? profile.headless ?? false;
      
      // Получение лимитов ресурсов пользователя (если доступны)
      let resourceLimits: { maxCpuPerProfile?: number | null; maxMemoryPerProfile?: number | null } | undefined;
      if (this.limitsService) {
        try {
          const limits = await this.limitsService.getUserLimits(userId);
          resourceLimits = {
            maxCpuPerProfile: limits.maxCpuPerProfile,
            maxMemoryPerProfile: limits.maxMemoryPerProfile,
          };
        } catch (error) {
          logger.warn('Failed to get user limits for profile start', {
            error: error instanceof Error ? error.message : 'Unknown error',
            userId,
            profileId,
          });
          // Продолжаем запуск без лимитов, если не удалось получить
        }
      }
      
      // Запуск Chrome с лимитами ресурсов (если доступны)
      // ПРИМЕЧАНИЕ: Лимиты передаются в ChromeProcessService, но реальное применение
      // требует системных средств (cgroups на Linux, Job Objects на Windows).
      // Сейчас лимиты используются только для мониторинга и проверки превышения.
      const processInfo = await this.chromeProcessService.startProfile(
        userId,
        profileId,
        {
          ...options,
          headless, // Используем значение из профиля или из options
        },
        resourceLimits
      );

      // Обновление статуса на RUNNING
      await this.updateProfileStatus(profileId, 'RUNNING');
      await this.updateLastActiveAt(profileId);

      logger.info('Profile started successfully', {
        profileId,
        userId,
        pid: processInfo.pid,
      });

      // Проверка статусов аккаунтов мессенджеров при запуске профиля
      if (this.launchCheckService) {
        void this.launchCheckService
          .checkMessengerAccountsOnLaunch(profileId, userId)
          .catch((error: unknown) => {
            logger.warn('Failed to check messenger accounts on launch', {
              error: error instanceof Error ? error.message : 'Unknown error',
              profileId,
              userId,
            });
          });
      }

      return {
        profileId: profile.id,
        status: 'RUNNING' as ProfileStatus,
        processInfo: {
          pid: processInfo.pid,
          startedAt: processInfo.startedAt,
        },
      };
    } catch (error) {
      // Обновление статуса на ERROR при ошибке
      await this.updateProfileStatus(profileId, 'ERROR').catch((updateError) => {
        logger.error('Failed to update profile status to ERROR', {
          error: updateError instanceof Error ? updateError.message : 'Unknown error',
          profileId,
        });
      });

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to start profile', {
        error: errorMessage,
        profileId,
        userId,
      });

      // Создание уведомления об ошибке
      try {
        this.notificationService.notifyProfileError(profileId, userId, errorMessage);
      } catch (notifyError) {
        logger.error('Failed to send profile error notification', {
          error: notifyError instanceof Error ? notifyError.message : 'Unknown error',
          profileId,
        });
      }

      throw error;
    } finally {
      // Снимаем блокировку
      this.operationLocks.delete(profileId);
    }
  }

  /**
   * Остановка Chrome для профиля
   * 
   * @param profileId - ID профиля
   * @param userId - ID пользователя (для проверки прав)
   * @param force - Принудительная остановка
   * @throws Error если профиль не найден или принадлежит другому пользователю
   */
  async stopProfile(profileId: string, userId: string, force: boolean = false) {
    // Защита от race conditions: проверяем, не выполняется ли уже операция над этим профилем
    const existingOperation = this.operationLocks.get(profileId);
    if (existingOperation === 'stopping') {
      logger.warn('Profile is already being stopped', { profileId, userId });
      return; // Уже останавливается, ничего не делаем
    }
    if (existingOperation === 'starting') {
      // Если профиль запускается, ждем немного и проверяем снова
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const stillStarting = this.operationLocks.get(profileId) === 'starting';
      if (stillStarting) {
        throw new Error('Profile is being started, cannot stop now');
      }
    }

    // Устанавливаем блокировку
    this.operationLocks.set(profileId, 'stopping');

    try {
      // Проверка существования и прав доступа
      const profile = await this.getProfileById(profileId, userId);
      if (!profile) {
        throw new Error('Profile not found');
      }

      // Проверка статуса профиля и реального состояния процесса
      const isActuallyRunning = this.chromeProcessService.isProfileRunning(profileId);
      
      if (profile.status === 'STOPPED' && !isActuallyRunning) {
        logger.debug('Profile already stopped', { profileId, userId });
        // Снимаем блокировку перед возвратом
        this.operationLocks.delete(profileId);
        return;
      }
      
      // Если процесс запущен, но статус STOPPED - рассинхронизация, нужно остановить процесс
      if (profile.status === 'STOPPED' && isActuallyRunning) {
        logger.warn('Profile status is STOPPED but process is running, stopping process', {
          profileId,
          userId,
        });
        // Продолжаем остановку процесса
      } else if (profile.status === 'STOPPING') {
        // Профиль уже останавливается - ждем завершения
        logger.info('Profile is already stopping, waiting for completion', { profileId, userId });
        // Ждем завершения остановки
        let attempts = 0;
        const maxAttempts = 10; // Максимум 10 секунд ожидания
        while (attempts < maxAttempts) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
          const currentProfile = await this.repository.findById(profileId);
          if (currentProfile?.status !== 'STOPPING') {
            // Остановка завершена
            this.operationLocks.delete(profileId);
            return;
          }
          attempts++;
        }
        // Если все еще останавливается - принудительно обновляем статус
        logger.warn('Profile still stopping after wait, forcing status update', { profileId, userId });
        await this.updateProfileStatus(profileId, 'STOPPED');
        this.operationLocks.delete(profileId);
        return;
      } else if (profile.status === 'STARTING') {
        // Профиль запускается - ждем завершения запуска перед остановкой
        logger.info('Profile is starting, waiting for completion before stopping', { profileId, userId });
        // Ждем завершения запуска
        let attempts = 0;
        const maxAttempts = 30; // Максимум 30 секунд ожидания (запуск может занять время)
        while (attempts < maxAttempts) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
          const currentProfile = await this.repository.findById(profileId);
          if (currentProfile?.status === 'RUNNING' || currentProfile?.status === 'ERROR' || currentProfile?.status === 'STOPPED') {
            // Запуск завершен (успешно или с ошибкой) или уже остановлен
            break;
          }
          attempts++;
        }
        // Проверяем текущий статус
        const currentProfile = await this.repository.findById(profileId);
        if (currentProfile?.status === 'STOPPED' || currentProfile?.status === 'ERROR') {
          // Уже остановлен или ошибка
          this.operationLocks.delete(profileId);
          return;
        }
        // Если запущен - продолжаем остановку
      }

      // Обновление статуса на STOPPING
      await this.updateProfileStatus(profileId, 'STOPPING');

      // Остановка Chrome
      await this.chromeProcessService.stopProfile(userId, profileId, force);

      // Обновление статуса на STOPPED
      await this.updateProfileStatus(profileId, 'STOPPED');

      logger.info('Profile stopped successfully', { profileId, userId });
    } catch (error) {
      // Обновление статуса на ERROR при ошибке
      await this.updateProfileStatus(profileId, 'ERROR').catch((updateError) => {
        logger.error('Failed to update profile status to ERROR', {
          error: updateError instanceof Error ? updateError.message : 'Unknown error',
          profileId,
        });
      });

      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to stop profile', {
        error: errorMessage,
        profileId,
        userId,
      });

      // Создание уведомления об ошибке
      try {
        this.notificationService.notifyProfileError(profileId, userId, errorMessage);
      } catch (notifyError) {
        logger.error('Failed to send profile error notification', {
          error: notifyError instanceof Error ? notifyError.message : 'Unknown error',
          profileId,
        });
      }

      throw error;
    } finally {
      // Снимаем блокировку
      this.operationLocks.delete(profileId);
    }
  }

  /**
   * Проверка, запущен ли Chrome для профиля
   * 
   * @param profileId - ID профиля
   * @returns true если Chrome запущен
   */
  isProfileRunning(profileId: string): boolean {
    return this.chromeProcessService.isProfileRunning(profileId);
  }

  /**
   * Получение статистики ресурсов профиля
   * 
   * @param profileId - ID профиля
   * @param userId - ID пользователя (для проверки прав)
   * @returns Статистика ресурсов или null
   * @throws Error если профиль не найден или принадлежит другому пользователю
   */
  async getProfileResourceStats(profileId: string, userId: string): Promise<ProcessResourceStats | null> {
    // Проверка существования и прав доступа
    const profile = await this.getProfileById(profileId, userId);
    if (!profile) {
      throw new Error('Profile not found');
    }

    return this.resourceMonitorService.getProfileResourceStats(profileId);
  }

  /**
   * Получение лимитов пользователя
   * 
   * @param userId - ID пользователя
   * @returns Лимиты пользователя
   */
  async getUserLimits(userId: string) {
    if (!this.limitsService) {
      throw new Error('Profile limits service is not initialized');
    }
    return this.limitsService.getUserLimits(userId);
  }

  /**
   * Получение профиля по ID без проверки прав доступа (для внутреннего использования)
   * 
   * @param profileId - ID профиля
   * @returns Профиль или null
   */
  async getProfileByIdInternal(profileId: string) {
    return this.repository.findById(profileId);
  }

  /**
   * Проверка здоровья профиля
   * 
   * @param profileId - ID профиля
   * @param userId - ID пользователя (для проверки прав)
   * @returns Результат проверки здоровья
   */
  async checkProfileHealth(profileId: string, userId: string) {
    // Проверка существования и прав доступа
    const profile = await this.getProfileById(profileId, userId);
    if (!profile) {
      throw new Error('Profile not found');
    }

    const health = await this.healthCheckService.checkProfileHealth(userId, profileId);

    if (this.wsServer) {
      this.wsServer.emitProfileEvent(profileId, userId, WsEventType.PROFILE_HEALTH, {
        profileId,
        status: health.status,
        details: health.details,
        timestamp: health.timestamp.toISOString(),
      });
    }

    return health;
  }

  /**
   * Получение истории статистики ресурсов профиля
   * 
   * @param profileId - ID профиля
   * @param userId - ID пользователя (для проверки прав)
   * @param limit - Максимальное количество записей
   * @param from - Начальная дата (опционально)
   * @param to - Конечная дата (опционально)
   * @returns История статистики
   */
  async getProfileResourceStatsHistory(
    profileId: string,
    userId: string,
    limit: number = 100,
    from?: Date,
    to?: Date
  ) {
    // Проверка существования и прав доступа
    const profile = await this.getProfileById(profileId, userId);
    if (!profile) {
      throw new Error('Profile not found');
    }

    return this.resourceMonitorService.getResourceStatsHistory(profileId, limit, from, to);
  }

  /**
   * Проверка превышения лимитов ресурсов и автоматическая остановка при превышении
   * 
   * @param profileId - ID профиля
   * @param userId - ID пользователя
   * @returns true если лимиты превышены и профиль остановлен
   */
  async checkAndEnforceResourceLimits(profileId: string, userId: string): Promise<boolean> {
    if (!this.limitsService) {
      return false; // Лимиты не настроены
    }

    try {
      // Получение лимитов пользователя
      const limits = await this.limitsService.getUserLimits(userId);

      // Проверка превышения лимитов (включая сетевую активность)
      const checkResult = await this.resourceMonitorService.checkResourceLimits(
        profileId,
        {
          maxCpuPerProfile: limits.maxCpuPerProfile,
          maxMemoryPerProfile: limits.maxMemoryPerProfile,
          maxNetworkPerProfile: limits.maxNetworkPerProfile,
        },
        this.networkMonitorService
      );

      if (checkResult.exceeded) {
        logger.warn('Resource limits exceeded for profile', {
          profileId,
          userId,
          details: checkResult.details,
        });

        // Создание уведомления о превышении лимитов
        this.notificationService.notifyResourceLimitExceeded(
          profileId,
          userId,
          checkResult.details
        );

        // Автоматическая остановка профиля
        await this.stopProfile(profileId, userId, true);

        return true;
      }

      return false;
    } catch (error) {
      logger.error('Failed to check resource limits', {
        error: error instanceof Error ? error.message : 'Unknown error',
        profileId,
        userId,
      });
      return false;
    }
  }

  /**
   * Получение статистики сетевой активности профиля
   * 
   * @param profileId - ID профиля
   * @param userId - ID пользователя (для проверки прав)
   * @returns Статистика сетевой активности или null
   * @throws Error если профиль не найден или принадлежит другому пользователю
   */
  async getProfileNetworkStats(profileId: string, userId: string): Promise<NetworkStats | null> {
    // Проверка существования и прав доступа
    const profile = await this.getProfileById(profileId, userId);
    if (!profile) {
      throw new Error('Profile not found');
    }

    return this.networkMonitorService.getProfileNetworkStats(profileId);
  }

  /**
   * Получение алертов для профиля
   * 
   * @param profileId - ID профиля
   * @param userId - ID пользователя (для проверки прав)
   * @param limit - Максимальное количество алертов
   * @param unreadOnly - Только непрочитанные
   * @param from - Начальная дата (опционально)
   * @param to - Конечная дата (опционально)
   * @returns Массив алертов
   */
  async getProfileAlerts(
    profileId: string,
    userId: string,
    limit: number = 100,
    unreadOnly: boolean = false,
    from?: Date,
    to?: Date
  ) {
    // Проверка существования и прав доступа
    const profile = await this.getProfileById(profileId, userId);
    if (!profile) {
      throw new Error('Profile not found');
    }

    return this.notificationService.getAlerts(profileId, limit, unreadOnly, from, to);
  }

  /**
   * Получение количества непрочитанных алертов для профиля
   * 
   * @param profileId - ID профиля
   * @param userId - ID пользователя (для проверки прав)
   * @returns Количество непрочитанных алертов
   */
  async getProfileUnreadAlertsCount(profileId: string, userId: string): Promise<number> {
    // Проверка существования и прав доступа
    const profile = await this.getProfileById(profileId, userId);
    if (!profile) {
      throw new Error('Profile not found');
    }

    return this.notificationService.getUnreadCount(profileId);
  }

  /**
   * Отметка алерта как прочитанного
   * 
   * @param profileId - ID профиля
   * @param userId - ID пользователя (для проверки прав)
   * @param alertId - ID алерта
   * @returns true если алерт найден и отмечен
   */
  async markAlertAsRead(profileId: string, userId: string, alertId: string): Promise<boolean> {
    // Проверка существования и прав доступа
    const profile = await this.getProfileById(profileId, userId);
    if (!profile) {
      throw new Error('Profile not found');
    }

    return this.notificationService.markAlertAsRead(profileId, alertId);
  }

  /**
   * Отметка всех алертов профиля как прочитанных
   * 
   * @param profileId - ID профиля
   * @param userId - ID пользователя (для проверки прав)
   * @returns Количество отмеченных алертов
   */
  async markAllAlertsAsRead(profileId: string, userId: string): Promise<number> {
    // Проверка существования и прав доступа
    const profile = await this.getProfileById(profileId, userId);
    if (!profile) {
      throw new Error('Profile not found');
    }

    return this.notificationService.markAllAlertsAsRead(profileId);
  }

  /**
   * Получение аналитики профиля
   * 
   * @param profileId - ID профиля
   * @param userId - ID пользователя (для проверки прав)
   * @param period - Период агрегации
   * @param from - Начальная дата (опционально)
   * @param to - Конечная дата (опционально)
   * @returns Аналитика профиля
   */
  async getProfileAnalytics(
    profileId: string,
    userId: string,
    periodInput: unknown = 'day',
    from?: Date,
    to?: Date
  ): Promise<ProfileAnalytics> {
    // Проверка существования и прав доступа
    const profile = await this.getProfileById(profileId, userId);
    if (!profile) {
      throw new Error('Profile not found');
    }

    const safePeriod: AggregationPeriod = (() => {
      if (
        periodInput === 'hour' ||
        periodInput === 'day' ||
        periodInput === 'week' ||
        periodInput === 'month'
      ) {
        return periodInput;
      }
      return 'day';
    })();

    // Значение safePeriod ограничено набором допустимых строк выше
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
    return this.analyticsService.getProfileAnalytics(profileId, safePeriod, from, to);
  }
}

