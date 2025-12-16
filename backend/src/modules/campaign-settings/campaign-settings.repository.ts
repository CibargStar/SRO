/**
 * Repository для работы с глобальными настройками кампаний
 * 
 * CampaignGlobalSettings - singleton модель, одна запись на всю систему.
 * Управляется только ROOT пользователем.
 */

import { PrismaClient, CampaignGlobalSettings } from '@prisma/client';

export class CampaignSettingsRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Получить глобальные настройки кампаний
   * Возвращает первую (единственную) запись или null
   */
  async getGlobalSettings(): Promise<CampaignGlobalSettings | null> {
    return this.prisma.campaignGlobalSettings.findFirst();
  }

  /**
   * Создать глобальные настройки с дефолтными значениями
   * Вызывается только при инициализации системы
   */
  async createGlobalSettings(
    updatedBy?: string
  ): Promise<CampaignGlobalSettings> {
    return this.prisma.campaignGlobalSettings.create({
      data: {
        updatedBy,
      },
    });
  }

  /**
   * Обновить глобальные настройки кампаний
   */
  async updateGlobalSettings(
    id: string,
    data: Partial<Omit<CampaignGlobalSettings, 'id' | 'updatedAt'>>,
    updatedBy: string
  ): Promise<CampaignGlobalSettings> {
    return this.prisma.campaignGlobalSettings.update({
      where: { id },
      data: {
        ...data,
        updatedBy,
      },
    });
  }

  /**
   * Проверить существование настроек
   */
  async exists(): Promise<boolean> {
    const count = await this.prisma.campaignGlobalSettings.count();
    return count > 0;
  }

  /**
   * Получить настройки или создать дефолтные
   */
  async getOrCreate(updatedBy?: string): Promise<CampaignGlobalSettings> {
    const existing = await this.getGlobalSettings();
    if (existing) {
      return existing;
    }
    return this.createGlobalSettings(updatedBy);
  }
}




