/**
 * Load Balancer Service для распределения контактов между профилями
 * 
 * Отвечает за:
 * - Равномерное распределение контактов между профилями
 * - Создание очереди сообщений (CampaignMessage)
 * - Перебалансировку при падении профиля
 * - Получение следующего контакта для обработки
 * 
 * @module modules/campaigns/load-balancer/load-balancer.service
 */

import { PrismaClient, MessengerTarget, MessengerType, MessengerStatus, UniversalTarget } from '@prisma/client';
import logger from '../../../config/logger';
import {
  CampaignMessageRepository,
  CampaignProfileRepository,
  CreateCampaignMessageData,
} from '../campaigns.repository';

// ============================================
// Типы
// ============================================

export interface ContactInfo {
  clientId: string;
  clientPhoneId: string;
  phone: string;
  whatsAppStatus: MessengerStatus;
  telegramStatus: MessengerStatus;
  firstName?: string | null;
  lastName?: string | null;
}

export interface ProfileAssignment {
  profileId: string;
  profileName: string;
  assignedCount: number;
  contacts: ContactInfo[];
}

export interface DistributionResult {
  totalContacts: number;
  distributions: ProfileAssignment[];
  skippedContacts: number;
  skippedReasons: string[];
}

export interface FilterConfig {
  // Фильтры базы клиентов
  clientStatuses?: string[];
  whatsAppStatus?: MessengerStatus[];
  telegramStatus?: MessengerStatus[];
  hasWhatsApp?: boolean;
  hasTelegram?: boolean;
  skipDuplicates?: boolean; // Не отправлять тем, кто уже получал
  lastCampaignDaysAgo?: number; // Не отправлять тем, кто получал за последние N дней
}

export interface OptionsConfig {
  enableDeduplication?: boolean;
  cooldownDays?: number;
  enableWarmup?: boolean;
  warmupDays?: number;
  warmupMessagesPerDay?: number;
}

// ============================================
// Load Balancer Service
// ============================================

export class LoadBalancerService {
  private messageRepository: CampaignMessageRepository;
  private profileRepository: CampaignProfileRepository;

  constructor(private prisma: PrismaClient) {
    this.messageRepository = new CampaignMessageRepository(prisma);
    this.profileRepository = new CampaignProfileRepository(prisma);
  }

  /**
   * Получение контактов из группы клиентов с применением фильтров
   */
  async getContactsFromGroup(
    clientGroupId: string,
    messengerTarget: MessengerTarget,
    filterConfig?: FilterConfig,
    optionsConfig?: OptionsConfig
  ): Promise<ContactInfo[]> {
    try {
      // Базовый запрос - все телефоны клиентов из группы
      const clients = await this.prisma.client.findMany({
        where: {
          groupId: clientGroupId,
          ...(filterConfig?.clientStatuses && filterConfig.clientStatuses.length > 0
            ? { status: { in: filterConfig.clientStatuses as ('NEW' | 'OLD')[] } }
            : {}),
        },
        include: {
          phones: {
            where: {
              // Фильтрация по статусу мессенджеров в зависимости от типа кампании
              ...(messengerTarget === 'WHATSAPP_ONLY' && {
                whatsAppStatus: filterConfig?.whatsAppStatus?.length
                  ? { in: filterConfig.whatsAppStatus }
                  : { not: 'Invalid' },
              }),
              ...(messengerTarget === 'TELEGRAM_ONLY' && {
                telegramStatus: filterConfig?.telegramStatus?.length
                  ? { in: filterConfig.telegramStatus }
                  : { not: 'Invalid' },
              }),
              // Для UNIVERSAL - хотя бы один из мессенджеров должен быть доступен
              ...(messengerTarget === 'UNIVERSAL' && {
                OR: [
                  { whatsAppStatus: { not: 'Invalid' } },
                  { telegramStatus: { not: 'Invalid' } },
                ],
              }),
            },
          },
        },
      });

      // Собираем все телефоны в плоский список
      const contacts: ContactInfo[] = [];
      const seenPhones = new Set<string>();

      for (const client of clients) {
        // Проверка cooldown (если включен)
        if (optionsConfig?.cooldownDays && optionsConfig.cooldownDays > 0) {
          const cooldownDate = new Date();
          cooldownDate.setDate(cooldownDate.getDate() - optionsConfig.cooldownDays);
          
          if (client.lastCampaignAt && client.lastCampaignAt > cooldownDate) {
            continue; // Пропускаем клиента - он недавно получал рассылку
          }
        }

        for (const phone of client.phones) {
          // Дедупликация по номеру телефона (если включена)
          if (optionsConfig?.enableDeduplication || filterConfig?.skipDuplicates) {
            if (seenPhones.has(phone.phone)) {
              continue;
            }
            seenPhones.add(phone.phone);
          }

          // Проверяем подходит ли телефон для выбранного типа рассылки
          const isValidForTarget = this.isPhoneValidForTarget(phone, messengerTarget);
          if (!isValidForTarget) {
            continue;
          }

          contacts.push({
            clientId: client.id,
            clientPhoneId: phone.id,
            phone: phone.phone,
            whatsAppStatus: phone.whatsAppStatus,
            telegramStatus: phone.telegramStatus,
            firstName: client.firstName,
            lastName: client.lastName,
          });
        }
      }

      logger.info('Contacts fetched from group', {
        clientGroupId,
        messengerTarget,
        totalContacts: contacts.length,
        totalClients: clients.length,
      });

      return contacts;
    } catch (error) {
      logger.error('Failed to get contacts from group', { error, clientGroupId });
      throw error;
    }
  }

