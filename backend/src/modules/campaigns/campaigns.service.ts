/**
 * Сервис для управления кампаниями рассылки
 * 
 * Содержит основную бизнес-логику модуля кампаний:
 * - CRUD операции над кампаниями
 * - Валидация и подготовка к запуску
 * - Расчёт контактов
 * - Проверка лимитов
 * 
 * @module modules/campaigns/campaigns.service
 */

import { PrismaClient, Campaign, CampaignProfile } from '@prisma/client';
import {
  CampaignRepository,
  CampaignProfileRepository,
  CampaignMessageRepository,
  CampaignLogRepository,
  CreateCampaignData,
  UpdateCampaignData,
  ListCampaignsQuery,
} from './campaigns.repository';
import { LoadBalancerService } from './load-balancer';
import {
  CreateCampaignInput,
  UpdateCampaignInput,
  DuplicateCampaignInput,
  FilterConfig,
} from './campaigns.schemas';
import logger from '../../config/logger';
import { HttpError } from '../../utils/http-error';

// ============================================
// Типы
// ============================================

export interface CampaignValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  contactsCount: number;
  profilesValid: boolean;
  templateValid: boolean;
  groupValid: boolean;
}

export interface CalculatedContacts {
  clientIds: string[];
  totalCount: number;
  byMessenger: {
    whatsapp: number;
    telegram: number;
  };
}

export interface ProfileValidation {
  profileId: string;
  profileName: string;
  isValid: boolean;
  isAvailable: boolean;
  hasWhatsApp: boolean;
  hasTelegram: boolean;
  error?: string;
}

// ============================================
// CampaignsService
// ============================================

export class CampaignsService {
  private campaignRepo: CampaignRepository;
  private profileRepo: CampaignProfileRepository;
  private messageRepo: CampaignMessageRepository;
  private logRepo: CampaignLogRepository;
  private loadBalancer: LoadBalancerService;

  constructor(private prisma: PrismaClient) {
    this.campaignRepo = new CampaignRepository(prisma);
    this.profileRepo = new CampaignProfileRepository(prisma);
    this.messageRepo = new CampaignMessageRepository(prisma);
    this.logRepo = new CampaignLogRepository(prisma);
    this.loadBalancer = new LoadBalancerService(prisma);
  }

  /**
   * Маппинг Campaign из Prisma в формат API (парсинг JSON конфигураций)
   */
  private mapCampaignToApi(campaign: any): any {
    return {
      ...campaign,
      scheduleConfig: campaign.scheduleConfig ? JSON.parse(campaign.scheduleConfig) : null,
      filterConfig: campaign.filterConfig ? JSON.parse(campaign.filterConfig) : null,
      optionsConfig: campaign.optionsConfig ? JSON.parse(campaign.optionsConfig) : null,
    };
  }

  // ============================================
  // CRUD Operations
  // ============================================

