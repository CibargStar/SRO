/**
 * Repository для работы с лимитами профилей пользователей
 * 
 * Инкапсулирует все операции с БД для модуля limits.
 * Использует Prisma для типобезопасной работы с данными.
 * 
 * @module modules/profiles/limits/limits.repository
 */

import { PrismaClient } from '@prisma/client';
import logger from '../../../config/logger';

/**
 * Данные для создания/обновления лимитов
 */
export interface ProfileLimitsInput {
  maxProfiles?: number;
  maxCpuPerProfile?: number | null;
  maxMemoryPerProfile?: number | null;
  maxNetworkPerProfile?: number | null;
  updatedBy?: string;
}

/**
 * Репозиторий для работы с лимитами профилей
 */
export class ProfileLimitsRepository {
  constructor(private prisma: PrismaClient) {}

  /**
   * Создание лимитов для пользователя
   * 
   * @param userId - ID пользователя
   * @param data - Данные лимитов
   * @returns Созданные лимиты
   */
  async create(userId: string, data: ProfileLimitsInput) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      const limits = await this.prisma.userProfileLimits.create({
        data: {
          userId,
          maxProfiles: data.maxProfiles ?? 10,
          maxCpuPerProfile: data.maxCpuPerProfile ?? null,
          maxMemoryPerProfile: data.maxMemoryPerProfile ?? null,
          maxNetworkPerProfile: data.maxNetworkPerProfile ?? null,
          updatedBy: data.updatedBy ?? null,
        },
        select: {
          id: true,
          userId: true,
          maxProfiles: true,
          maxCpuPerProfile: true,
          maxMemoryPerProfile: true,
          maxNetworkPerProfile: true,
          createdAt: true,
          updatedAt: true,
          updatedBy: true,
        },
      });

      logger.info('Profile limits created', { userId, limitsId: limits.id });
      return limits;
    } catch (error) {
      logger.error('Failed to create profile limits', { error, userId, data });
      throw error;
    }
  }

  /**
   * Получение лимитов пользователя
   * 
   * @param userId - ID пользователя
   * @returns Лимиты или null
   */
  async findByUserId(userId: string) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      const limits = await this.prisma.userProfileLimits.findUnique({
        where: { userId },
        select: {
          id: true,
          userId: true,
          maxProfiles: true,
          maxCpuPerProfile: true,
          maxMemoryPerProfile: true,
          maxNetworkPerProfile: true,
          createdAt: true,
          updatedAt: true,
          updatedBy: true,
        },
      });

      return limits;
    } catch (error) {
      logger.error('Failed to find profile limits by userId', { error, userId });
      throw error;
    }
  }

  /**
   * Обновление лимитов пользователя
   * 
   * @param userId - ID пользователя
   * @param data - Данные для обновления
   * @returns Обновленные лимиты
   */
  async update(userId: string, data: ProfileLimitsInput) {
    try {
      // Построение объекта данных для обновления
      const updateData: {
        maxProfiles?: number;
        maxCpuPerProfile?: number | null;
        maxMemoryPerProfile?: number | null;
        maxNetworkPerProfile?: number | null;
        updatedBy?: string | null;
      } = {};

      if (data.maxProfiles !== undefined) {
        updateData.maxProfiles = data.maxProfiles;
      }

      if (data.maxCpuPerProfile !== undefined) {
        updateData.maxCpuPerProfile = data.maxCpuPerProfile;
      }

      if (data.maxMemoryPerProfile !== undefined) {
        updateData.maxMemoryPerProfile = data.maxMemoryPerProfile;
      }

      if (data.maxNetworkPerProfile !== undefined) {
        updateData.maxNetworkPerProfile = data.maxNetworkPerProfile;
      }

      if (data.updatedBy !== undefined) {
        updateData.updatedBy = data.updatedBy;
      }

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      const limits = await this.prisma.userProfileLimits.update({
        where: { userId },
        data: updateData,
        select: {
          id: true,
          userId: true,
          maxProfiles: true,
          maxCpuPerProfile: true,
          maxMemoryPerProfile: true,
          maxNetworkPerProfile: true,
          createdAt: true,
          updatedAt: true,
          updatedBy: true,
        },
      });

      logger.info('Profile limits updated', { userId, limitsId: limits.id });
      return limits;
    } catch (error) {
      logger.error('Failed to update profile limits', { error, userId, data });
      throw error;
    }
  }

  /**
   * Создание или обновление лимитов (upsert)
   * 
   * @param userId - ID пользователя
   * @param data - Данные лимитов
   * @returns Созданные или обновленные лимиты
   */
  async upsert(userId: string, data: ProfileLimitsInput) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      const limits = await this.prisma.userProfileLimits.upsert({
        where: { userId },
        update: {
          maxProfiles: data.maxProfiles,
          maxCpuPerProfile: data.maxCpuPerProfile ?? null,
          maxMemoryPerProfile: data.maxMemoryPerProfile ?? null,
          maxNetworkPerProfile: data.maxNetworkPerProfile ?? null,
          updatedBy: data.updatedBy ?? null,
        },
        create: {
          userId,
          maxProfiles: data.maxProfiles ?? 10,
          maxCpuPerProfile: data.maxCpuPerProfile ?? null,
          maxMemoryPerProfile: data.maxMemoryPerProfile ?? null,
          maxNetworkPerProfile: data.maxNetworkPerProfile ?? null,
          updatedBy: data.updatedBy ?? null,
        },
        select: {
          id: true,
          userId: true,
          maxProfiles: true,
          maxCpuPerProfile: true,
          maxMemoryPerProfile: true,
          maxNetworkPerProfile: true,
          createdAt: true,
          updatedAt: true,
          updatedBy: true,
        },
      });

      logger.info('Profile limits upserted', { userId, limitsId: limits.id });
      return limits;
    } catch (error) {
      logger.error('Failed to upsert profile limits', { error, userId, data });
      throw error;
    }
  }

  /**
   * Удаление лимитов пользователя
   * 
   * @param userId - ID пользователя
   */
  async delete(userId: string) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      await this.prisma.userProfileLimits.delete({
        where: { userId },
      });

      logger.info('Profile limits deleted', { userId });
    } catch (error) {
      logger.error('Failed to delete profile limits', { error, userId });
      throw error;
    }
  }

  /**
   * Получение всех лимитов (для ROOT)
   * 
   * @returns Список всех лимитов
   */
  async findAll() {
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      const limits = await this.prisma.userProfileLimits.findMany({
        select: {
          id: true,
          userId: true,
          maxProfiles: true,
          maxCpuPerProfile: true,
          maxMemoryPerProfile: true,
          maxNetworkPerProfile: true,
          createdAt: true,
          updatedAt: true,
          updatedBy: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      return limits;
    } catch (error) {
      logger.error('Failed to find all profile limits', { error });
      throw error;
    }
  }
}









