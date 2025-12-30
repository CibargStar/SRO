/**
 * Repository для работы с профилями Chrome в базе данных
 * 
 * Инкапсулирует все операции с БД для модуля profiles.
 * Использует Prisma для типобезопасной работы с данными.
 * 
 * @module modules/profiles/profiles.repository
 */

import { PrismaClient, ProfileStatus } from '@prisma/client';
import { CreateProfileInput, UpdateProfileInput, ListProfilesQuery } from './profiles.schemas';
import logger from '../../config/logger';

/**
 * Репозиторий для работы с профилями
 */
export class ProfilesRepository {
  constructor(private prisma: PrismaClient) {}

  /**
   * Создание нового профиля
   * 
   * @param userId - ID пользователя-владельца
   * @param data - Данные профиля
   * @param profilePath - Путь к директории профиля
   * @returns Созданный профиль
   */
  async create(userId: string, data: CreateProfileInput, profilePath: string) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      const profile = await this.prisma.profile.create({
        data: {
          userId,
          name: data.name,
          description: data.description ?? null,
          profilePath,
          status: 'STOPPED', // По умолчанию профиль остановлен
          headless: data.headless ?? true, // По умолчанию headless режим
        },
        select: {
          id: true,
          userId: true,
          name: true,
          description: true,
          profilePath: true,
          status: true,
          headless: true,
          createdAt: true,
          updatedAt: true,
          lastActiveAt: true,
        },
      });

