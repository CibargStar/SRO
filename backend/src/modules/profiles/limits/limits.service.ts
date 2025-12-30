/**
 * Сервис управления лимитами профилей
 * 
 * Содержит бизнес-логику для работы с лимитами профилей:
 * - Проверка лимитов при создании профилей
 * - Управление лимитами пользователей (для ROOT)
 * - Получение лимитов пользователя
 * 
 * @module modules/profiles/limits/limits.service
 */

import { ProfileLimitsRepository, ProfileLimitsInput } from './limits.repository';
import { ProfilesRepository } from '../profiles.repository';
import logger from '../../../config/logger';

/**
 * Лимиты профилей по умолчанию
 */
export const DEFAULT_PROFILE_LIMITS = {
  maxProfiles: 10,
  maxCpuPerProfile: null,
  maxMemoryPerProfile: null,
  maxNetworkPerProfile: null,
};

/**
 * Сервис управления лимитами профилей
 */
export class ProfileLimitsService {
  constructor(
    private limitsRepository: ProfileLimitsRepository,
    private profilesRepository: ProfilesRepository
  ) {}

  /**
   * Получение лимитов пользователя
   * 
   * Если лимиты не установлены, возвращает значения по умолчанию.
   * 
   * @param userId - ID пользователя
   * @returns Лимиты пользователя
   */
  async getUserLimits(userId: string) {
    try {
      const limits = await this.limitsRepository.findByUserId(userId);

      if (!limits) {
        // Возвращаем лимиты по умолчанию
        return {
          userId,
          maxProfiles: DEFAULT_PROFILE_LIMITS.maxProfiles,
          maxCpuPerProfile: DEFAULT_PROFILE_LIMITS.maxCpuPerProfile,
          maxMemoryPerProfile: DEFAULT_PROFILE_LIMITS.maxMemoryPerProfile,
          maxNetworkPerProfile: DEFAULT_PROFILE_LIMITS.maxNetworkPerProfile,
        };
      }

      return limits;
    } catch (error) {
      logger.error('Failed to get user limits', { error, userId });
      throw error;
    }
  }

  /**
   * Проверка возможности создания профиля
   * 
   * Проверяет, не превышен ли лимит количества профилей.
   * 
   * @param userId - ID пользователя
   * @returns true если можно создать профиль, false иначе
   * @throws Error если лимит превышен
   */
  async canCreateProfile(userId: string): Promise<boolean> {
    try {
      // Получение лимитов пользователя
      const limits = await this.getUserLimits(userId);

      // Подсчет текущего количества профилей
      const currentCount = await this.profilesRepository.countByUserId(userId);

      // Проверка лимита
      if (currentCount >= limits.maxProfiles) {
        logger.warn('Profile limit exceeded', {
          userId,
          currentCount,
          maxProfiles: limits.maxProfiles,
        });
        throw new Error(
          `Profile limit exceeded. Maximum ${limits.maxProfiles} profiles allowed. Current: ${currentCount}`
        );
      }

      return true;
    } catch (error) {
      if (error instanceof Error && error.message.includes('Profile limit exceeded')) {
        throw error;
      }
      logger.error('Failed to check profile creation limit', { error, userId });
      throw error;
    }
  }

  /**
   * Установка лимитов для пользователя (для ROOT)
   * 
   * @param userId - ID пользователя
   * @param data - Данные лимитов
   * @param updatedBy - ID пользователя, который обновляет лимиты (обычно ROOT)
   * @returns Установленные лимиты
   */
  async setUserLimits(userId: string, data: ProfileLimitsInput, updatedBy: string) {
    try {
      // Валидация данных
      if (data.maxProfiles !== undefined && data.maxProfiles < 0) {
        throw new Error('maxProfiles must be non-negative');
      }

      if (data.maxCpuPerProfile !== undefined && data.maxCpuPerProfile !== null) {
        if (data.maxCpuPerProfile < 0 || data.maxCpuPerProfile > 1) {
          throw new Error('maxCpuPerProfile must be between 0 and 1');
        }
      }

      if (data.maxMemoryPerProfile !== undefined && data.maxMemoryPerProfile !== null) {
        if (data.maxMemoryPerProfile < 0) {
          throw new Error('maxMemoryPerProfile must be non-negative');
        }
      }

      if (data.maxNetworkPerProfile !== undefined && data.maxNetworkPerProfile !== null) {
        if (data.maxNetworkPerProfile < 0) {
          throw new Error('maxNetworkPerProfile must be non-negative');
        }
      }

      // Проверка текущего количества профилей
      const currentCount = await this.profilesRepository.countByUserId(userId);
      if (data.maxProfiles !== undefined && currentCount > data.maxProfiles) {
        throw new Error(
          `Cannot set maxProfiles to ${data.maxProfiles}. User already has ${currentCount} profiles`
        );
      }

      // Создание или обновление лимитов
      const limits = await this.limitsRepository.upsert(userId, {
        ...data,
        updatedBy,
      });

      logger.info('User profile limits set', { userId, limitsId: limits.id, updatedBy });

      return limits;
    } catch (error) {
      logger.error('Failed to set user limits', { error, userId, data, updatedBy });
      throw error;
    }
  }

  /**
   * Получение лимитов пользователя (для ROOT)
   * 
   * @param userId - ID пользователя
   * @returns Лимиты пользователя
   */
  async getUserLimitsForAdmin(userId: string) {
    return this.getUserLimits(userId);
  }

  /**
   * Получение всех лимитов (для ROOT)
   * 
   * @returns Список всех лимитов
   */
  async getAllLimits() {
    try {
      return await this.limitsRepository.findAll();
    } catch (error) {
      logger.error('Failed to get all limits', { error });
      throw error;
    }
  }

  /**
   * Удаление лимитов пользователя (для ROOT)
   * 
   * После удаления будут использоваться лимиты по умолчанию.
   * 
   * @param userId - ID пользователя
   */
  async deleteUserLimits(userId: string) {
    try {
      await this.limitsRepository.delete(userId);
      logger.info('User profile limits deleted', { userId });
    } catch (error) {
      logger.error('Failed to delete user limits', { error, userId });
      throw error;
    }
  }
}









