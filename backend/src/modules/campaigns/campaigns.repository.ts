/**
 * Repository для работы с кампаниями рассылки в базе данных
 * 
 * Инкапсулирует все операции с БД для модуля campaigns.
 * Использует Prisma для типобезопасной работы с данными.
 * 
 * @module modules/campaigns/campaigns.repository
 */

import {
  PrismaClient,
  Campaign,
  CampaignProfile,
  CampaignMessage,
  CampaignLog,
  CampaignType,
  CampaignStatus,
  CampaignProfileStatus,
  MessageStatus,
  MessengerTarget,
  UniversalTarget,
  LogLevel,
  MessengerType,
  Prisma,
} from '@prisma/client';
import logger from '../../config/logger';

// ============================================
// Типы для работы с репозиторием
// ============================================

export interface CreateCampaignData {
  userId: string;
  name: string;
  description?: string | null;
  templateId: string;
  clientGroupId: string;
  campaignType: CampaignType;
  messengerType: MessengerTarget;
  universalTarget?: UniversalTarget | null;
  scheduleConfig?: string | null;
  filterConfig?: string | null;
  optionsConfig?: string | null;
  scheduledAt?: Date | null;
}

export interface UpdateCampaignData {
  name?: string;
  description?: string | null;
  templateId?: string;
  clientGroupId?: string;
  messengerType?: MessengerTarget;
  universalTarget?: UniversalTarget | null;
  scheduleConfig?: string | null;
  filterConfig?: string | null;
  optionsConfig?: string | null;
  scheduledAt?: Date | null;
  status?: CampaignStatus;
}

export interface UpdateCampaignProgressData {
  totalContacts?: number;
  processedContacts?: number;
  successfulContacts?: number;
  failedContacts?: number;
  skippedContacts?: number;
  status?: CampaignStatus;
  startedAt?: Date | null;
  pausedAt?: Date | null;
  completedAt?: Date | null;
  archivedAt?: Date | null;
}

export interface ListCampaignsQuery {
  page: number;
  limit: number;
  status?: CampaignStatus | CampaignStatus[];
  campaignType?: CampaignType;
  messengerType?: MessengerTarget;
  search?: string;
  sortBy: 'createdAt' | 'updatedAt' | 'name' | 'scheduledAt' | 'startedAt';
  sortOrder: 'asc' | 'desc';
  includeArchived?: boolean;
}

export interface CreateCampaignProfileData {
  campaignId: string;
  profileId: string;
  assignedCount?: number;
}

export interface UpdateCampaignProfileData {
  processedCount?: number;
  successCount?: number;
  failedCount?: number;
  status?: CampaignProfileStatus;
  lastError?: string | null;
}

export interface CreateCampaignMessageData {
  campaignId: string;
  clientId: string;
  clientPhoneId: string;
  profileId?: string | null;
  messenger?: MessengerType | null;
}

export interface UpdateCampaignMessageData {
  profileId?: string | null;
  status?: MessageStatus;
  sentAt?: Date | null;
  messenger?: MessengerType | null;
  errorMessage?: string | null;
  retryCount?: number;
  messagesSent?: number;
}

export interface CreateCampaignLogData {
  campaignId: string;
  level: LogLevel;
  action: string;
  message: string;
  metadata?: string | null;
}

export interface ListMessagesQuery {
  page: number;
  limit: number;
  status?: MessageStatus | MessageStatus[];
  messenger?: MessengerType;
  profileId?: string;
}

export interface ListLogsQuery {
  page: number;
  limit: number;
  level?: LogLevel | LogLevel[];
  action?: string;
}

// ============================================
// Campaign Repository
// ============================================

export class CampaignRepository {
  constructor(private prisma: PrismaClient) {}

  /**
   * Создание новой кампании
   */
  async create(data: CreateCampaignData): Promise<Campaign> {
    try {
      const campaign = await this.prisma.campaign.create({
        data: {
          userId: data.userId,
          name: data.name,
          description: data.description ?? null,
          templateId: data.templateId,
          clientGroupId: data.clientGroupId,
          campaignType: data.campaignType,
          messengerType: data.messengerType,
          universalTarget: data.universalTarget ?? null,
          scheduleConfig: data.scheduleConfig ?? null,
          filterConfig: data.filterConfig ?? null,
          optionsConfig: data.optionsConfig ?? null,
          scheduledAt: data.scheduledAt ?? null,
          status: 'DRAFT',
        },
      });

      logger.info('Campaign created', { campaignId: campaign.id, userId: data.userId });
      return campaign;
    } catch (error) {
      logger.error('Failed to create campaign', { error, data });
      throw error;
    }
  }