      logger.info('Profile created', { profileId: profile.id, userId });
      return profile;
    } catch (error) {
      logger.error('Failed to create profile', { error, userId, data });
      throw error;
    }
  }

  /**
   * Создание нового профиля с указанным ID
   * 
   * Используется для согласованности ID профиля и имени директории.
   * 
   * @param userId - ID пользователя-владельца
   * @param data - Данные профиля
   * @param profilePath - Путь к директории профиля
   * @param profileId - ID профиля (UUID)
   * @returns Созданный профиль
   */
  async createWithId(userId: string, data: CreateProfileInput, profilePath: string, profileId: string) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      const profile = await this.prisma.profile.create({
        data: {
          id: profileId, // Используем указанный ID
          userId,
          name: data.name,
          description: data.description ?? null,
          profilePath,
          status: 'STOPPED', // По умолчанию профиль остановлен
          headless: data.headless ?? true, // По умолчанию headless режим
        },
        select: {
          id: true,
          userId: true,
          name: true,
          description: true,
          profilePath: true,
          status: true,
          headless: true,
          createdAt: true,
          updatedAt: true,
          lastActiveAt: true,
        },
      });

      logger.info('Profile created with specified ID', { profileId: profile.id, userId });
      return profile;
    } catch (error) {
      logger.error('Failed to create profile with ID', { error, userId, data, profileId });
      throw error;
    }
  }

  /**
   * Получение профиля по ID
   * 
   * @param profileId - ID профиля
   * @returns Профиль или null
   */
  async findById(profileId: string) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      const profile = await this.prisma.profile.findUnique({
        where: { id: profileId },
        select: {
          id: true,
          userId: true,
          name: true,
          description: true,
          profilePath: true,
          status: true,
          headless: true,
          createdAt: true,
          updatedAt: true,
          lastActiveAt: true,
        },
      });

      return profile;
    } catch (error) {
      logger.error('Failed to find profile by ID', { error, profileId });
      throw error;
    }
  }

  /**
   * Получение списка профилей пользователя
   * 
   * @param userId - ID пользователя
   * @param query - Параметры запроса (пагинация, фильтрация, сортировка)
   * @returns Список профилей с метаданными пагинации
   */
  async findMany(userId: string, query: ListProfilesQuery) {
    try {
      const { page, limit, status, sortBy, sortOrder, isInCampaign } = query;
      const skip = (page - 1) * limit;

      // Построение условий фильтрации
      const where: {
        userId: string;
        status?: ProfileStatus;
        campaignProfiles?: { some?: Record<string, never>; none?: Record<string, never> };
      } = {
        userId,
      };

      if (status) {
        where.status = status;
      }

      // Фильтр по использованию в кампаниях
      if (isInCampaign !== undefined) {
        where.campaignProfiles = isInCampaign ? { some: {} } : { none: {} };
      }

      // Построение сортировки
      const orderBy: Record<string, 'asc' | 'desc'> = {};
      orderBy[sortBy] = sortOrder;

      // Получение профилей и общего количества
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      const [profiles, total] = await Promise.all([
        this.prisma.profile.findMany({
          where,
          skip,
          take: limit,
          orderBy,
          select: {
            id: true,
            userId: true,
            name: true,
            description: true,
            profilePath: true,
            status: true,
            headless: true, // ВАЖНО: включаем headless в список профилей
            createdAt: true,
            updatedAt: true,
            lastActiveAt: true,
            _count: {
              select: {
                campaignProfiles: true,
              },
            },
          },
        }),
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        this.prisma.profile.count({ where }),
      ]);

      const totalPages = Math.ceil(total / limit);

      const data = profiles.map((p) => ({
        ...p,
        campaignUsageCount: p._count?.campaignProfiles ?? 0,
        isInCampaign: (p._count?.campaignProfiles ?? 0) > 0,
        // remove _count from response
        _count: undefined,
      }));

      return {
        data,
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
      logger.error('Failed to find profiles', { error, userId, query });
      throw error;
    }
  }

  /**
   * Обновление профиля
   * 
   * @param profileId - ID профиля
   * @param data - Данные для обновления
   * @returns Обновленный профиль
   */
  async update(profileId: string, data: UpdateProfileInput) {
    try {
      // Построение объекта данных для обновления (только переданные поля)
      const updateData: {
        name?: string;
        description?: string | null;
        headless?: boolean;
      } = {};

      if (data.name !== undefined) {
        updateData.name = data.name;
      }

      if (data.description !== undefined) {
        // Если description явно передан (включая null), обновляем его
        updateData.description = data.description;
      }

      if (data.headless !== undefined) {
        updateData.headless = data.headless;
        logger.info('Updating headless value', { profileId, headless: data.headless });
      } else {
        logger.info('headless not provided in update data', { profileId, data });
      }

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      const profile = await this.prisma.profile.update({
        where: { id: profileId },
        data: updateData,
        select: {
          id: true,
          userId: true,
          name: true,
          description: true,
          profilePath: true,
          status: true,
          headless: true,
          createdAt: true,
          updatedAt: true,
          lastActiveAt: true,
        },
      });

      logger.info('Profile updated', { profileId });
      return profile;
    } catch (error) {
      logger.error('Failed to update profile', { error, profileId, data });
      throw error;
    }
  }

  /**
   * Обновление статуса профиля
   * 
   * @param profileId - ID профиля
   * @param status - Новый статус
   * @returns Обновленный профиль
   */
  async updateStatus(profileId: string, status: ProfileStatus) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      const profile = await this.prisma.profile.update({
        where: { id: profileId },
        data: { status },
        select: {
          id: true,
          userId: true,
          name: true,
          description: true,
          profilePath: true,
          status: true,
          headless: true,
          createdAt: true,
          updatedAt: true,
          lastActiveAt: true,
        },
      });

      logger.debug('Profile status updated', { profileId, status });
      return profile;
    } catch (error) {
      logger.error('Failed to update profile status', { error, profileId, status });
      throw error;
    }
  }

  /**
   * Обновление времени последней активности профиля
   * 
   * @param profileId - ID профиля
   * @returns Обновленный профиль
   */
  async updateLastActiveAt(profileId: string) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      const profile = await this.prisma.profile.update({
        where: { id: profileId },
        data: { lastActiveAt: new Date() },
        select: {
          id: true,
          userId: true,
          name: true,
          description: true,
          profilePath: true,
          status: true,
          headless: true,
          createdAt: true,
          updatedAt: true,
          lastActiveAt: true,
        },
      });

      return profile;
    } catch (error) {
      logger.error('Failed to update profile lastActiveAt', { error, profileId });
      throw error;
    }
  }

  /**
   * Удаление профиля
   * 
   * @param profileId - ID профиля
   */
  async delete(profileId: string) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      await this.prisma.profile.delete({
        where: { id: profileId },
      });

      logger.info('Profile deleted', { profileId });
    } catch (error) {
      logger.error('Failed to delete profile', { error, profileId });
      throw error;
    }
  }

  /**
   * Проверка существования профиля
   * 
   * @param profileId - ID профиля
   * @returns true если профиль существует, false иначе
   */
  async exists(profileId: string): Promise<boolean> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      const count = await this.prisma.profile.count({
        where: { id: profileId },
      });

      return count > 0;
    } catch (error) {
      logger.error('Failed to check profile existence', { error, profileId });
      throw error;
    }
  }

  /**
   * Подсчет количества профилей пользователя
   * 
   * @param userId - ID пользователя
   * @returns Количество профилей
   */
  async countByUserId(userId: string): Promise<number> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      const count = await this.prisma.profile.count({
        where: { userId },
      });

      return count;
    } catch (error) {
      logger.error('Failed to count profiles by userId', { error, userId });
      throw error;
    }
  }

  /**
   * Получение всех профилей со статусом RUNNING
   * 
   * Используется для восстановления профилей при старте сервиса
   * 
   * @returns Список профилей со статусом RUNNING
   */
  async findRunningProfiles() {
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      const profiles = await this.prisma.profile.findMany({
        where: {
          status: 'RUNNING',
        },
        select: {
          id: true,
          userId: true,
          name: true,
          description: true,
          profilePath: true,
          status: true,
          headless: true,
          createdAt: true,
          updatedAt: true,
          lastActiveAt: true,
        },
      });

      return profiles;
    } catch (error) {
      logger.error('Failed to find running profiles', { error });
      throw error;
    }
  }
}