  /**
   * Проверка подходит ли телефон для типа рассылки
   */
  private isPhoneValidForTarget(
    phone: { whatsAppStatus: MessengerStatus; telegramStatus: MessengerStatus },
    messengerTarget: MessengerTarget
  ): boolean {
    switch (messengerTarget) {
      case 'WHATSAPP_ONLY':
        return phone.whatsAppStatus !== 'Invalid';
      case 'TELEGRAM_ONLY':
        return phone.telegramStatus !== 'Invalid';
      case 'UNIVERSAL':
        return phone.whatsAppStatus !== 'Invalid' || phone.telegramStatus !== 'Invalid';
      default:
        return false;
    }
  }

  /**
   * Равномерное распределение контактов между профилями
   */
  distributeContacts(
    contacts: ContactInfo[],
    profileIds: string[],
    profileNames: Map<string, string>
  ): DistributionResult {
    if (profileIds.length === 0) {
      return {
        totalContacts: contacts.length,
        distributions: [],
        skippedContacts: contacts.length,
        skippedReasons: ['No profiles available'],
      };
    }

    // Инициализируем распределение для каждого профиля
    const distributions: ProfileAssignment[] = profileIds.map((profileId) => ({
      profileId,
      profileName: profileNames.get(profileId) || 'Unknown',
      assignedCount: 0,
      contacts: [],
    }));

    // Round-robin распределение контактов
    let profileIndex = 0;
    for (const contact of contacts) {
      const distribution = distributions[profileIndex];
      distribution.contacts.push(contact);
      distribution.assignedCount++;
      profileIndex = (profileIndex + 1) % profileIds.length;
    }

    logger.info('Contacts distributed', {
      totalContacts: contacts.length,
      profileCount: profileIds.length,
      distribution: distributions.map((d) => ({
        profileId: d.profileId,
        count: d.assignedCount,
      })),
    });

    return {
      totalContacts: contacts.length,
      distributions,
      skippedContacts: 0,
      skippedReasons: [],
    };
  }

  /**
   * Создание очереди сообщений для кампании
   */
  async createCampaignMessages(
    campaignId: string,
    distributions: ProfileAssignment[],
    messengerTarget: MessengerTarget,
    universalTarget?: UniversalTarget | null
  ): Promise<number> {
    try {
      const messagesToCreate: CreateCampaignMessageData[] = [];

      for (const distribution of distributions) {
        for (const contact of distribution.contacts) {
          // Определяем мессенджер для отправки
          const messenger = this.determineMessenger(contact, messengerTarget, universalTarget);

          messagesToCreate.push({
            campaignId,
            clientId: contact.clientId,
            clientPhoneId: contact.clientPhoneId,
            profileId: distribution.profileId,
            messenger,
          });
        }
      }

      // Массовое создание сообщений
      if (messagesToCreate.length > 0) {
        const createdCount = await this.messageRepository.createMany(messagesToCreate);

        logger.info('Campaign messages created', {
          campaignId,
          count: createdCount,
        });

        return createdCount;
      }

      return 0;
    } catch (error) {
      logger.error('Failed to create campaign messages', { error, campaignId });
      throw error;
    }
  }

