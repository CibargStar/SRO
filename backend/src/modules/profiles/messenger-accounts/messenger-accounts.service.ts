/* eslint-disable @typescript-eslint/explicit-function-return-type */
/**
 * Сервис управления аккаунтами мессенджеров
 * 
 * Содержит бизнес-логику для работы с аккаунтами мессенджеров:
 * - Привязка аккаунтов к профилям
 * - Управление включением/выключением мессенджеров
 * - Проверка прав доступа
 * 
 * @module modules/profiles/messenger-accounts/messenger-accounts.service
 */

import { MessengerAccountsRepository } from './messenger-accounts.repository';
import { ProfilesRepository } from '../profiles.repository';
import { ChromeProcessService } from '../chrome-process/chrome-process.service';
import { StatusCheckerService } from './checkers/status-checker.service';
import { StatusMonitoringService } from './monitoring/status-monitoring.service';
import { PrismaClient } from '@prisma/client';
import { WebSocketServer } from '../../websocket';
import { NotificationService } from '../notifications/notification.service';
import {
  CreateMessengerAccountInput,
  UpdateMessengerAccountInput,
} from './messenger-accounts.schemas';
import logger from '../../../config/logger';

/**
 * Сервис для работы с аккаунтами мессенджеров
 */
export class MessengerAccountsService {
  private statusCheckerService?: StatusCheckerService;
  private statusMonitoringService?: StatusMonitoringService;

  constructor(
    private repository: MessengerAccountsRepository,
    private profilesRepository: ProfilesRepository,
    chromeProcessService?: ChromeProcessService,
    prisma?: PrismaClient,
    notificationService?: NotificationService
  ) {
    // Инициализация сервиса проверки статусов (если передан ChromeProcessService)
    if (chromeProcessService) {
      this.statusCheckerService = new StatusCheckerService(chromeProcessService);

      // Инициализация сервиса мониторинга (если передан Prisma)
      if (prisma) {
        this.statusMonitoringService = new StatusMonitoringService(
          prisma,
          this.repository,
          this.statusCheckerService,
          chromeProcessService,
          notificationService
        );
      }
    }
  }

  setWebSocketServer(wsServer: WebSocketServer): void {
    this.statusMonitoringService?.setWebSocketServer(wsServer);
  }

  /**
   * Получение всех мессенджеров (справочник)
   * 
   * @returns Список всех мессенджеров
   */
  async getAllServices() {
    return this.repository.getAllServices();
  }

  /**
   * Получение мессенджера по ID
   * 
   * @param serviceId - ID мессенджера
   * @returns Мессенджер или null
   */
  async getServiceById(serviceId: string) {
    return this.repository.getServiceById(serviceId);
  }

  /**
   * Получение всех аккаунтов мессенджеров профиля
   * 
   * @param profileId - ID профиля
   * @param userId - ID пользователя (для проверки прав)
   * @returns Список аккаунтов профиля
   * @throws Error если профиль не найден или принадлежит другому пользователю
   */
  async getAccountsByProfileId(profileId: string, userId: string) {
    // Проверка существования профиля и прав доступа
    const profile = await this.profilesRepository.findById(profileId);

    if (!profile) {
      throw new Error('Profile not found');
    }

    if (profile.userId !== userId) {
      logger.warn('Access denied to profile messenger accounts', {
        profileId,
        userId,
        ownerId: profile.userId,
      });
      throw new Error('Access denied');
    }

    return this.repository.getAccountsByProfileId(profileId);
  }

  /**
   * Получение аккаунта мессенджера по ID
   * 
   * @param accountId - ID аккаунта
   * @param userId - ID пользователя (для проверки прав)
   * @returns Аккаунт или null
   * @throws Error если аккаунт не найден или профиль принадлежит другому пользователю
   */
  async getAccountById(accountId: string, userId: string) {
    const account = await this.repository.getAccountById(accountId);

    if (!account) {
      return null;
    }

    // Проверка прав доступа через профиль
    if (account.profile.userId !== userId) {
      logger.warn('Access denied to messenger account', {
        accountId,
        userId,
        ownerId: account.profile.userId,
      });
      throw new Error('Access denied');
    }

    return account;
  }

