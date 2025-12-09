/**
 * Репозиторий для работы с лимитами кампаний пользователей
 * 
 * Предоставляет методы для CRUD операций с UserCampaignLimits.
 */

import { PrismaClient, UserCampaignLimits } from '@prisma/client';

export class UserCampaignLimitsRepository {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Получить лимиты пользователя
   */
  async getLimits(userId: string): Promise<UserCampaignLimits | null> {
    return this.prisma.userCampaignLimits.findUnique({
      where: { userId },
    });
  }

  /**
   * Получить все лимиты (для ROOT)
   */
  async getAllLimits(): Promise<UserCampaignLimits[]> {
    return this.prisma.userCampaignLimits.findMany({
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
          },
        },
      },
      orderBy: {
        user: {
          email: 'asc',
        },
      },
    });
  }

  /**
   * Создать или обновить лимиты пользователя
   */
  async setLimits(
    userId: string,
    data: Partial<Omit<UserCampaignLimits, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>,
    updatedBy: string
  ): Promise<UserCampaignLimits> {
    return this.prisma.userCampaignLimits.upsert({
      where: { userId },
      create: {
        userId,
        ...data,
        updatedBy,
      },
      update: {
        ...data,
        updatedBy,
      },
    });
  }

  /**
   * Получить или создать дефолтные лимиты
   */
  async getOrCreate(userId: string): Promise<UserCampaignLimits> {
    const existing = await this.getLimits(userId);
    if (existing) {
      return existing;
    }

    return this.prisma.userCampaignLimits.create({
      data: {
        userId,
      },
    });
  }

  /**
   * Удалить лимиты пользователя
   */
  async deleteLimits(userId: string): Promise<void> {
    await this.prisma.userCampaignLimits.delete({
      where: { userId },
    });
  }
}