  /**
   * Создание новой кампании
   */
  async createCampaign(userId: string, input: CreateCampaignInput): Promise<Campaign> {
    logger.info('Creating campaign', { userId, name: input.name });

    // Проверка лимитов
    await this.checkUserLimits(userId);

    // Проверка существования шаблона
    const template = await this.prisma.template.findFirst({
      where: { id: input.templateId, userId },
    });

    if (!template) {
      throw new HttpError('Шаблон не найден или не принадлежит пользователю', 404, 'TEMPLATE_NOT_FOUND');
    }

    if (!template.isActive) {
      throw new HttpError('Шаблон неактивен', 400, 'TEMPLATE_INACTIVE');
    }

    // Проверка существования группы клиентов
    const clientGroup = await this.prisma.clientGroup.findFirst({
      where: { id: input.clientGroupId, userId },
    });

    if (!clientGroup) {
      throw new HttpError('Группа клиентов не найдена или не принадлежит пользователю', 404, 'CLIENT_GROUP_NOT_FOUND');
    }

    // Проверка профилей
    const profiles = await this.prisma.profile.findMany({
      where: {
        id: { in: input.profileIds },
        userId,
      },
    });

    if (profiles.length !== input.profileIds.length) {
      throw new HttpError('Один или несколько профилей не найдены или не принадлежат пользователю', 404, 'PROFILE_NOT_FOUND');
    }

    // Проверка доступности профилей
    for (const profile of profiles) {
      const isAvailable = await this.profileRepo.isProfileAvailable(profile.id);
      if (!isAvailable) {
        throw new HttpError(`Профиль "${profile.name}" уже используется в другой активной кампании`, 409, 'PROFILE_BUSY');
      }
    }

    // Создание кампании
    const campaignData: CreateCampaignData = {
      userId,
      name: input.name,
      description: input.description,
      templateId: input.templateId,
      clientGroupId: input.clientGroupId,
      campaignType: input.campaignType,
      messengerType: input.messengerType,
      universalTarget: input.universalTarget,
      scheduleConfig: input.scheduleConfig ? JSON.stringify(input.scheduleConfig) : null,
      filterConfig: input.filterConfig ? JSON.stringify(input.filterConfig) : null,
      optionsConfig: input.optionsConfig ? JSON.stringify(input.optionsConfig) : null,
      scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null,
    };

    const campaign = await this.campaignRepo.create(campaignData);

    // Создание связей с профилями
    await this.profileRepo.createMany(
      input.profileIds.map((profileId) => ({
        campaignId: campaign.id,
        profileId,
      }))
    );

    // Логирование
    await this.logRepo.create({
      campaignId: campaign.id,
      level: 'INFO',
      action: 'created',
      message: `Кампания "${input.name}" создана`,
      metadata: JSON.stringify({ profileCount: input.profileIds.length }),
    });

    logger.info('Campaign created successfully', { campaignId: campaign.id, userId });

    // Получаем полные данные с relations для парсинга конфигов
    const campaignWithRelations = await this.campaignRepo.findByIdWithRelations(campaign.id);
    if (!campaignWithRelations) {
      throw new HttpError('Не удалось получить созданную кампанию', 500, 'CAMPAIGN_FETCH_ERROR');
    }

    return this.mapCampaignToApi(campaignWithRelations);
  }

  /**
   * Обновление кампании (только для DRAFT)
   */
  async updateCampaign(userId: string, campaignId: string, input: UpdateCampaignInput): Promise<Campaign> {
    logger.info('Updating campaign', { campaignId, userId });

    const campaign = await this.campaignRepo.findById(campaignId);

    if (!campaign) {
      throw new HttpError('Кампания не найдена', 404, 'CAMPAIGN_NOT_FOUND');
    }

    if (campaign.userId !== userId) {
      throw new HttpError('Нет доступа к этой кампании', 403, 'CAMPAIGN_FORBIDDEN');
    }

    if (campaign.status !== 'DRAFT') {
      throw new HttpError('Редактирование возможно только для кампаний в статусе DRAFT', 409, 'CAMPAIGN_NOT_DRAFT');
    }

    // Проверка шаблона если меняется
    if (input.templateId) {
      const template = await this.prisma.template.findFirst({
        where: { id: input.templateId, userId },
      });

      if (!template) {
        throw new HttpError('Шаблон не найден или не принадлежит пользователю', 404, 'TEMPLATE_NOT_FOUND');
      }
    }

    // Проверка группы если меняется
    if (input.clientGroupId) {
      const clientGroup = await this.prisma.clientGroup.findFirst({
        where: { id: input.clientGroupId, userId },
      });

      if (!clientGroup) {
        throw new HttpError('Группа клиентов не найдена или не принадлежит пользователю', 404, 'CLIENT_GROUP_NOT_FOUND');
      }
    }

    const updateData: UpdateCampaignData = {
      ...(input.name !== undefined && { name: input.name }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.templateId !== undefined && { templateId: input.templateId }),
      ...(input.clientGroupId !== undefined && { clientGroupId: input.clientGroupId }),
      ...(input.messengerType !== undefined && { messengerType: input.messengerType }),
      ...(input.universalTarget !== undefined && { universalTarget: input.universalTarget }),
      ...(input.scheduleConfig !== undefined && {
        scheduleConfig: JSON.stringify(input.scheduleConfig),
      }),
      ...(input.filterConfig !== undefined && {
        filterConfig: JSON.stringify(input.filterConfig),
      }),
      ...(input.optionsConfig !== undefined && {
        optionsConfig: JSON.stringify(input.optionsConfig),
      }),
      ...(input.scheduledAt !== undefined && {
        scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null,
      }),
    };

    await this.campaignRepo.update(campaignId, updateData);

    // Логирование
    await this.logRepo.create({
      campaignId,
      level: 'INFO',
      action: 'updated',
      message: 'Кампания обновлена',
      metadata: JSON.stringify(Object.keys(input)),
    });

    logger.info('Campaign updated successfully', { campaignId });

    // Получаем обновлённую кампанию с relations для парсинга конфигов
    const campaignWithRelations = await this.campaignRepo.findByIdWithRelations(campaignId);
    if (!campaignWithRelations) {
      throw new HttpError('Не удалось получить обновлённую кампанию', 500, 'CAMPAIGN_FETCH_ERROR');
    }

    return this.mapCampaignToApi(campaignWithRelations);
  }