  /**
   * Определение мессенджера для отправки
   */
  private determineMessenger(
    contact: ContactInfo,
    messengerTarget: MessengerTarget,
    universalTarget?: UniversalTarget | null
  ): MessengerType | null {
    switch (messengerTarget) {
      case 'WHATSAPP_ONLY':
        return 'WHATSAPP';
      case 'TELEGRAM_ONLY':
        return 'TELEGRAM';
      case 'UNIVERSAL':
        // Выбор зависит от universalTarget и валидности номеров
        return this.resolveUniversalMessenger(contact, universalTarget);
      default:
        return null;
    }
  }

  private resolveUniversalMessenger(
    contact: ContactInfo,
    universalTarget?: UniversalTarget | null
  ): MessengerType | null {
    const hasWa = contact.whatsAppStatus !== 'Invalid';
    const hasTg = contact.telegramStatus !== 'Invalid';

    if (universalTarget === 'BOTH') {
      // Оставляем null — чтобы downstream мог отправить в оба по очереди
      return null;
    }

    if (universalTarget === 'WHATSAPP_FIRST') {
      if (hasWa) return 'WHATSAPP';
      if (hasTg) return 'TELEGRAM';
      return null;
    }

    if (universalTarget === 'TELEGRAM_FIRST') {
      if (hasTg) return 'TELEGRAM';
      if (hasWa) return 'WHATSAPP';
      return null;
    }

    // Значение по умолчанию — пытаемся WhatsApp, иначе Telegram
    if (hasWa) return 'WHATSAPP';
    if (hasTg) return 'TELEGRAM';
    return null;
  }

  /**
   * Обновление счётчиков профилей кампании
   */
  async updateProfileAssignments(campaignId: string, distributions: ProfileAssignment[]): Promise<void> {
    try {
      for (const distribution of distributions) {
        // Находим CampaignProfile
        const campaignProfile = await this.profileRepository.findByCampaignAndProfile(
          campaignId,
          distribution.profileId
        );

        if (campaignProfile) {
          await this.profileRepository.update(campaignProfile.id, {
            processedCount: 0,
            successCount: 0,
            failedCount: 0,
          });

          // Обновляем assignedCount напрямую через Prisma, т.к. метод update не поддерживает это поле
          await this.prisma.campaignProfile.update({
            where: { id: campaignProfile.id },
            data: { assignedCount: distribution.assignedCount },
          });
        }
      }

      logger.info('Profile assignments updated', { campaignId });
    } catch (error) {
      logger.error('Failed to update profile assignments', { error, campaignId });
      throw error;
    }
  }