  /**
   * Получение кампании по ID
   */
  async findById(campaignId: string): Promise<Campaign | null> {
    try {
      return await this.prisma.campaign.findUnique({
        where: { id: campaignId },
      });
    } catch (error) {
      logger.error('Failed to find campaign by ID', { error, campaignId });
      throw error;
    }
  }

  /**
   * Получение кампании по ID с полными связями
   */
  async findByIdWithRelations(campaignId: string): Promise<
    | (Campaign & {
        template: { id: string; name: string; type: string; messengerType: string };
        clientGroup: { id: string; name: string };
        profiles: (CampaignProfile & {
          profile: { id: string; name: string; status: string };
        })[];
        _count: { messages: number; logs: number };
      })
    | null
  > {
    try {
      return await this.prisma.campaign.findUnique({
        where: { id: campaignId },
        include: {
          template: {
            select: { id: true, name: true, type: true, messengerType: true },
          },
          clientGroup: {
            select: { id: true, name: true },
          },
          profiles: {
            include: {
              profile: {
                select: { id: true, name: true, status: true },
              },
            },
          },
          _count: {
            select: { messages: true, logs: true },
          },
        },
      });
    } catch (error) {
      logger.error('Failed to find campaign by ID with relations', { error, campaignId });
      throw error;
    }
  }