  /**
   * Получение кампании по ID
   */
  async getCampaign(userId: string, campaignId: string, isRoot: boolean = false) {
    const campaign = await this.campaignRepo.findByIdWithRelations(campaignId);

    if (!campaign) {
      throw new HttpError('Кампания не найдена', 404, 'CAMPAIGN_NOT_FOUND');
    }

    if (campaign.userId !== userId && !isRoot) {
      throw new HttpError('Нет доступа к этой кампании', 403, 'CAMPAIGN_FORBIDDEN');
    }

    // Парсим JSON конфиги
    return {
      ...campaign,
      scheduleConfig: campaign.scheduleConfig ? JSON.parse(campaign.scheduleConfig) : null,
      filterConfig: campaign.filterConfig ? JSON.parse(campaign.filterConfig) : null,
      optionsConfig: campaign.optionsConfig ? JSON.parse(campaign.optionsConfig) : null,
    };
  }

  /**
   * Получение списка кампаний пользователя
   */
  async listCampaigns(userId: string, query: ListCampaignsQuery) {
    const result = await this.campaignRepo.findMany(userId, query);

    // Парсим JSON конфиги для каждой кампании
    return {
      ...result,
      data: result.data.map((campaign) => ({
        ...campaign,
        scheduleConfig: campaign.scheduleConfig ? JSON.parse(campaign.scheduleConfig) : null,
        filterConfig: campaign.filterConfig ? JSON.parse(campaign.filterConfig) : null,
        optionsConfig: campaign.optionsConfig ? JSON.parse(campaign.optionsConfig) : null,
      })),
    };
  }

  /**
   * Получение всех кампаний (для ROOT)
   */
  async listAllCampaigns(query: ListCampaignsQuery & { userId?: string }) {
    return this.campaignRepo.findAll(query);
  }

  /**
   * Удаление кампании
   */
  async deleteCampaign(userId: string, campaignId: string): Promise<void> {
    logger.info('Deleting campaign', { campaignId, userId });

    const campaign = await this.campaignRepo.findById(campaignId);

    if (!campaign) {
      throw new HttpError('Кампания не найдена', 404, 'CAMPAIGN_NOT_FOUND');
    }

    if (campaign.userId !== userId) {
      throw new HttpError('Нет доступа к этой кампании', 403, 'CAMPAIGN_FORBIDDEN');
    }

    // Нельзя удалить выполняющуюся кампанию
    if (['RUNNING', 'QUEUED'].includes(campaign.status)) {
      throw new HttpError('Нельзя удалить выполняющуюся кампанию. Сначала отмените её.', 409, 'CAMPAIGN_NOT_DRAFT');
    }

    // Удаление связанных данных каскадом (настроено в Prisma)
    await this.campaignRepo.delete(campaignId);

    logger.info('Campaign deleted successfully', { campaignId });
  }