  /**
   * Создание аккаунта мессенджера для профиля
   * 
   * @param profileId - ID профиля
   * @param userId - ID пользователя (для проверки прав)
   * @param data - Данные аккаунта
   * @returns Созданный аккаунт
   * @throws Error если профиль не найден, принадлежит другому пользователю или аккаунт уже существует
   */
  async createAccount(profileId: string, userId: string, data: CreateMessengerAccountInput) {
    try {
      // Проверка существования профиля и прав доступа
      const profile = await this.profilesRepository.findById(profileId);

      if (!profile) {
        throw new Error('Profile not found');
      }

      if (profile.userId !== userId) {
        logger.warn('Access denied to create messenger account', {
          profileId,
          userId,
          ownerId: profile.userId,
        });
        throw new Error('Access denied');
      }

      // Проверка, существует ли уже аккаунт для этого мессенджера и профиля
      const existingAccount = await this.repository.getAccountByProfileAndService(
        profileId,
        data.serviceId
      );

      if (existingAccount) {
        throw new Error(
          'Account for this messenger service already exists for this profile'
        );
      }

      // Проверка существования мессенджера
      const service = await this.repository.getServiceById(data.serviceId);
      if (!service) {
        throw new Error('Messenger service not found');
      }

      if (!service.enabled) {
        throw new Error('Messenger service is disabled');
      }

      // Создание аккаунта
      const account = await this.repository.createAccount(profileId, data);

      logger.info('Messenger account created successfully', {
        accountId: account.id,
        profileId,
        serviceId: data.serviceId,
        userId,
      });

      // Добавляем аккаунт в мониторинг, если он включен
      if (account.isEnabled) {
        await this.addAccountToMonitoring(account.id).catch((error) => {
          logger.warn('Failed to add account to monitoring', {
            error: error instanceof Error ? error.message : 'Unknown error',
            accountId: account.id,
          });
        });
      }

      return account;
    } catch (error) {
      logger.error('Failed to create messenger account', {
        error: error instanceof Error ? error.message : 'Unknown error',
        profileId,
        userId,
        data,
      });
      throw error;
    }
  }

  /**
   * Обновление аккаунта мессенджера
   * 
   * @param accountId - ID аккаунта
   * @param userId - ID пользователя (для проверки прав)
   * @param data - Данные для обновления
   * @returns Обновленный аккаунт
   * @throws Error если аккаунт не найден или профиль принадлежит другому пользователю
   */
  async updateAccount(
    accountId: string,
    userId: string,
    data: UpdateMessengerAccountInput
  ) {
    // Проверка существования и прав доступа
    const account = await this.getAccountById(accountId, userId);
    if (!account) {
      throw new Error('Account not found');
    }

    logger.info('Updating messenger account', { accountId, userId, data });

    // Обновление аккаунта
    const updatedAccount = await this.repository.updateAccount(accountId, data);

    logger.info('Messenger account updated successfully', { accountId });

    // Обновляем задачу мониторинга, если изменился isEnabled
    if (data.isEnabled !== undefined) {
      if (data.isEnabled) {
        await this.addAccountToMonitoring(accountId).catch((error) => {
          logger.warn('Failed to add account to monitoring', {
            error: error instanceof Error ? error.message : 'Unknown error',
            accountId,
          });
        });
      } else {
        this.removeAccountFromMonitoring(accountId);
      }
    } else {
      // Обновляем задачу, если возможно изменилась конфигурация
      await this.updateMonitoringTask(accountId).catch((error) => {
        logger.warn('Failed to update monitoring task', {
          error: error instanceof Error ? error.message : 'Unknown error',
          accountId,
        });
      });
    }

    return updatedAccount;
  }

  /**
   * Включение мессенджера для профиля
   * 
   * @param accountId - ID аккаунта
   * @param userId - ID пользователя (для проверки прав)
   * @returns Обновленный аккаунт
   * @throws Error если аккаунт не найден или профиль принадлежит другому пользователю
   */
  async enableAccount(accountId: string, userId: string) {
    // Проверка существования и прав доступа
    const account = await this.getAccountById(accountId, userId);
    if (!account) {
      throw new Error('Account not found');
    }

    const updatedAccount = await this.repository.enableAccount(accountId);

    // Добавляем аккаунт в мониторинг
    await this.addAccountToMonitoring(accountId).catch((error) => {
      logger.warn('Failed to add account to monitoring', {
        error: error instanceof Error ? error.message : 'Unknown error',
        accountId,
      });
    });

    return updatedAccount;
  }

  /**
   * Выключение мессенджера для профиля
   * 
   * @param accountId - ID аккаунта
   * @param userId - ID пользователя (для проверки прав)
   * @returns Обновленный аккаунт
   * @throws Error если аккаунт не найден или профиль принадлежит другому пользователю
   */
  async disableAccount(accountId: string, userId: string) {
    // Проверка существования и прав доступа
    const account = await this.getAccountById(accountId, userId);
    if (!account) {
      throw new Error('Account not found');
    }

    const updatedAccount = await this.repository.disableAccount(accountId);

    // Удаляем аккаунт из мониторинга
    this.removeAccountFromMonitoring(accountId);

    return updatedAccount;
  }