  /**
   * Получение списка кампаний пользователя с пагинацией и фильтрами
   */
  async findMany(userId: string, query: ListCampaignsQuery) {
    try {
      const { page, limit, status, campaignType, messengerType, search, sortBy, sortOrder, includeArchived } = query;
      const skip = (page - 1) * limit;

      // Построение условий фильтрации
      const where: Prisma.CampaignWhereInput = {
        userId,
        ...(status && {
          status: Array.isArray(status) ? { in: status } : status,
        }),
        ...(campaignType && { campaignType }),
        ...(messengerType && { messengerType }),
        ...(search && {
          OR: [
            { name: { contains: search } },
            { description: { contains: search } },
          ],
        }),
        ...(!includeArchived && { archivedAt: null }),
      };

      // Построение сортировки
      const orderBy: Prisma.CampaignOrderByWithRelationInput = {};
      orderBy[sortBy] = sortOrder;

      // Получение кампаний и общего количества
      const [campaigns, total] = await Promise.all([
        this.prisma.campaign.findMany({
          where,
          skip,
          take: limit,
          orderBy,
          include: {
            template: {
              select: { id: true, name: true, type: true, messengerType: true },
            },
            clientGroup: {
              select: { id: true, name: true },
            },
            _count: {
              select: { profiles: true, messages: true },
            },
          },
        }),
        this.prisma.campaign.count({ where }),
      ]);

      const totalPages = Math.ceil(total / limit);

      return {
        data: campaigns,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
        },
      };
    } catch (error) {
      logger.error('Failed to find campaigns', { error, userId, query });
      throw error;
    }
  }

  /**
   * Получение всех кампаний (для ROOT)
   */
  async findAll(query: ListCampaignsQuery & { userId?: string }) {
    try {
      const { page, limit, status, campaignType, messengerType, search, sortBy, sortOrder, includeArchived, userId } =
        query;
      const skip = (page - 1) * limit;

      const where: Prisma.CampaignWhereInput = {
        ...(userId && { userId }),
        ...(status && {
          status: Array.isArray(status) ? { in: status } : status,
        }),
        ...(campaignType && { campaignType }),
        ...(messengerType && { messengerType }),
        ...(search && {
          OR: [
            { name: { contains: search } },
            { description: { contains: search } },
          ],
        }),
        ...(!includeArchived && { archivedAt: null }),
      };

      const orderBy: Prisma.CampaignOrderByWithRelationInput = {};
      orderBy[sortBy] = sortOrder;

      const [campaigns, total] = await Promise.all([
        this.prisma.campaign.findMany({
          where,
          skip,
          take: limit,
          orderBy,
          include: {
            user: {
              select: { id: true, email: true },
            },
            template: {
              select: { id: true, name: true, type: true },
            },
            clientGroup: {
              select: { id: true, name: true },
            },
            _count: {
              select: { profiles: true, messages: true },
            },
          },
        }),
        this.prisma.campaign.count({ where }),
      ]);

      const totalPages = Math.ceil(total / limit);

      return {
        data: campaigns,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
        },
      };
    } catch (error) {
      logger.error('Failed to find all campaigns', { error, query });
      throw error;
    }
  }

  /**
   * Обновление кампании
   */
  async update(campaignId: string, data: UpdateCampaignData): Promise<Campaign> {
    try {
      const campaign = await this.prisma.campaign.update({
        where: { id: campaignId },
        data: {
          ...(data.name !== undefined && { name: data.name }),
          ...(data.description !== undefined && { description: data.description }),
          ...(data.templateId !== undefined && { templateId: data.templateId }),
          ...(data.clientGroupId !== undefined && { clientGroupId: data.clientGroupId }),
          ...(data.messengerType !== undefined && { messengerType: data.messengerType }),
          ...(data.universalTarget !== undefined && { universalTarget: data.universalTarget }),
          ...(data.scheduleConfig !== undefined && { scheduleConfig: data.scheduleConfig }),
          ...(data.filterConfig !== undefined && { filterConfig: data.filterConfig }),
          ...(data.optionsConfig !== undefined && { optionsConfig: data.optionsConfig }),
          ...(data.scheduledAt !== undefined && { scheduledAt: data.scheduledAt }),
          ...(data.status !== undefined && { status: data.status }),
        },
      });

      logger.info('Campaign updated', { campaignId });
      return campaign;
    } catch (error) {
      logger.error('Failed to update campaign', { error, campaignId, data });
      throw error;
    }
  }

  /**
   * Обновление прогресса кампании
   */
  async updateProgress(campaignId: string, data: UpdateCampaignProgressData): Promise<Campaign> {
    try {
      const campaign = await this.prisma.campaign.update({
        where: { id: campaignId },
        data: {
          ...(data.totalContacts !== undefined && { totalContacts: data.totalContacts }),
          ...(data.processedContacts !== undefined && { processedContacts: data.processedContacts }),
          ...(data.successfulContacts !== undefined && { successfulContacts: data.successfulContacts }),
          ...(data.failedContacts !== undefined && { failedContacts: data.failedContacts }),
          ...(data.skippedContacts !== undefined && { skippedContacts: data.skippedContacts }),
          ...(data.status !== undefined && { status: data.status }),
          ...(data.startedAt !== undefined && { startedAt: data.startedAt }),
          ...(data.pausedAt !== undefined && { pausedAt: data.pausedAt }),
          ...(data.completedAt !== undefined && { completedAt: data.completedAt }),
          ...(data.archivedAt !== undefined && { archivedAt: data.archivedAt }),
        },
      });

      return campaign;
    } catch (error) {
      logger.error('Failed to update campaign progress', { error, campaignId, data });
      throw error;
    }
  }

  /**
   * Инкрементирование прогресса
   */
  async incrementProgress(
    campaignId: string,
    field: 'processedContacts' | 'successfulContacts' | 'failedContacts' | 'skippedContacts',
    amount: number = 1
  ): Promise<Campaign> {
    try {
      const campaign = await this.prisma.campaign.update({
        where: { id: campaignId },
        data: {
          [field]: { increment: amount },
        },
      });

      return campaign;
    } catch (error) {
      logger.error('Failed to increment campaign progress', { error, campaignId, field, amount });
      throw error;
    }
  }

  /**
   * Удаление кампании
   */
  async delete(campaignId: string): Promise<void> {
    try {
      await this.prisma.campaign.delete({
        where: { id: campaignId },
      });

      logger.info('Campaign deleted', { campaignId });
    } catch (error) {
      logger.error('Failed to delete campaign', { error, campaignId });
      throw error;
    }
  }

  /**
   * Проверка существования кампании
   */
  async exists(campaignId: string): Promise<boolean> {
    try {
      const count = await this.prisma.campaign.count({
        where: { id: campaignId },
      });
      return count > 0;
    } catch (error) {
      logger.error('Failed to check campaign existence', { error, campaignId });
      throw error;
    }
  }

  /**
   * Подсчет кампаний пользователя
   */
  async countByUserId(userId: string, includeArchived: boolean = false): Promise<number> {
    try {
      return await this.prisma.campaign.count({
        where: {
          userId,
          ...(!includeArchived && { archivedAt: null }),
        },
      });
    } catch (error) {
      logger.error('Failed to count campaigns by userId', { error, userId });
      throw error;
    }
  }

  /**
   * Подсчет активных кампаний пользователя
   */
  async countActiveByUserId(userId: string): Promise<number> {
    try {
      return await this.prisma.campaign.count({
        where: {
          userId,
          status: { in: ['SCHEDULED', 'QUEUED', 'RUNNING', 'PAUSED'] },
        },
      });
    } catch (error) {
      logger.error('Failed to count active campaigns', { error, userId });
      throw error;
    }
  }

  /**
   * Получение запланированных кампаний для планировщика
   */
  async findScheduled(beforeDate?: Date): Promise<Campaign[]> {
    try {
      return await this.prisma.campaign.findMany({
        where: {
          status: 'SCHEDULED',
          ...(beforeDate && { scheduledAt: { lte: beforeDate } }),
        },
        orderBy: { scheduledAt: 'asc' },
      });
    } catch (error) {
      logger.error('Failed to find scheduled campaigns', { error, beforeDate });
      throw error;
    }
  }

  /**
   * Получение выполняющихся кампаний
   */
  async findRunning(): Promise<Campaign[]> {
    try {
      return await this.prisma.campaign.findMany({
        where: { 
          status: { in: ['RUNNING', 'PAUSED', 'QUEUED'] }
        },
        include: {
          profiles: {
            include: {
              profile: {
                select: { id: true, name: true, status: true },
              },
            },
          },
        },
      });
    } catch (error) {
      logger.error('Failed to find running campaigns', { error });
      throw error;
    }
  }

  /**
   * Получение кампаний на паузе
   */
  async findPaused(): Promise<Campaign[]> {
    try {
      return await this.prisma.campaign.findMany({
        where: { status: 'PAUSED' },
      });
    } catch (error) {
      logger.error('Failed to find paused campaigns', { error });
      throw error;
    }
  }

  /**
   * Получение старых завершённых кампаний для очистки
   */
  async findOldCompleted(beforeDate: Date, excludeArchived: boolean = true): Promise<Campaign[]> {
    try {
      return await this.prisma.campaign.findMany({
        where: {
          status: { in: ['COMPLETED', 'CANCELLED', 'ERROR'] },
          completedAt: { lte: beforeDate },
          ...(excludeArchived && { archivedAt: null }),
        },
      });
    } catch (error) {
      logger.error('Failed to find old completed campaigns', { error, beforeDate });
      throw error;
    }
  }

  /**
   * Архивирование кампании
   */
  async archive(campaignId: string): Promise<Campaign> {
    try {
      const campaign = await this.prisma.campaign.update({
        where: { id: campaignId },
        data: { archivedAt: new Date() },
      });

      logger.info('Campaign archived', { campaignId });
      return campaign;
    } catch (error) {
      logger.error('Failed to archive campaign', { error, campaignId });
      throw error;
    }
  }

  /**
   * Разархивирование кампании
   */
  async unarchive(campaignId: string): Promise<Campaign> {
    try {
      const campaign = await this.prisma.campaign.update({
        where: { id: campaignId },
        data: { archivedAt: null },
      });

      logger.info('Campaign unarchived', { campaignId });
      return campaign;
    } catch (error) {
      logger.error('Failed to unarchive campaign', { error, campaignId });
      throw error;
    }
  }
}

