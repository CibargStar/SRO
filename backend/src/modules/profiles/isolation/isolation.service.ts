/**
 * Сервис изоляции профилей Chrome
 * 
 * Обеспечивает полную изоляцию профилей на уровне файловой системы.
 * Управляет созданием, проверкой и удалением изолированных директорий профилей.
 * 
 * Изоляция включает:
 * - Отдельные директории для каждого профиля
 * - Защиту от path traversal атак
 * - Валидацию путей и ID
 * - Безопасное удаление директорий
 * 
 * @module modules/profiles/isolation/isolation.service
 */

import { ProfileDirectoryManager } from './profile-directory.manager';
import logger from '../../../config/logger';

/**
 * Сервис изоляции профилей
 */
export class IsolationService {
  private directoryManager: ProfileDirectoryManager;

  constructor(basePath: string = './profiles') {
    this.directoryManager = new ProfileDirectoryManager(basePath);
  }

  /**
   * Создание изолированной директории для профиля
   * 
   * Создает структуру:
   * - basePath/userId/profileId/
   * - basePath/userId/profileId/chrome-data/
   * - basePath/userId/profileId/logs/
   * 
   * @param userId - ID пользователя-владельца
   * @param profileId - ID профиля
   * @returns Путь к созданной директории профиля
   * @throws Error если директория не может быть создана
   */
  async createIsolatedProfileDirectory(userId: string, profileId: string): Promise<string> {
    try {
      logger.debug('Creating isolated profile directory', { userId, profileId });

      const profilePath = await this.directoryManager.createProfileDirectory(userId, profileId);

      logger.info('Isolated profile directory created', {
        profilePath,
        userId,
        profileId,
      });

      return profilePath;
    } catch (error) {
      logger.error('Failed to create isolated profile directory', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
        profileId,
      });
      throw error;
    }
  }

  /**
   * Проверка существования изолированной директории профиля
   * 
   * @param userId - ID пользователя
   * @param profileId - ID профиля
   * @returns true если директория существует, false иначе
   */
  async profileDirectoryExists(userId: string, profileId: string): Promise<boolean> {
    try {
      return await this.directoryManager.profileDirectoryExists(userId, profileId);
    } catch (error) {
      logger.error('Failed to check profile directory existence', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
        profileId,
      });
      return false;
    }
  }

  /**
   * Удаление изолированной директории профиля
   * 
   * Безопасно удаляет директорию профиля со всем содержимым.
   * 
   * @param userId - ID пользователя
   * @param profileId - ID профиля
   * @throws Error если директория не может быть удалена
   */
  async deleteIsolatedProfileDirectory(userId: string, profileId: string): Promise<void> {
    try {
      logger.debug('Deleting isolated profile directory', { userId, profileId });

      await this.directoryManager.deleteProfileDirectory(userId, profileId);

      logger.info('Isolated profile directory deleted', {
        userId,
        profileId,
      });
    } catch (error) {
      logger.error('Failed to delete isolated profile directory', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
        profileId,
      });
      throw error;
    }
  }

  /**
   * Получение пути к директории профиля
   * 
   * @param userId - ID пользователя
   * @param profileId - ID профиля
   * @returns Путь к директории профиля
   */
  getProfilePath(userId: string, profileId: string): string {
    return this.directoryManager.getProfilePath(userId, profileId);
  }

  /**
   * Получение размера директории профиля
   * 
   * @param userId - ID пользователя
   * @param profileId - ID профиля
   * @returns Размер директории в байтах
   */
  async getProfileDirectorySize(userId: string, profileId: string): Promise<number> {
    try {
      return await this.directoryManager.getProfileDirectorySize(userId, profileId);
    } catch (error) {
      logger.error('Failed to get profile directory size', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
        profileId,
      });
      return 0;
    }
  }

  /**
   * Очистка директории профиля
   * 
   * Удаляет содержимое директории, но оставляет саму директорию.
   * 
   * @param userId - ID пользователя
   * @param profileId - ID профиля
   */
  async clearProfileDirectory(userId: string, profileId: string): Promise<void> {
    try {
      logger.debug('Clearing profile directory', { userId, profileId });

      await this.directoryManager.clearProfileDirectory(userId, profileId);

      logger.info('Profile directory cleared', {
        userId,
        profileId,
      });
    } catch (error) {
      logger.error('Failed to clear profile directory', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
        profileId,
      });
      throw error;
    }
  }

  /**
   * Валидация пути профиля
   * 
   * Проверяет, что путь безопасен и находится в допустимой области.
   * 
   * @param profilePath - Путь к профилю
   * @returns true если путь валиден
   * @throws Error если путь небезопасен
   */
  validateProfilePath(profilePath: string): boolean {
    try {
      // Базовая проверка формата пути
      if (!profilePath || typeof profilePath !== 'string') {
        throw new Error('Profile path must be a non-empty string');
      }

      // Проверка на наличие опасных символов
      if (profilePath.includes('..') || profilePath.includes('~')) {
        throw new Error('Profile path contains dangerous characters');
      }

      return true;
    } catch (error) {
      logger.error('Profile path validation failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        profilePath,
      });
      throw error;
    }
  }

  /**
   * Получение базового пути
   * 
   * @returns Базовый путь к директории профилей
   */
  getBasePath(): string {
    return this.directoryManager.getBasePath();
  }
}









