/**
 * Repository для работы с аккаунтами мессенджеров в базе данных
 * 
 * Инкапсулирует все операции с БД для модуля messenger-accounts.
 * Использует Prisma для типобезопасной работы с данными.
 * 
 * @module modules/profiles/messenger-accounts/messenger-accounts.repository
 */

import { PrismaClient, MessengerAccountStatus } from '@prisma/client';
import {
  CreateMessengerAccountInput,
  UpdateMessengerAccountInput,
} from './messenger-accounts.schemas';
import logger from '../../../config/logger';

/**
 * Вспомогательная функция для парсинга metadata из JSON строки в объект
 * 
 * @param metadata - JSON строка или null
 * @returns Объект metadata или null
 */
function parseMetadata(metadata: string | null | undefined): Record<string, unknown> | null {
  if (!metadata) {
    return null;
  }
  
  try {
    return JSON.parse(metadata) as Record<string, unknown>;
  } catch (error) {
    logger.warn('Failed to parse metadata JSON', {
      error: error instanceof Error ? error.message : 'Unknown error',
      metadata,
    });
    return null;
  }
}

/**
 * Вспомогательная функция для трансформации аккаунта с парсингом metadata
 * 
 * @param account - Аккаунт из БД
 * @returns Аккаунт с распарсенным metadata
 */
function transformAccount<T extends { metadata?: string | null }>(account: T): T & { metadata?: Record<string, unknown> | null } {
  return {
    ...account,
    metadata: parseMetadata(account.metadata ?? null),
  };
}

/**
 * Репозиторий для работы с аккаунтами мессенджеров
 */
export class MessengerAccountsRepository {
  constructor(private prisma: PrismaClient) {}