  /**
   * Полный процесс распределения для кампании
   */
  async distributeForCampaign(
    campaignId: string,
    clientGroupId: string,
    profileIds: string[],
    messengerTarget: MessengerTarget,
    universalTarget?: UniversalTarget | null,
    filterConfig?: FilterConfig,
    optionsConfig?: OptionsConfig
  ): Promise<{
    totalContacts: number;
    createdMessages: number;
    distributions: Array<{ profileId: string; assignedCount: number }>;
  }> {
    try {
      // 1. Получаем контакты
      const contacts = await this.getContactsFromGroup(
        clientGroupId,
        messengerTarget,
        filterConfig,
        optionsConfig
      );

      if (contacts.length === 0) {
        logger.warn('No contacts found for campaign', { campaignId, clientGroupId });
        return {
          totalContacts: 0,
          createdMessages: 0,
          distributions: [],
        };
      }

      // 2. Получаем имена профилей
      const profiles = await this.prisma.profile.findMany({
        where: { id: { in: profileIds } },
        select: { id: true, name: true },
      });

      const profileNames = new Map<string, string>();
      profiles.forEach((p) => profileNames.set(p.id, p.name));

      // 3. Распределяем контакты
      const distributionResult = this.distributeContacts(contacts, profileIds, profileNames);

      // 4. Создаём сообщения в очереди
      const createdMessages = await this.createCampaignMessages(
        campaignId,
        distributionResult.distributions,
        messengerTarget,
        universalTarget
      );

      // 5. Обновляем счётчики профилей
      await this.updateProfileAssignments(campaignId, distributionResult.distributions);

      logger.info('Distribution completed for campaign', {
        campaignId,
        totalContacts: distributionResult.totalContacts,
        createdMessages,
      });

      return {
        totalContacts: distributionResult.totalContacts,
        createdMessages,
        distributions: distributionResult.distributions.map((d) => ({
          profileId: d.profileId,
          assignedCount: d.assignedCount,
        })),
      };
    } catch (error) {
      logger.error('Failed to distribute for campaign', { error, campaignId });
      throw error;
    }
  }

  /**
   * Перебалансировка при падении профиля
   * Переназначает pending сообщения с упавшего профиля на активные профили
   */
  async rebalanceOnProfileFailure(
    campaignId: string,
    failedProfileId: string
  ): Promise<{
    reassignedCount: number;
    newDistribution: Array<{ profileId: string; addedCount: number }>;
  }> {
    try {
      // 1. Получаем активные профили кампании
      const activeProfiles = await this.profileRepository.findActiveInCampaign(campaignId);
      const availableProfiles = activeProfiles.filter(
        (p) => p.profileId !== failedProfileId && p.status !== 'ERROR'
      );

      if (availableProfiles.length === 0) {
        logger.warn('No available profiles for rebalancing', { campaignId, failedProfileId });
        return {
          reassignedCount: 0,
          newDistribution: [],
        };
      }

      // 2. Получаем pending сообщения упавшего профиля
      const pendingMessages = await this.prisma.campaignMessage.findMany({
        where: {
          campaignId,
          profileId: failedProfileId,
          status: 'PENDING',
        },
        select: { id: true },
      });

      if (pendingMessages.length === 0) {
        return {
          reassignedCount: 0,
          newDistribution: [],
        };
      }

      // 3. Round-robin переназначение
      const newDistribution: Map<string, number> = new Map();
      availableProfiles.forEach((p) => newDistribution.set(p.profileId, 0));

      let profileIndex = 0;
      const profileIdList = availableProfiles.map((p) => p.profileId);

      // Обновляем каждое сообщение
      for (const message of pendingMessages) {
        const targetProfileId = profileIdList[profileIndex];
        await this.prisma.campaignMessage.update({
          where: { id: message.id },
          data: { profileId: targetProfileId },
        });

        newDistribution.set(
          targetProfileId,
          (newDistribution.get(targetProfileId) || 0) + 1
        );
        profileIndex = (profileIndex + 1) % profileIdList.length;
      }

      // 4. Обновляем счётчики профилей
      for (const [profileId, addedCount] of newDistribution) {
        const campaignProfile = await this.profileRepository.findByCampaignAndProfile(
          campaignId,
          profileId
        );

        if (campaignProfile) {
          await this.prisma.campaignProfile.update({
            where: { id: campaignProfile.id },
            data: {
              assignedCount: { increment: addedCount },
            },
          });
        }
      }

      logger.info('Rebalancing completed', {
        campaignId,
        failedProfileId,
        reassignedCount: pendingMessages.length,
        newDistribution: Array.from(newDistribution.entries()),
      });

      return {
        reassignedCount: pendingMessages.length,
        newDistribution: Array.from(newDistribution.entries()).map(([profileId, addedCount]) => ({
          profileId,
          addedCount,
        })),
      };
    } catch (error) {
      logger.error('Failed to rebalance on profile failure', { error, campaignId, failedProfileId });
      throw error;
    }
  }