  /**
   * Дублирование кампании
   */
  async duplicateCampaign(
    userId: string,
    campaignId: string,
    input?: DuplicateCampaignInput
  ): Promise<Campaign> {
    logger.info('Duplicating campaign', { campaignId, userId });

    const sourceCampaign = await this.campaignRepo.findByIdWithRelations(campaignId);

    if (!sourceCampaign) {
      throw new HttpError('Кампания не найдена', 404, 'CAMPAIGN_NOT_FOUND');
    }

    if (sourceCampaign.userId !== userId) {
      throw new HttpError('Нет доступа к этой кампании', 403, 'CAMPAIGN_FORBIDDEN');
    }

    // Проверка лимитов
    await this.checkUserLimits(userId);

    const newName = input?.name || `${sourceCampaign.name} (копия)`;

    // Создание копии
    const newCampaign = await this.campaignRepo.create({
      userId,
      name: newName,
      description: sourceCampaign.description,
      templateId: sourceCampaign.templateId,
      clientGroupId: sourceCampaign.clientGroupId,
      campaignType: sourceCampaign.campaignType,
      messengerType: sourceCampaign.messengerType,
      universalTarget: sourceCampaign.universalTarget,
      scheduleConfig: sourceCampaign.scheduleConfig,
      filterConfig: sourceCampaign.filterConfig,
      optionsConfig: sourceCampaign.optionsConfig,
      scheduledAt: null, // Сбрасываем запланированное время
    });

    // Копирование профилей
    const profileIds = sourceCampaign.profiles.map((p) => p.profileId);
    if (profileIds.length > 0) {
      await this.profileRepo.createMany(
        profileIds.map((profileId) => ({
          campaignId: newCampaign.id,
          profileId,
        }))
      );
    }

    // Логирование
    await this.logRepo.create({
      campaignId: newCampaign.id,
      level: 'INFO',
      action: 'duplicated',
      message: `Кампания создана как копия "${sourceCampaign.name}"`,
      metadata: JSON.stringify({ sourceCampaignId: campaignId }),
    });

    logger.info('Campaign duplicated successfully', {
      sourceCampaignId: campaignId,
      newCampaignId: newCampaign.id,
    });

    // Получаем созданную кампанию с relations для парсинга конфигов
    const campaignWithRelations = await this.campaignRepo.findByIdWithRelations(newCampaign.id);
    if (!campaignWithRelations) {
      throw new HttpError('Не удалось получить созданную кампанию', 500, 'CAMPAIGN_FETCH_ERROR');
    }

    return this.mapCampaignToApi(campaignWithRelations);
  }

  /**
   * Архивирование кампании
   */
  async archiveCampaign(userId: string, campaignId: string): Promise<Campaign> {
    logger.info('Archiving campaign', { campaignId, userId });

    const campaign = await this.campaignRepo.findById(campaignId);

    if (!campaign) {
      throw new HttpError('Кампания не найдена', 404, 'CAMPAIGN_NOT_FOUND');
    }

    if (campaign.userId !== userId) {
      throw new HttpError('Нет доступа к этой кампании', 403, 'CAMPAIGN_FORBIDDEN');
    }

    // Можно архивировать только завершённые кампании
    if (!['COMPLETED', 'CANCELLED', 'ERROR'].includes(campaign.status)) {
      throw new HttpError('Можно архивировать только завершённые кампании', 409, 'CAMPAIGN_NOT_COMPLETED');
    }

    await this.campaignRepo.archive(campaignId);

    // Логирование
    await this.logRepo.create({
      campaignId,
      level: 'INFO',
      action: 'archived',
      message: 'Кампания архивирована',
    });

    logger.info('Campaign archived successfully', { campaignId });

    // Получаем архивированную кампанию с relations для парсинга конфигов
    const campaignWithRelations = await this.campaignRepo.findByIdWithRelations(campaignId);
    if (!campaignWithRelations) {
      throw new HttpError('Не удалось получить архивированную кампанию', 500, 'CAMPAIGN_FETCH_ERROR');
    }

    return this.mapCampaignToApi(campaignWithRelations);
  }

  // ============================================
  // Validation & Calculation
  // ============================================