// ============================================
// Campaign Profile Repository
// ============================================

export class CampaignProfileRepository {
  constructor(private prisma: PrismaClient) {}

  /**
   * Создание связи профиля с кампанией
   */
  async create(data: CreateCampaignProfileData): Promise<CampaignProfile> {
    try {
      const profile = await this.prisma.campaignProfile.create({
        data: {
          campaignId: data.campaignId,
          profileId: data.profileId,
          assignedCount: data.assignedCount ?? 0,
          status: 'PENDING',
        },
      });

      logger.info('Campaign profile created', { 
        campaignProfileId: profile.id, 
        campaignId: data.campaignId, 
        profileId: data.profileId 
      });
      return profile;
    } catch (error) {
      logger.error('Failed to create campaign profile', { error, data });
      throw error;
    }
  }

  /**
   * Массовое создание связей профилей
   */
  async createMany(data: CreateCampaignProfileData[]): Promise<number> {
    try {
      const result = await this.prisma.campaignProfile.createMany({
        data: data.map((d) => ({
          campaignId: d.campaignId,
          profileId: d.profileId,
          assignedCount: d.assignedCount ?? 0,
          status: 'PENDING',
        })),
      });

      logger.info('Campaign profiles created', { count: result.count, campaignId: data[0]?.campaignId });
      return result.count;
    } catch (error) {
      logger.error('Failed to create campaign profiles', { error, count: data.length });
      throw error;
    }
  }