  /**
   * Удаление аккаунта мессенджера
   * 
   * @param accountId - ID аккаунта
   * @param userId - ID пользователя (для проверки прав)
   * @throws Error если аккаунт не найден или профиль принадлежит другому пользователю
   */
  async deleteAccount(accountId: string, userId: string) {
    // Удаляем из мониторинга перед удалением
    this.removeAccountFromMonitoring(accountId);
    // Проверка существования и прав доступа
    const account = await this.getAccountById(accountId, userId);
    if (!account) {
      throw new Error('Account not found');
    }

    await this.repository.deleteAccount(accountId);

    logger.info('Messenger account deleted successfully', { accountId, userId });
  }

  /**
   * Получение всех включенных аккаунтов для мониторинга
   * 
   * Внутренний метод, используется системой мониторинга.
   * 
   * @returns Список аккаунтов с включенным мониторингом
   */
  async getEnabledAccountsForMonitoring() {
    return this.repository.getEnabledAccountsForMonitoring();
  }

  /**
   * Получение конфигурации проверки для мессенджера
   * 
   * @param serviceId - ID мессенджера
   * @returns Конфигурация или null
   */
  async getCheckConfig(serviceId: string) {
    return this.repository.getCheckConfig(serviceId);
  }

  /**
   * Получение всех конфигураций проверки (для ROOT)
   * 
   * @returns Список всех конфигураций
   */
  async getAllCheckConfigs() {
    return this.repository.getAllCheckConfigs();
  }

  /**
   * Обновление конфигурации проверки для мессенджера (для ROOT)
   * 
   * @param serviceId - ID мессенджера
   * @param checkIntervalSeconds - Интервал проверки в секундах
   * @param enabled - Включен ли мониторинг
   * @param updatedBy - ID пользователя, который обновил конфигурацию
   * @returns Конфигурация
   */
  async updateCheckConfig(
    serviceId: string,
    checkIntervalSeconds: number,
    enabled: boolean,
    updatedBy: string
  ) {
    // Проверка существования мессенджера
    const service = await this.repository.getServiceById(serviceId);
    if (!service) {
      throw new Error('Messenger service not found');
    }

    const config = await this.repository.upsertCheckConfig(
      serviceId,
      checkIntervalSeconds,
      enabled,
      updatedBy
    );

    // Обновляем все задачи мониторинга для этого мессенджера
    if (this.statusMonitoringService) {
      // Находим все аккаунты этого мессенджера и обновляем их задачи
      const accounts = await this.repository.findAccountsByServiceId(serviceId);
      for (const account of accounts) {
        if (account.isEnabled) {
          await this.statusMonitoringService.updateMonitoringTask(account.id).catch((error) => {
            logger.warn('Failed to update monitoring task after config change', {
              error: error instanceof Error ? error.message : 'Unknown error',
              accountId: account.id,
            });
          });
        }
      }
    }

    return config;
  }

  /**
   * Проверка статуса входа для аккаунта мессенджера
   * 
   * Использует систему чекеров для проверки статуса входа.
   * 
   * @param accountId - ID аккаунта мессенджера
   * @param userId - ID пользователя (для проверки прав)
   * @returns Результат проверки
   * @throws Error если аккаунт не найден, статус проверки не инициализирован или профиль не запущен
   */
  async checkAccountStatus(accountId: string, userId: string) {
    // Проверка существования и прав доступа
    const account = await this.getAccountById(accountId, userId);
    if (!account) {
      throw new Error('Account not found');
    }

    // Проверка, что сервис проверки статуса инициализирован
    if (!this.statusCheckerService) {
      throw new Error('Status checker service is not initialized. ChromeProcessService is required.');
    }

    // Получение имени мессенджера из сервиса
    const service = account.service;
    if (!service) {
      throw new Error('Service information not found');
    }

    // Получение профиля
    const profile = await this.profilesRepository.findById(account.profileId);
    if (!profile) {
      throw new Error('Profile not found');
    }

    // Проверка, что профиль запущен
    if (!this.statusCheckerService.isProfileRunning(account.profileId)) {
      throw new Error('Profile is not running. Please start the profile first.');
    }

    // Выполнение проверки статуса
    const result = await this.statusCheckerService.checkLoginStatus(
      account.profileId,
      account.id,
      account.serviceId,
      service.name
    );

    // Обновление статуса в БД
    await this.repository.updateAccountStatus(account.id, result.status);

    logger.info('Account status checked', {
      accountId,
      profileId: account.profileId,
      serviceName: service.name,
      status: result.status,
    });

    return result;
  }

  /**
   * Запуск мониторинга статусов
   * 
   * Запускает фоновый мониторинг статусов аккаунтов мессенджеров.
   */
  async startMonitoring(): Promise<void> {
    if (!this.statusMonitoringService) {
      throw new Error('Monitoring service is not initialized. PrismaClient is required.');
    }

    await this.statusMonitoringService.start();
    logger.info('Messenger accounts status monitoring started');
  }