  /**
   * Полная валидация кампании перед запуском
   */
  async validateCampaign(userId: string, campaignId: string): Promise<CampaignValidationResult> {
    const result: CampaignValidationResult = {
      valid: true,
      errors: [],
      warnings: [],
      contactsCount: 0,
      profilesValid: true,
      templateValid: true,
      groupValid: true,
    };

    const campaign = await this.campaignRepo.findByIdWithRelations(campaignId);

    if (!campaign) {
      result.valid = false;
      result.errors.push('Кампания не найдена');
      return result;
    }

    if (campaign.userId !== userId) {
      result.valid = false;
      result.errors.push('Нет доступа к этой кампании');
      return result;
    }

    // Проверка статуса
    if (campaign.status !== 'DRAFT') {
      result.valid = false;
      result.errors.push(`Кампания в статусе ${campaign.status}, запуск невозможен`);
      return result;
    }

    // Проверка шаблона
    const template = await this.prisma.template.findUnique({
      where: { id: campaign.templateId },
      include: { items: true },
    });

    if (!template) {
      result.valid = false;
      result.templateValid = false;
      result.errors.push('Шаблон не найден');
    } else if (!template.isActive) {
      result.valid = false;
      result.templateValid = false;
      result.errors.push('Шаблон неактивен');
    } else if (template.items.length === 0) {
      result.valid = false;
      result.templateValid = false;
      result.errors.push('Шаблон не содержит элементов');
    }

    // Проверка группы клиентов
    const clientGroup = await this.prisma.clientGroup.findUnique({
      where: { id: campaign.clientGroupId },
      include: { _count: { select: { clients: true } } },
    });

    if (!clientGroup) {
      result.valid = false;
      result.groupValid = false;
      result.errors.push('Группа клиентов не найдена');
    } else if (clientGroup._count.clients === 0) {
      result.valid = false;
      result.groupValid = false;
      result.errors.push('Группа клиентов пуста');
    }

    // Проверка профилей
    if (campaign.profiles.length === 0) {
      result.valid = false;
      result.profilesValid = false;
      result.errors.push('Не выбраны профили для выполнения');
    } else {
      for (const cp of campaign.profiles) {
        // Проверка статуса профиля
        if (cp.profile.status !== 'RUNNING') {
          result.warnings.push(`Профиль "${cp.profile.name}" не запущен (статус: ${cp.profile.status})`);
        }

        // Проверка доступности
        const isAvailable = await this.profileRepo.isProfileAvailable(cp.profileId, campaignId);
        if (!isAvailable) {
          result.valid = false;
          result.profilesValid = false;
          result.errors.push(`Профиль "${cp.profile.name}" уже используется в другой активной кампании`);
        }
      }
    }

    // Расчёт контактов
    try {
      const contacts = await this.calculateContacts(campaignId);
      result.contactsCount = contacts.totalCount;

      if (contacts.totalCount === 0) {
        result.valid = false;
        result.errors.push('Нет контактов, соответствующих фильтрам');
      }
    } catch (error) {
      result.valid = false;
      result.errors.push(`Ошибка расчёта контактов: ${(error as Error).message}`);
    }

    return result;
  }

  /**
   * Расчёт контактов для кампании с учётом фильтров
   */
  async calculateContacts(campaignId: string): Promise<CalculatedContacts> {
    const campaign = await this.campaignRepo.findById(campaignId);

    if (!campaign) {
      throw new HttpError('Кампания не найдена', 404, 'CAMPAIGN_NOT_FOUND');
    }

    const filterConfig: FilterConfig | null = campaign.filterConfig
      ? JSON.parse(campaign.filterConfig)
      : null;

    // Базовый запрос клиентов из группы
    const whereClause: any = {
      groupId: campaign.clientGroupId,
      phones: {
        some: {}, // Должен быть хотя бы один телефон
      },
    };

    if (filterConfig?.clientStatuses && filterConfig.clientStatuses.length > 0) {
      whereClause.status = { in: filterConfig.clientStatuses };
    }

    // Применение фильтров
    if (filterConfig) {
      // Фильтр по регионам
      if (filterConfig.regionIds && filterConfig.regionIds.length > 0) {
        whereClause.regionId = { in: filterConfig.regionIds };
      }

      // Фильтр по статусам клиентов
      if (filterConfig.clientStatuses && filterConfig.clientStatuses.length > 0) {
        whereClause.status = { in: filterConfig.clientStatuses };
      }

      // Фильтр по дате последней кампании
      if (filterConfig.neverCampaigned) {
        whereClause.lastCampaignAt = null;
      } else {
        if (filterConfig.lastCampaignBefore) {
          whereClause.lastCampaignAt = {
            ...whereClause.lastCampaignAt,
            lt: new Date(filterConfig.lastCampaignBefore),
          };
        }
        if (filterConfig.lastCampaignAfter) {
          whereClause.lastCampaignAt = {
            ...whereClause.lastCampaignAt,
            gt: new Date(filterConfig.lastCampaignAfter),
          };
        }
      }

      // Фильтр по количеству кампаний
      if (filterConfig.maxCampaignCount !== undefined) {
        whereClause.campaignCount = { lte: filterConfig.maxCampaignCount };
      }
    }

    // Получение клиентов с телефонами
    const clients = await this.prisma.client.findMany({
      where: whereClause,
      select: {
        id: true,
        phones: {
          select: {
            id: true,
            whatsAppStatus: true,
            telegramStatus: true,
          },
        },
      },
      orderBy: filterConfig?.randomOrder ? undefined : { id: 'asc' },
      take: filterConfig?.limitContacts,
    });

    // Подсчёт по мессенджерам
    let whatsappCount = 0;
    let telegramCount = 0;

    for (const client of clients) {
      const hasWhatsApp = client.phones.some(
        (p) => p.whatsAppStatus === 'Valid' || p.whatsAppStatus === 'Unknown'
      );
      const hasTelegram = client.phones.some(
        (p) => p.telegramStatus === 'Valid' || p.telegramStatus === 'Unknown'
      );

      if (campaign.messengerType === 'WHATSAPP_ONLY' && hasWhatsApp) {
        whatsappCount++;
      } else if (campaign.messengerType === 'TELEGRAM_ONLY' && hasTelegram) {
        telegramCount++;
      } else if (campaign.messengerType === 'UNIVERSAL') {
        if (hasWhatsApp) whatsappCount++;
        if (hasTelegram) telegramCount++;
      }
    }

    return {
      clientIds: clients.map((c) => c.id),
      totalCount: clients.length,
      byMessenger: {
        whatsapp: whatsappCount,
        telegram: telegramCount,
      },
    };
  }