  /**
   * Получение профиля кампании по ID
   */
  async findById(id: string): Promise<CampaignProfile | null> {
    try {
      return await this.prisma.campaignProfile.findUnique({
        where: { id },
      });
    } catch (error) {
      logger.error('Failed to find campaign profile by ID', { error, id });
      throw error;
    }
  }

  /**
   * Получение всех профилей кампании
   */
  async findByCampaignId(campaignId: string): Promise<
    (CampaignProfile & {
      profile: { id: string; name: string; status: string; userId: string };
    })[]
  > {
    try {
      return await this.prisma.campaignProfile.findMany({
        where: { campaignId },
        include: {
          profile: {
            select: { id: true, name: true, status: true, userId: true },
          },
        },
      });
    } catch (error) {
      logger.error('Failed to find campaign profiles', { error, campaignId });
      throw error;
    }
  }

  /**
   * Получение профиля кампании по campaignId и profileId
   */
  async findByCampaignAndProfile(campaignId: string, profileId: string): Promise<CampaignProfile | null> {
    try {
      return await this.prisma.campaignProfile.findUnique({
        where: {
          campaignId_profileId: { campaignId, profileId },
        },
      });
    } catch (error) {
      logger.error('Failed to find campaign profile', { error, campaignId, profileId });
      throw error;
    }
  }

  /**
   * Обновление профиля кампании
   */
  async update(id: string, data: UpdateCampaignProfileData): Promise<CampaignProfile> {
    try {
      const profile = await this.prisma.campaignProfile.update({
        where: { id },
        data: {
          ...(data.processedCount !== undefined && { processedCount: data.processedCount }),
          ...(data.successCount !== undefined && { successCount: data.successCount }),
          ...(data.failedCount !== undefined && { failedCount: data.failedCount }),
          ...(data.status !== undefined && { status: data.status }),
          ...(data.lastError !== undefined && { lastError: data.lastError }),
        },
      });

      return profile;
    } catch (error) {
      logger.error('Failed to update campaign profile', { error, id, data });
      throw error;
    }
  }

  /**
   * Инкрементирование счётчиков
   */
  async incrementCounts(
    id: string,
    field: 'processedCount' | 'successCount' | 'failedCount',
    amount: number = 1
  ): Promise<CampaignProfile> {
    try {
      const profile = await this.prisma.campaignProfile.update({
        where: { id },
        data: {
          [field]: { increment: amount },
        },
      });

      return profile;
    } catch (error) {
      logger.error('Failed to increment campaign profile count', { error, id, field, amount });
      throw error;
    }
  }

  /**
   * Удаление профиля из кампании
   */
  async delete(id: string): Promise<void> {
    try {
      await this.prisma.campaignProfile.delete({
        where: { id },
      });

      logger.info('Campaign profile deleted', { id });
    } catch (error) {
      logger.error('Failed to delete campaign profile', { error, id });
      throw error;
    }
  }

  /**
   * Удаление всех профилей кампании
   */
  async deleteByCampaignId(campaignId: string): Promise<number> {
    try {
      const result = await this.prisma.campaignProfile.deleteMany({
        where: { campaignId },
      });

      logger.info('Campaign profiles deleted', { campaignId, count: result.count });
      return result.count;
    } catch (error) {
      logger.error('Failed to delete campaign profiles', { error, campaignId });
      throw error;
    }
  }

  /**
   * Проверка доступности профиля (не используется в других активных кампаниях)
   */
  async isProfileAvailable(profileId: string, excludeCampaignId?: string): Promise<boolean> {
    try {
      const count = await this.prisma.campaignProfile.count({
        where: {
          profileId,
          status: { in: ['PENDING', 'RUNNING'] },
          campaign: {
            status: { in: ['QUEUED', 'RUNNING'] },
            ...(excludeCampaignId && { NOT: { id: excludeCampaignId } }),
          },
        },
      });
      return count === 0;
    } catch (error) {
      logger.error('Failed to check profile availability', { error, profileId });
      throw error;
    }
  }

  /**
   * Получение активных профилей в кампании
   */
  async findActiveInCampaign(campaignId: string): Promise<CampaignProfile[]> {
    try {
      return await this.prisma.campaignProfile.findMany({
        where: {
          campaignId,
          status: { in: ['PENDING', 'RUNNING'] },
        },
      });
    } catch (error) {
      logger.error('Failed to find active profiles in campaign', { error, campaignId });
      throw error;
    }
  }
}

// ============================================
// Campaign Message Repository
// ============================================