  /**
   * Получение всех мессенджеров (справочник)
   * 
   * @returns Список всех мессенджеров
   */
  async getAllServices() {
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      const services = await this.prisma.messengerService.findMany({
        orderBy: { displayName: 'asc' },
        select: {
          id: true,
          name: true,
          displayName: true,
          icon: true,
          enabled: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      return services;
    } catch (error) {
      logger.error('Failed to get all messenger services', { error });
      throw error;
    }
  }

  /**
   * Получение мессенджера по ID
   * 
   * @param serviceId - ID мессенджера
   * @returns Мессенджер или null
   */
  async getServiceById(serviceId: string) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      const service = await this.prisma.messengerService.findUnique({
        where: { id: serviceId },
        select: {
          id: true,
          name: true,
          displayName: true,
          icon: true,
          enabled: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      return service;
    } catch (error) {
      logger.error('Failed to get messenger service by ID', { error, serviceId });
      throw error;
    }
  }

  /**
   * Получение мессенджера по имени (техническое имя)
   * 
   * @param name - Техническое имя мессенджера (например, "whatsapp")
   * @returns Мессенджер или null
   */
  async getServiceByName(name: string) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      const service = await this.prisma.messengerService.findUnique({
        where: { name },
        select: {
          id: true,
          name: true,
          displayName: true,
          icon: true,
          enabled: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      return service;
    } catch (error) {
      logger.error('Failed to get messenger service by name', { error, name });
      throw error;
    }
  }

  /**
   * Получение всех аккаунтов мессенджеров профиля
   * 
   * @param profileId - ID профиля
   * @returns Список аккаунтов профиля
   */
  async getAccountsByProfileId(profileId: string) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      const accounts = await this.prisma.profileMessengerAccount.findMany({
        where: { profileId },
        include: {
          service: {
            select: {
              id: true,
              name: true,
              displayName: true,
              icon: true,
              enabled: true,
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      });

      // Трансформируем metadata из JSON строки в объект
      return accounts.map(transformAccount);
    } catch (error) {
      logger.error('Failed to get messenger accounts by profile ID', { error, profileId });
      throw error;
    }
  }

  /**
   * Получение всех аккаунтов по ID мессенджера
   * 
   * @param serviceId - ID мессенджера
   * @returns Список аккаунтов
   */
  async findAccountsByServiceId(serviceId: string) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      const accounts = await this.prisma.profileMessengerAccount.findMany({
        where: { serviceId },
        include: {
          service: {
            select: {
              id: true,
              name: true,
              displayName: true,
              icon: true,
              enabled: true,
            },
          },
        },
      });

      // Трансформируем metadata из JSON строки в объект
      return accounts.map(transformAccount);
    } catch (error) {
      logger.error('Failed to get messenger accounts by service ID', { error, serviceId });
      throw error;
    }
  }

  /**
   * Получение аккаунта мессенджера по ID
   * 
   * @param accountId - ID аккаунта
   * @returns Аккаунт или null
   */
  async getAccountById(accountId: string) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      const account = await this.prisma.profileMessengerAccount.findUnique({
        where: { id: accountId },
        include: {
          service: {
            select: {
              id: true,
              name: true,
              displayName: true,
              icon: true,
              enabled: true,
            },
          },
          profile: {
            select: {
              id: true,
              userId: true,
              name: true,
            },
          },
        },
      });

      // Трансформируем metadata из JSON строки в объект
      return account ? transformAccount(account) : null;
    } catch (error) {
      logger.error('Failed to get messenger account by ID', { error, accountId });
      throw error;
    }
  }

  /**
   * Получение аккаунта мессенджера по профилю и сервису
   * 
   * @param profileId - ID профиля
   * @param serviceId - ID мессенджера
   * @returns Аккаунт или null
   */
  async getAccountByProfileAndService(profileId: string, serviceId: string) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      const account = await this.prisma.profileMessengerAccount.findUnique({
        where: {
          profileId_serviceId: {
            profileId,
            serviceId,
          },
        },
        include: {
          service: {
            select: {
              id: true,
              name: true,
              displayName: true,
              icon: true,
              enabled: true,
            },
          },
        },
      });

      // Трансформируем metadata из JSON строки в объект
      return account ? transformAccount(account) : null;
    } catch (error) {
      logger.error('Failed to get messenger account by profile and service', {
        error,
        profileId,
        serviceId,
      });
      throw error;
    }
  }

  /**
   * Создание аккаунта мессенджера для профиля
   * 
   * @param profileId - ID профиля
   * @param data - Данные аккаунта
   * @returns Созданный аккаунт
   */
  async createAccount(profileId: string, data: CreateMessengerAccountInput) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      const account = await this.prisma.profileMessengerAccount.create({
        data: {
          profileId,
          serviceId: data.serviceId,
          isEnabled: data.isEnabled ?? true,
          status: 'UNKNOWN',
          metadata: data.metadata ? JSON.stringify(data.metadata) : null,
        },
        include: {
          service: {
            select: {
              id: true,
              name: true,
              displayName: true,
              icon: true,
              enabled: true,
            },
          },
        },
      });

      logger.info('Messenger account created', { accountId: account.id, profileId, serviceId: data.serviceId });
      // Трансформируем metadata из JSON строки в объект
      return transformAccount(account);
    } catch (error) {
      logger.error('Failed to create messenger account', { error, profileId, data });
      throw error;
    }
  }

  /**
   * Обновление аккаунта мессенджера
   * 
   * @param accountId - ID аккаунта
   * @param data - Данные для обновления
   * @returns Обновленный аккаунт
   */
  async updateAccount(accountId: string, data: UpdateMessengerAccountInput) {
    try {
      const updateData: {
        isEnabled?: boolean;
        metadata?: string | null;
      } = {};

      if (data.isEnabled !== undefined) {
        updateData.isEnabled = data.isEnabled;
      }

      if (data.metadata !== undefined) {
        updateData.metadata = data.metadata ? JSON.stringify(data.metadata) : null;
      }

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      const account = await this.prisma.profileMessengerAccount.update({
        where: { id: accountId },
        data: updateData,
        include: {
          service: {
            select: {
              id: true,
              name: true,
              displayName: true,
              icon: true,
              enabled: true,
            },
          },
        },
      });

      logger.info('Messenger account updated', { accountId });
      // Трансформируем metadata из JSON строки в объект
      return transformAccount(account);
    } catch (error) {
      logger.error('Failed to update messenger account', { error, accountId, data });
      throw error;
    }
  }

  /**
   * Обновление статуса аккаунта
   * 
   * @param accountId - ID аккаунта
   * @param status - Новый статус
   * @returns Обновленный аккаунт
   */
  async updateAccountStatus(accountId: string, status: MessengerAccountStatus) {
    try {
      const now = new Date();
      
      // Получаем текущий статус для проверки, изменился ли он
      const currentAccount = await this.getAccountById(accountId);
      const statusChanged = currentAccount?.status !== status;

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      const account = await this.prisma.profileMessengerAccount.update({
        where: { id: accountId },
        data: {
          status,
          lastCheckedAt: now,
          ...(statusChanged && { lastStatusChangeAt: now }),
        },
        include: {
          service: {
            select: {
              id: true,
              name: true,
              displayName: true,
              icon: true,
              enabled: true,
            },
          },
        },
      });

      logger.debug('Messenger account status updated', { accountId, status, statusChanged });
      // Трансформируем metadata из JSON строки в объект
      return transformAccount(account);
    } catch (error) {
      logger.error('Failed to update messenger account status', { error, accountId, status });
      throw error;
    }
  }

  /**
   * Включение мессенджера для профиля
   * 
   * @param accountId - ID аккаунта
   * @returns Обновленный аккаунт
   */
  async enableAccount(accountId: string) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      const account = await this.prisma.profileMessengerAccount.update({
        where: { id: accountId },
        data: { isEnabled: true },
        include: {
          service: {
            select: {
              id: true,
              name: true,
              displayName: true,
              icon: true,
              enabled: true,
            },
          },
        },
      });

      logger.info('Messenger account enabled', { accountId });
      // Трансформируем metadata из JSON строки в объект
      return transformAccount(account);
    } catch (error) {
      logger.error('Failed to enable messenger account', { error, accountId });
      throw error;
    }
  }

  /**
   * Выключение мессенджера для профиля
   * 
   * @param accountId - ID аккаунта
   * @returns Обновленный аккаунт
   */
  async disableAccount(accountId: string) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      const account = await this.prisma.profileMessengerAccount.update({
        where: { id: accountId },
        data: { isEnabled: false },
        include: {
          service: {
            select: {
              id: true,
              name: true,
              displayName: true,
              icon: true,
              enabled: true,
            },
          },
        },
      });

      logger.info('Messenger account disabled', { accountId });
      // Трансформируем metadata из JSON строки в объект
      return transformAccount(account);
    } catch (error) {
      logger.error('Failed to disable messenger account', { error, accountId });
      throw error;
    }
  }

  /**
   * Удаление аккаунта мессенджера
   * 
   * @param accountId - ID аккаунта
   */
  async deleteAccount(accountId: string) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      await this.prisma.profileMessengerAccount.delete({
        where: { id: accountId },
      });

      logger.info('Messenger account deleted', { accountId });
    } catch (error) {
      logger.error('Failed to delete messenger account', { error, accountId });
      throw error;
    }
  }

  /**
   * Получение всех включенных аккаунтов для мониторинга
   * 
   * @returns Список аккаунтов с включенным мониторингом
   */
  async getEnabledAccountsForMonitoring() {
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      const accounts = await this.prisma.profileMessengerAccount.findMany({
        where: {
          isEnabled: true,
          service: {
            enabled: true, // Мессенджер должен быть включен в системе
          },
        },
        include: {
          service: {
            select: {
              id: true,
              name: true,
              displayName: true,
            },
          },
          profile: {
            select: {
              id: true,
              userId: true,
              status: true,
            },
          },
        },
      });

      // Трансформируем metadata из JSON строки в объект
      return accounts.map(transformAccount);
    } catch (error) {
      logger.error('Failed to get enabled accounts for monitoring', { error });
      throw error;
    }
  }

  /**
   * Получение конфигурации проверки для мессенджера
   * 
   * @param serviceId - ID мессенджера
   * @returns Конфигурация или null
   */
  async getCheckConfig(serviceId: string) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      const config = await this.prisma.messengerCheckConfig.findUnique({
        where: { serviceId },
        include: {
          service: {
            select: {
              id: true,
              name: true,
              displayName: true,
            },
          },
        },
      });

      return config;
    } catch (error) {
      logger.error('Failed to get check config', { error, serviceId });
      throw error;
    }
  }

  /**
   * Получение количества аккаунтов мессенджеров для списка профилей
   * 
   * @param profileIds - Массив ID профилей
   * @returns Объект с количеством аккаунтов для каждого профиля: { profileId: count }
   */
  async getAccountsCountByProfileIds(profileIds: string[]): Promise<Record<string, number>> {
    try {
      if (profileIds.length === 0) {
        return {};
      }

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      const counts = await this.prisma.profileMessengerAccount.groupBy({
        by: ['profileId'],
        where: {
          profileId: {
            in: profileIds,
          },
        },
        _count: {
          id: true,
        },
      });

      // Преобразуем результат в объект { profileId: count }
      const result: Record<string, number> = {};
      for (const count of counts) {
        result[count.profileId] = count._count.id;
      }

      // Для профилей без аккаунтов устанавливаем 0
      for (const profileId of profileIds) {
        if (!(profileId in result)) {
          result[profileId] = 0;
        }
      }

      return result;
    } catch (error) {
      logger.error('Failed to get accounts count by profile IDs', { error, profileIds });
      throw error;
    }
  }

  /**
   * Получение всех конфигураций проверки
   * 
   * @returns Список всех конфигураций
   */
  async getAllCheckConfigs() {
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      const configs = await this.prisma.messengerCheckConfig.findMany({
        include: {
          service: {
            select: {
              id: true,
              name: true,
              displayName: true,
              enabled: true,
            },
          },
        },
        orderBy: {
          service: {
            displayName: 'asc',
          },
        },
      });

      return configs;
    } catch (error) {
      logger.error('Failed to get all check configs', { error });
      throw error;
    }
  }

  /**
   * Создание или обновление конфигурации проверки
   * 
   * @param serviceId - ID мессенджера
   * @param checkIntervalSeconds - Интервал проверки в секундах
   * @param enabled - Включен ли мониторинг
   * @param updatedBy - ID пользователя, который обновил конфигурацию
   * @returns Конфигурация
   */
  async upsertCheckConfig(
    serviceId: string,
    checkIntervalSeconds: number,
    enabled: boolean,
    updatedBy?: string
  ) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      const config = await this.prisma.messengerCheckConfig.upsert({
        where: { serviceId },
        create: {
          serviceId,
          checkIntervalSeconds,
          enabled,
          updatedBy: updatedBy ?? null,
        },
        update: {
          checkIntervalSeconds,
          enabled,
          updatedBy: updatedBy ?? null,
        },
        include: {
          service: {
            select: {
              id: true,
              name: true,
              displayName: true,
              enabled: true,
            },
          },
        },
      });

      logger.info('Messenger check config upserted', { serviceId, checkIntervalSeconds, enabled });
      return config;
    } catch (error) {
      logger.error('Failed to upsert check config', {
        error,
        serviceId,
        checkIntervalSeconds,
        enabled,
      });
      throw error;
    }
  }
}