  /**
   * Остановка мониторинга статусов
   * 
   * Останавливает фоновый мониторинг статусов аккаунтов мессенджеров.
   */
  stopMonitoring(): void {
    if (!this.statusMonitoringService) {
      return;
    }

    this.statusMonitoringService.stop();
    logger.info('Messenger accounts status monitoring stopped');
  }

  /**
   * Получение количества аккаунтов мессенджеров для списка профилей
   * 
   * @param profileIds - Массив ID профилей
   * @returns Объект с количеством аккаунтов для каждого профиля: { profileId: count }
   */
  async getAccountsCountByProfileIds(profileIds: string[]): Promise<Record<string, number>> {
    return this.repository.getAccountsCountByProfileIds(profileIds);
  }

  /**
   * Получение статистики мониторинга
   * 
   * @returns Статистика мониторинга
   */
  getMonitoringStats(): { isActive: boolean; tasksCount: number; tasks: unknown[] } {
    if (!this.statusMonitoringService) {
      return {
        isActive: false,
        tasksCount: 0,
        tasks: [],
      };
    }

    return this.statusMonitoringService.getMonitoringStats();
  }

  /**
   * Добавление аккаунта в мониторинг
   * 
   * @param accountId - ID аккаунта
   */
  async addAccountToMonitoring(accountId: string): Promise<void> {
    if (!this.statusMonitoringService) {
      return;
    }

    await this.statusMonitoringService.addAccountToMonitoring(accountId);
  }

  /**
   * Удаление аккаунта из мониторинга
   * 
   * @param accountId - ID аккаунта
   */
  removeAccountFromMonitoring(accountId: string): void {
    if (!this.statusMonitoringService) {
      return;
    }

    this.statusMonitoringService.removeAccountFromMonitoring(accountId);
  }

  /**
   * Обновление задачи мониторинга
   * 
   * @param accountId - ID аккаунта
   */
  async updateMonitoringTask(accountId: string): Promise<void> {
    if (!this.statusMonitoringService) {
      return;
    }

    await this.statusMonitoringService.updateMonitoringTask(accountId);
  }

  /**
   * Получение сервиса проверки статусов (для использования в других модулях)
   * 
   * @returns Сервис проверки статусов или undefined
   */
  getStatusCheckerService(): StatusCheckerService | undefined {
    return this.statusCheckerService;
  }

  /**
   * Ввод облачного пароля (2FA) для Telegram
   * 
   * @param profileId - ID профиля
   * @param accountId - ID аккаунта мессенджера
   * @param password - Облачный пароль
   * @param userId - ID пользователя (для проверки прав)
   * @returns Результат ввода пароля и новый статус
   */
  async submitCloudPassword(
    profileId: string,
    accountId: string,
    password: string,
    userId: string
  ): Promise<{ success: boolean; status: string; error?: string }> {
    // Проверка существования и прав доступа
    const account = await this.getAccountById(accountId, userId);
    if (!account) {
      throw new Error('Account not found');
    }

    // Проверка, что это Telegram
    if (account.service?.name !== 'telegram') {
      throw new Error('Cloud password is only supported for Telegram');
    }

    // Проверка, что сервис проверки статуса инициализирован
    if (!this.statusCheckerService) {
      throw new Error('Status checker service is not initialized');
    }

    // Проверка, что профиль запущен
    if (!this.statusCheckerService.isProfileRunning(profileId)) {
      throw new Error('Profile is not running. Please start the profile first.');
    }

    try {
      // Вызов метода ввода пароля в TelegramChecker через StatusCheckerService
      const result = await this.statusCheckerService.submitCloudPassword(
        profileId,
        accountId,
        password
      );

      // Если пароль принят, проверяем новый статус
      if (result.success) {
        // Ждём немного для обновления страницы
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // Проверяем новый статус
        const statusResult = await this.statusCheckerService.checkLoginStatus(
          profileId,
          accountId,
          account.serviceId,
          account.service?.name ?? 'telegram'
        );

        // Обновляем статус в БД
        await this.repository.updateAccountStatus(accountId, statusResult.status);

        logger.info('Cloud password submitted and status updated', {
          accountId,
          profileId,
          newStatus: statusResult.status,
        });

        return {
          success: true,
          status: statusResult.status,
        };
      }

      return result;
    } catch (error) {
      logger.error('Error submitting cloud password', {
        accountId,
        profileId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return {
        success: false,
        status: account.status,
        error: error instanceof Error ? error.message : 'Failed to submit password',
      };
    }
  }
}