export class CampaignMessageRepository {
  constructor(private prisma: PrismaClient) {}

  /**
   * Создание сообщения в очереди
   */
  async create(data: CreateCampaignMessageData): Promise<CampaignMessage> {
    try {
      const message = await this.prisma.campaignMessage.create({
        data: {
          campaignId: data.campaignId,
          clientId: data.clientId,
          clientPhoneId: data.clientPhoneId,
          profileId: data.profileId ?? null,
          messenger: data.messenger ?? null,
          status: 'PENDING',
        },
      });

      return message;
    } catch (error) {
      logger.error('Failed to create campaign message', { error, data });
      throw error;
    }
  }

  /**
   * Массовое создание сообщений
   */
  async createMany(data: CreateCampaignMessageData[]): Promise<number> {
    try {
      const result = await this.prisma.campaignMessage.createMany({
        data: data.map((d) => ({
          campaignId: d.campaignId,
          clientId: d.clientId,
          clientPhoneId: d.clientPhoneId,
          profileId: d.profileId ?? null,
          messenger: d.messenger ?? null,
          status: 'PENDING',
        })),
      });

      logger.info('Campaign messages created', { count: result.count, campaignId: data[0]?.campaignId });
      return result.count;
    } catch (error) {
      logger.error('Failed to create campaign messages', { error, count: data.length });
      throw error;
    }
  }

  /**
   * Получение сообщения по ID
   */
  async findById(messageId: string): Promise<CampaignMessage | null> {
    try {
      return await this.prisma.campaignMessage.findUnique({
        where: { id: messageId },
      });
    } catch (error) {
      logger.error('Failed to find campaign message by ID', { error, messageId });
      throw error;
    }
  }