  /**
   * Получение следующего сообщения для профиля
   */
  async getNextMessage(campaignId: string, profileId: string) {
    try {
      return await this.messageRepository.getNextForProfile(campaignId, profileId);
    } catch (error) {
      logger.error('Failed to get next message', { error, campaignId, profileId });
      throw error;
    }
  }

  /**
   * Получение chunk сообщений для профиля
   */
  async getMessageChunk(campaignId: string, profileId: string, chunkSize: number = 10) {
    try {
      return await this.messageRepository.getChunkForProfile(campaignId, profileId, chunkSize);
    } catch (error) {
      logger.error('Failed to get message chunk', { error, campaignId, profileId, chunkSize });
      throw error;
    }
  }

  /**
   * Отметка сообщения как обработанного (успешно)
   */
  async markMessageSent(messageId: string, messenger: MessengerType, messagesSent: number = 1) {
    try {
      return await this.prisma.campaignMessage.update({
        where: { id: messageId },
        data: {
          status: 'SENT',
          sentAt: new Date(),
          messenger,
          messagesSent,
        },
      });
    } catch (error) {
      logger.error('Failed to mark message as sent', { error, messageId });
      throw error;
    }
  }

  /**
   * Отметка сообщения как неудачного
   */
  async markMessageFailed(messageId: string, errorMessage: string) {
    try {
      return await this.messageRepository.markAsFailed(messageId, errorMessage);
    } catch (error) {
      logger.error('Failed to mark message as failed', { error, messageId });
      throw error;
    }
  }

  /**
   * Отметка сообщения как пропущенного
   */
  async markMessageSkipped(messageId: string, reason: string) {
    try {
      return await this.messageRepository.markAsSkipped(messageId, reason);
    } catch (error) {
      logger.error('Failed to mark message as skipped', { error, messageId });
      throw error;
    }
  }

  /**
   * Установка статуса PROCESSING для сообщения
   */
  async markMessageProcessing(messageId: string) {
    try {
      return await this.prisma.campaignMessage.update({
        where: { id: messageId },
        data: { status: 'PROCESSING' },
      });
    } catch (error) {
      logger.error('Failed to mark message as processing', { error, messageId });
      throw error;
    }
  }

  /**
   * Получение количества pending сообщений для профиля
   */
  async getPendingCountForProfile(campaignId: string, profileId: string): Promise<number> {
    try {
      return await this.messageRepository.countPendingForProfile(campaignId, profileId);
    } catch (error) {
      logger.error('Failed to get pending count for profile', { error, campaignId, profileId });
      throw error;
    }
  }

  /**
   * Получение статистики распределения по профилям
   */
  async getDistributionStats(campaignId: string): Promise<
    Array<{
      profileId: string;
      profileName: string;
      total: number;
      pending: number;
      sent: number;
      failed: number;
      skipped: number;
    }>
  > {
    try {
      const campaignProfiles = await this.prisma.campaignProfile.findMany({
        where: { campaignId },
        include: {
          profile: { select: { name: true } },
        },
      });

      const stats: Array<{
        profileId: string;
        profileName: string;
        total: number;
        pending: number;
        sent: number;
        failed: number;
        skipped: number;
      }> = [];

      for (const cp of campaignProfiles) {
        const messageStats = await this.prisma.campaignMessage.groupBy({
          by: ['status'],
          where: { campaignId, profileId: cp.profileId },
          _count: { id: true },
        });

        const profileStats = {
          profileId: cp.profileId,
          profileName: cp.profile.name,
          total: 0,
          pending: 0,
          sent: 0,
          failed: 0,
          skipped: 0,
        };

        messageStats.forEach((s) => {
          const count = s._count.id;
          profileStats.total += count;
          switch (s.status) {
            case 'PENDING':
            case 'PROCESSING':
              profileStats.pending += count;
              break;
            case 'SENT':
              profileStats.sent += count;
              break;
            case 'FAILED':
              profileStats.failed += count;
              break;
            case 'SKIPPED':
              profileStats.skipped += count;
              break;
          }
        });

        stats.push(profileStats);
      }

      return stats;
    } catch (error) {
      logger.error('Failed to get distribution stats', { error, campaignId });
      throw error;
    }
  }
}