  /**
   * Валидация профилей для кампании
   */
  async validateProfiles(
    userId: string,
    profileIds: string[],
    excludeCampaignId?: string
  ): Promise<ProfileValidation[]> {
    const results: ProfileValidation[] = [];

    // Получаем список сервисов мессенджеров
    const messengerServices = await this.prisma.messengerService.findMany({
      where: { enabled: true },
    });
    const whatsAppServiceId = messengerServices.find((s) => s.name === 'WhatsApp')?.id;
    const telegramServiceId = messengerServices.find((s) => s.name === 'Telegram')?.id;

    for (const profileId of profileIds) {
      const profile = await this.prisma.profile.findFirst({
        where: { id: profileId, userId },
        include: {
          messengerAccounts: true,
        },
      });

      if (!profile) {
        results.push({
          profileId,
          profileName: 'Unknown',
          isValid: false,
          isAvailable: false,
          hasWhatsApp: false,
          hasTelegram: false,
          error: 'Профиль не найден или не принадлежит пользователю',
        });
        continue;
      }

      const isAvailable = await this.profileRepo.isProfileAvailable(profileId, excludeCampaignId);
      // Проверяем наличие авторизованных аккаунтов мессенджеров
      const hasWhatsApp = whatsAppServiceId
        ? profile.messengerAccounts.some(
            (a) => a.serviceId === whatsAppServiceId && a.status === 'LOGGED_IN' && a.isEnabled
          )
        : false;
      const hasTelegram = telegramServiceId
        ? profile.messengerAccounts.some(
            (a) => a.serviceId === telegramServiceId && a.status === 'LOGGED_IN' && a.isEnabled
          )
        : false;

      let error: string | undefined;
      if (!isAvailable) {
        error = 'Профиль уже используется в другой активной кампании';
      } else if (profile.status !== 'RUNNING') {
        error = `Профиль не запущен (статус: ${profile.status})`;
      }

      results.push({
        profileId,
        profileName: profile.name,
        isValid: profile.status === 'RUNNING',
        isAvailable,
        hasWhatsApp,
        hasTelegram,
        error,
      });
    }

    return results;
  }