  /**
   * Получение сообщений кампании с пагинацией
   */
  async findByCampaignId(campaignId: string, query: ListMessagesQuery) {
    try {
      const { page, limit, status, messenger, profileId } = query;
      const skip = (page - 1) * limit;

      const where: Prisma.CampaignMessageWhereInput = {
        campaignId,
        ...(status && {
          status: Array.isArray(status) ? { in: status } : status,
        }),
        ...(messenger && { messenger }),
        ...(profileId && { profileId }),
      };

      const [messages, total] = await Promise.all([
        this.prisma.campaignMessage.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'asc' },
          include: {
            client: {
              select: { id: true, firstName: true, lastName: true },
            },
            clientPhone: {
              select: { id: true, phone: true },
            },
            profile: {
              select: { id: true, name: true },
            },
          },
        }),
        this.prisma.campaignMessage.count({ where }),
      ]);

      const totalPages = Math.ceil(total / limit);

      return {
        data: messages,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
        },
      };
    } catch (error) {
      logger.error('Failed to find campaign messages', { error, campaignId, query });
      throw error;
    }
  }

  /**
   * Получение следующего сообщения для профиля
   */
  async getNextForProfile(campaignId: string, profileId: string): Promise<CampaignMessage | null> {
    try {
      return await this.prisma.campaignMessage.findFirst({
        where: {
          campaignId,
          profileId,
          status: 'PENDING',
        },
        orderBy: { createdAt: 'asc' },
        include: {
          client: true,
          clientPhone: true,
        },
      });
    } catch (error) {
      logger.error('Failed to get next message for profile', { error, campaignId, profileId });
      throw error;
    }
  }

  /**
   * Получение chunk сообщений для профиля
   */
  async getChunkForProfile(campaignId: string, profileId: string, limit: number = 10): Promise<CampaignMessage[]> {
    try {
      return await this.prisma.campaignMessage.findMany({
        where: {
          campaignId,
          profileId,
          status: 'PENDING',
        },
        take: limit,
        orderBy: { createdAt: 'asc' },
        include: {
          client: {
            include: {
              group: {
                select: { name: true },
              },
              region: {
                select: { name: true },
              },
            },
          },
          clientPhone: true,
        },
      });
    } catch (error) {
      logger.error('Failed to get chunk for profile', { error, campaignId, profileId, limit });
      throw error;
    }
  }

  /**
   * Обновление сообщения
   */
  async update(messageId: string, data: UpdateCampaignMessageData): Promise<CampaignMessage> {
    try {
      const message = await this.prisma.campaignMessage.update({
        where: { id: messageId },
        data: {
          ...(data.profileId !== undefined && { profileId: data.profileId }),
          ...(data.status !== undefined && { status: data.status }),
          ...(data.sentAt !== undefined && { sentAt: data.sentAt }),
          ...(data.messenger !== undefined && { messenger: data.messenger }),
          ...(data.errorMessage !== undefined && { errorMessage: data.errorMessage }),
          ...(data.retryCount !== undefined && { retryCount: data.retryCount }),
          ...(data.messagesSent !== undefined && { messagesSent: data.messagesSent }),
        },
      });

      return message;
    } catch (error) {
      logger.error('Failed to update campaign message', { error, messageId, data });
      throw error;
    }
  }

  /**
   * Отметить сообщение как отправленное
   */
  async markAsSent(messageId: string): Promise<CampaignMessage> {
    try {
      return await this.prisma.campaignMessage.update({
        where: { id: messageId },
        data: {
          status: 'SENT',
          sentAt: new Date(),
        },
      });
    } catch (error) {
      logger.error('Failed to mark message as sent', { error, messageId });
      throw error;
    }
  }

  /**
   * Отметить сообщение как failed
   */
  async markAsFailed(messageId: string, errorMessage: string): Promise<CampaignMessage> {
    try {
      return await this.prisma.campaignMessage.update({
        where: { id: messageId },
        data: {
          status: 'FAILED',
          errorMessage,
          retryCount: { increment: 1 },
        },
      });
    } catch (error) {
      logger.error('Failed to mark message as failed', { error, messageId });
      throw error;
    }
  }

  /**
   * Отметить сообщение как skipped
   */
  async markAsSkipped(messageId: string, reason: string): Promise<CampaignMessage> {
    try {
      return await this.prisma.campaignMessage.update({
        where: { id: messageId },
        data: {
          status: 'SKIPPED',
          errorMessage: reason,
        },
      });
    } catch (error) {
      logger.error('Failed to mark message as skipped', { error, messageId });
      throw error;
    }
  }

  /**
   * Назначение сообщений профилю
   */
  async assignToProfile(campaignId: string, profileId: string, messageIds: string[]): Promise<number> {
    try {
      const result = await this.prisma.campaignMessage.updateMany({
        where: {
          id: { in: messageIds },
          campaignId,
          status: 'PENDING',
        },
        data: { profileId },
      });

      logger.info('Messages assigned to profile', { campaignId, profileId, count: result.count });
      return result.count;
    } catch (error) {
      logger.error('Failed to assign messages to profile', { error, campaignId, profileId });
      throw error;
    }
  }

  /**
   * Переназначение сообщений с одного профиля на другой
   */
  async reassignMessages(
    campaignId: string,
    fromProfileId: string,
    toProfileId: string
  ): Promise<number> {
    try {
      const result = await this.prisma.campaignMessage.updateMany({
        where: {
          campaignId,
          profileId: fromProfileId,
          status: 'PENDING',
        },
        data: { profileId: toProfileId },
      });

      logger.info('Messages reassigned', { campaignId, fromProfileId, toProfileId, count: result.count });
      return result.count;
    } catch (error) {
      logger.error('Failed to reassign messages', { error, campaignId, fromProfileId, toProfileId });
      throw error;
    }
  }

  /**
   * Получение статистики по сообщениям кампании
   */
  async getStats(campaignId: string): Promise<{
    total: number;
    pending: number;
    processing: number;
    sent: number;
    failed: number;
    skipped: number;
  }> {
    try {
      const stats = await this.prisma.campaignMessage.groupBy({
        by: ['status'],
        where: { campaignId },
        _count: { status: true },
      });

      const result = {
        total: 0,
        pending: 0,
        processing: 0,
        sent: 0,
        failed: 0,
        skipped: 0,
      };

      stats.forEach((s) => {
        const count = s._count.status;
        result.total += count;
        switch (s.status) {
          case 'PENDING':
            result.pending = count;
            break;
          case 'PROCESSING':
            result.processing = count;
            break;
          case 'SENT':
            result.sent = count;
            break;
          case 'FAILED':
            result.failed = count;
            break;
          case 'SKIPPED':
            result.skipped = count;
            break;
        }
      });

      return result;
    } catch (error) {
      logger.error('Failed to get message stats', { error, campaignId });
      throw error;
    }
  }

  /**
   * Получение статистики по мессенджерам
   */
  async getStatsByMessenger(campaignId: string): Promise<
    Array<{
      messenger: MessengerType | null;
      total: number;
      sent: number;
      failed: number;
    }>
  > {
    try {
      const stats = await this.prisma.campaignMessage.groupBy({
        by: ['messenger', 'status'],
        where: { campaignId },
        _count: { id: true },
      });

      const byMessenger: Record<string, { total: number; sent: number; failed: number }> = {
        WHATSAPP: { total: 0, sent: 0, failed: 0 },
        TELEGRAM: { total: 0, sent: 0, failed: 0 },
        null: { total: 0, sent: 0, failed: 0 },
      };

      stats.forEach((s) => {
        const key = s.messenger ?? 'null';
        if (!byMessenger[key]) {
          byMessenger[key] = { total: 0, sent: 0, failed: 0 };
        }
        byMessenger[key].total += s._count.id;
        if (s.status === 'SENT') {
          byMessenger[key].sent += s._count.id;
        } else if (s.status === 'FAILED') {
          byMessenger[key].failed += s._count.id;
        }
      });

      return Object.entries(byMessenger)
        .filter(([, data]) => data.total > 0)
        .map(([messenger, data]) => ({
          messenger: messenger === 'null' ? null : (messenger as MessengerType),
          ...data,
        }));
    } catch (error) {
      logger.error('Failed to get stats by messenger', { error, campaignId });
      throw error;
    }
  }

  /**
   * Подсчёт pending сообщений для профиля
   */
  async countPendingForProfile(campaignId: string, profileId: string): Promise<number> {
    try {
      return await this.prisma.campaignMessage.count({
        where: {
          campaignId,
          profileId,
          status: 'PENDING',
        },
      });
    } catch (error) {
      logger.error('Failed to count pending for profile', { error, campaignId, profileId });
      throw error;
    }
  }

  /**
   * Удаление всех сообщений кампании
   */
  async deleteByCampaignId(campaignId: string): Promise<number> {
    try {
      const result = await this.prisma.campaignMessage.deleteMany({
        where: { campaignId },
      });

      logger.info('Campaign messages deleted', { campaignId, count: result.count });
      return result.count;
    } catch (error) {
      logger.error('Failed to delete campaign messages', { error, campaignId });
      throw error;
    }
  }
}

