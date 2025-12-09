/**
 * Сервис управления лимитами кампаний пользователей
 * 
 * Предоставляет бизнес-логику для работы с лимитами пользователей.
 * Лимиты могут устанавливаться только ROOT пользователем.
 */

import { UserCampaignLimits } from '@prisma/client';
import { UserCampaignLimitsRepository } from './user-campaign-limits.repository';
import prisma from '../../config/database';

export interface SetUserLimitsInput {
  maxActiveCampaigns?: number;
  maxTemplates?: number;
  maxTemplateCategories?: number;
  maxFileSizeMb?: number;
  maxTotalStorageMb?: number;
  allowScheduledCampaigns?: boolean;
  allowUniversalCampaigns?: boolean;
}

export interface UserLimitsWithUser extends UserCampaignLimits {
  user: {
    id: string;
    email: string;
    name: string | null;
    role: string;
  };
}

export class UserCampaignLimitsService {
  private readonly repository: UserCampaignLimitsRepository;

  constructor() {
    this.repository = new UserCampaignLimitsRepository(prisma);
  }

  /**
   * Получить лимиты пользователя
   * Если лимитов нет, возвращает дефолтные
   */
  async getLimits(userId: string): Promise<UserCampaignLimits> {
    return this.repository.getOrCreate(userId);
  }

  /**
   * Получить все лимиты (для ROOT)
   */
  async getAllLimits(): Promise<UserLimitsWithUser[]> {
    return this.repository.getAllLimits() as Promise<UserLimitsWithUser[]>;
  }

  /**
   * Установить лимиты пользователя
   * 
   * @param userId - ID пользователя
   * @param input - Данные для обновления
   * @param updatedBy - ID ROOT пользователя, выполняющего обновление
   */
  async setLimits(
    userId: string,
    input: SetUserLimitsInput,
    updatedBy: string
  ): Promise<UserCampaignLimits> {
    // Валидация
    const updateData: Partial<UserCampaignLimits> = {};

    if (input.maxActiveCampaigns !== undefined) {
      if (input.maxActiveCampaigns < 0) {
        throw new Error('maxActiveCampaigns must be non-negative');
      }
      updateData.maxActiveCampaigns = input.maxActiveCampaigns;
    }

    if (input.maxTemplates !== undefined) {
      if (input.maxTemplates < 0) {
        throw new Error('maxTemplates must be non-negative');
      }
      updateData.maxTemplates = input.maxTemplates;
    }

    if (input.maxTemplateCategories !== undefined) {
      if (input.maxTemplateCategories < 0) {
        throw new Error('maxTemplateCategories must be non-negative');
      }
      updateData.maxTemplateCategories = input.maxTemplateCategories;
    }

    if (input.maxFileSizeMb !== undefined) {
      if (input.maxFileSizeMb < 1) {
        throw new Error('maxFileSizeMb must be at least 1');
      }
      updateData.maxFileSizeMb = input.maxFileSizeMb;
    }

    if (input.maxTotalStorageMb !== undefined) {
      if (input.maxTotalStorageMb < 1) {
        throw new Error('maxTotalStorageMb must be at least 1');
      }
      updateData.maxTotalStorageMb = input.maxTotalStorageMb;
    }

    if (input.allowScheduledCampaigns !== undefined) {
      updateData.allowScheduledCampaigns = input.allowScheduledCampaigns;
    }

    if (input.allowUniversalCampaigns !== undefined) {
      updateData.allowUniversalCampaigns = input.allowUniversalCampaigns;
    }

    return this.repository.setLimits(userId, updateData, updatedBy);
  }

  /**
   * Проверить лимит активных кампаний
   * 
   * @param userId - ID пользователя
   * @returns true, если лимит не превышен
   */
  async checkActiveCampaignsLimit(userId: string): Promise<boolean> {
    const limits = await this.getLimits(userId);
    
    // Подсчитываем активные кампании
    const activeCount = await prisma.campaign.count({
      where: {
        userId,
        status: {
          in: ['RUNNING', 'PAUSED', 'QUEUED'],
        },
      },
    });

    return activeCount < limits.maxActiveCampaigns;
  }

  /**
   * Проверить лимит шаблонов
   * 
   * @param userId - ID пользователя
   * @returns true, если лимит не превышен
   */
  async checkTemplatesLimit(userId: string): Promise<boolean> {
    const limits = await this.getLimits(userId);
    
    const templatesCount = await prisma.template.count({
      where: { userId },
    });

    return templatesCount < limits.maxTemplates;
  }

  /**
   * Проверить лимит категорий шаблонов
   * 
   * @param userId - ID пользователя
   * @returns true, если лимит не превышен
   */
  async checkTemplateCategoriesLimit(userId: string): Promise<boolean> {
    const limits = await this.getLimits(userId);
    
    const categoriesCount = await prisma.templateCategory.count({
      where: { userId },
    });

    return categoriesCount < limits.maxTemplateCategories;
  }

  /**
   * Проверить разрешение на scheduled кампании
   */
  async canCreateScheduledCampaign(userId: string): Promise<boolean> {
    const limits = await this.getLimits(userId);
    return limits.allowScheduledCampaigns;
  }

  /**
   * Проверить разрешение на universal кампании
   */
  async canCreateUniversalCampaign(userId: string): Promise<boolean> {
    const limits = await this.getLimits(userId);
    return limits.allowUniversalCampaigns;
  }
}