  /**
   * Подготовка кампании к запуску: распределение контактов и постановка в очередь
   */
  async queueCampaign(
    userId: string,
    campaignId: string,
    profileIdsOverride?: string[]
  ): Promise<{ totalContacts: number }> {
    const campaign = await this.campaignRepo.findByIdWithRelations(campaignId);

    if (!campaign) {
      throw new HttpError('Кампания не найдена', 404, 'CAMPAIGN_NOT_FOUND');
    }

    if (campaign.userId !== userId) {
      throw new HttpError('Нет доступа к этой кампании', 403, 'CAMPAIGN_FORBIDDEN');
    }

    if (!['DRAFT', 'SCHEDULED', 'PAUSED', 'QUEUED'].includes(campaign.status)) {
      throw new HttpError(`Кампания в статусе ${campaign.status} не может быть запущена`, 409, 'CAMPAIGN_BAD_STATUS');
    }

    let profileIds =
      profileIdsOverride && profileIdsOverride.length > 0
        ? profileIdsOverride
        : campaign.profiles.map((p) => p.profileId);

    if (profileIds.length === 0) {
      throw new HttpError('Не выбраны профили для выполнения кампании', 400, 'PROFILES_REQUIRED');
    }

    // Если переданы новые профили — заменяем привязки
    if (profileIdsOverride && profileIdsOverride.length > 0) {
      await this.profileRepo.deleteByCampaignId(campaignId);
      await this.profileRepo.createMany(
        profileIdsOverride.map((profileId) => ({
          campaignId,
          profileId,
        }))
      );
    }

    // Проверяем доступность профилей (с исключением текущей кампании)
    for (const profileId of profileIds) {
      const isAvailable = await this.profileRepo.isProfileAvailable(profileId, campaignId);
      if (!isAvailable) {
        throw new HttpError(`Профиль ${profileId} уже используется в другой активной кампании`, 409, 'PROFILE_BUSY');
      }
    }

    const filterConfig = campaign.filterConfig ? JSON.parse(campaign.filterConfig) : undefined;
    const optionsConfig = campaign.optionsConfig ? JSON.parse(campaign.optionsConfig) : undefined;

    // Очищаем старую очередь перед пересозданием
    await this.messageRepo.deleteByCampaignId(campaignId);

    const distribution = await this.loadBalancer.distributeForCampaign(
      campaignId,
      campaign.clientGroupId,
      profileIds,
      campaign.messengerType,
      campaign.universalTarget,
      filterConfig,
      optionsConfig
    );

    if (distribution.totalContacts <= 0) {
      throw new HttpError('Нет контактов, соответствующих условиям кампании', 400, 'NO_CONTACTS_MATCH');
    }

    // Сбрасываем и обновляем прогресс, переводим в QUEUED
    await this.campaignRepo.updateProgress(campaignId, {
      totalContacts: distribution.totalContacts,
      processedContacts: 0,
      successfulContacts: 0,
      failedContacts: 0,
      skippedContacts: 0,
      status: 'QUEUED',
      startedAt: null,
      pausedAt: null,
      completedAt: null,
      archivedAt: null,
    });

    await this.logRepo.create({
      campaignId,
      level: 'INFO',
      action: 'queued',
      message: `Кампания подготовлена к запуску. Контактов: ${distribution.totalContacts}`,
    });

    return { totalContacts: distribution.totalContacts };
  }

  // ============================================
  // Helpers
  // ============================================

  /**
   * Проверка лимитов пользователя
   */
  private async checkUserLimits(userId: string): Promise<void> {
    // Получение лимитов пользователя
    const limits = await this.prisma.userCampaignLimits.findUnique({
      where: { userId },
    });

    if (!limits) {
      // Если лимиты не установлены, используем дефолтные из глобальных настроек
      return;
    }

    // Подсчёт активных кампаний
    const activeCampaignsCount = await this.campaignRepo.countActiveByUserId(userId);

    if (activeCampaignsCount >= limits.maxActiveCampaigns) {
      throw new HttpError(
        `Превышен лимит активных кампаний (${limits.maxActiveCampaigns}). Завершите или отмените существующие кампании.`,
        429,
        'ACTIVE_CAMPAIGNS_LIMIT'
      );
    }
  }

  // ============================================
  // Messages & Logs API
  // ============================================

  /**
   * Получение сообщений кампании
   */
  async getCampaignMessages(userId: string, campaignId: string, query: any) {
    const campaign = await this.campaignRepo.findById(campaignId);

    if (!campaign) {
      throw new HttpError('Кампания не найдена', 404, 'CAMPAIGN_NOT_FOUND');
    }

    if (campaign.userId !== userId) {
      throw new HttpError('Нет доступа к этой кампании', 403, 'CAMPAIGN_FORBIDDEN');
    }

    return this.messageRepo.findByCampaignId(campaignId, query);
  }