// ============================================
// Campaign Log Repository
// ============================================

export class CampaignLogRepository {
  constructor(private prisma: PrismaClient) {}

  /**
   * Создание записи лога
   */
  async create(data: CreateCampaignLogData): Promise<CampaignLog> {
    try {
      const log = await this.prisma.campaignLog.create({
        data: {
          campaignId: data.campaignId,
          level: data.level,
          action: data.action,
          message: data.message,
          metadata: data.metadata ?? null,
        },
      });

      return log;
    } catch (error) {
      logger.error('Failed to create campaign log', { error, data });
      throw error;
    }
  }

  /**
   * Получение логов кампании с пагинацией
   */
  async findByCampaignId(campaignId: string, query: ListLogsQuery) {
    try {
      const { page, limit, level, action } = query;
      const skip = (page - 1) * limit;

      const where: Prisma.CampaignLogWhereInput = {
        campaignId,
        ...(level && {
          level: Array.isArray(level) ? { in: level } : level,
        }),
        ...(action && { action }),
      };

      const [logs, total] = await Promise.all([
        this.prisma.campaignLog.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.campaignLog.count({ where }),
      ]);

      const totalPages = Math.ceil(total / limit);

      return {
        data: logs,
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
        },
      };
    } catch (error) {
      logger.error('Failed to find campaign logs', { error, campaignId, query });
      throw error;
    }
  }

  /**
   * Получение последних N логов
   */
  async getLatest(campaignId: string, limit: number = 10): Promise<CampaignLog[]> {
    try {
      return await this.prisma.campaignLog.findMany({
        where: { campaignId },
        take: limit,
        orderBy: { createdAt: 'desc' },
      });
    } catch (error) {
      logger.error('Failed to get latest logs', { error, campaignId, limit });
      throw error;
    }
  }

  /**
   * Удаление логов кампании
   */
  async deleteByCampaignId(campaignId: string): Promise<number> {
    try {
      const result = await this.prisma.campaignLog.deleteMany({
        where: { campaignId },
      });

      logger.info('Campaign logs deleted', { campaignId, count: result.count });
      return result.count;
    } catch (error) {
      logger.error('Failed to delete campaign logs', { error, campaignId });
      throw error;
    }
  }

  /**
   * Подсчёт ошибок в логах
   */
  async countErrors(campaignId: string): Promise<number> {
    try {
      return await this.prisma.campaignLog.count({
        where: {
          campaignId,
          level: 'ERROR',
        },
      });
    } catch (error) {
      logger.error('Failed to count log errors', { error, campaignId });
      throw error;
    }
  }
}