  /**
   * Получение логов кампании
   */
  async getCampaignLogs(userId: string, campaignId: string, query: any) {
    const campaign = await this.campaignRepo.findById(campaignId);

    if (!campaign) {
      throw new HttpError('Кампания не найдена', 404, 'CAMPAIGN_NOT_FOUND');
    }

    if (campaign.userId !== userId) {
      throw new HttpError('Нет доступа к этой кампании', 403, 'CAMPAIGN_FORBIDDEN');
    }

    return this.logRepo.findByCampaignId(campaignId, query);
  }

  /**
   * Получение статистики кампании
   */
  async getCampaignStats(userId: string, campaignId: string) {
    const campaign = await this.campaignRepo.findById(campaignId);

    if (!campaign) {
      throw new HttpError('Кампания не найдена', 404, 'CAMPAIGN_NOT_FOUND');
    }

    if (campaign.userId !== userId) {
      throw new HttpError('Нет доступа к этой кампании', 403, 'CAMPAIGN_FORBIDDEN');
    }

    const [messageStats, messengerStats, profiles] = await Promise.all([
      this.messageRepo.getStats(campaignId),
      this.messageRepo.getStatsByMessenger(campaignId),
      this.profileRepo.findByCampaignId(campaignId),
    ]);

    return {
      campaign: {
        id: campaign.id,
        name: campaign.name,
        status: campaign.status,
        totalContacts: campaign.totalContacts,
        processedContacts: campaign.processedContacts,
        successfulContacts: campaign.successfulContacts,
        failedContacts: campaign.failedContacts,
        skippedContacts: campaign.skippedContacts,
        startedAt: campaign.startedAt,
        completedAt: campaign.completedAt,
      },
      messages: messageStats,
      byMessenger: messengerStats,
      profiles: profiles.map((p) => ({
        profileId: p.profileId,
        profileName: p.profile.name,
        status: p.status,
        assignedCount: p.assignedCount,
        processedCount: p.processedCount,
        successCount: p.successCount,
        failedCount: p.failedCount,
      })),
    };
  }

  // ============================================
  // Profile Management
  // ============================================

  /**
   * Обновление профилей кампании
   */
  async updateCampaignProfiles(
    userId: string,
    campaignId: string,
    profileIds: string[]
  ): Promise<CampaignProfile[]> {
    const campaign = await this.campaignRepo.findById(campaignId);

    if (!campaign) {
      throw new HttpError('Кампания не найдена', 404, 'CAMPAIGN_NOT_FOUND');
    }

    if (campaign.userId !== userId) {
      throw new HttpError('Нет доступа к этой кампании', 403, 'CAMPAIGN_FORBIDDEN');
    }

    if (campaign.status !== 'DRAFT') {
      throw new HttpError('Изменение профилей возможно только для кампаний в статусе DRAFT', 409, 'CAMPAIGN_NOT_DRAFT');
    }

    // Проверка профилей
    const profiles = await this.prisma.profile.findMany({
      where: {
        id: { in: profileIds },
        userId,
      },
    });

    if (profiles.length !== profileIds.length) {
      throw new HttpError('Один или несколько профилей не найдены или не принадлежат пользователю', 404, 'PROFILE_NOT_FOUND');
    }

    // Удаление старых связей
    await this.profileRepo.deleteByCampaignId(campaignId);

    // Создание новых связей
    await this.profileRepo.createMany(
      profileIds.map((profileId) => ({
        campaignId,
        profileId,
      }))
    );

    // Логирование
    await this.logRepo.create({
      campaignId,
      level: 'INFO',
      action: 'profiles_updated',
      message: `Профили обновлены (${profileIds.length} профилей)`,
    });

    return this.profileRepo.findByCampaignId(campaignId);
  }
}

// Singleton instance
let campaignsServiceInstance: CampaignsService | null = null;

export function getCampaignsService(prisma: PrismaClient): CampaignsService {
  if (!campaignsServiceInstance) {
    campaignsServiceInstance = new CampaignsService(prisma);
  }
  return campaignsServiceInstance;
}

