/**
 * Менеджер директорий профилей
 * 
 * Управляет созданием, проверкой и удалением директорий профилей Chrome.
 * Обеспечивает изоляцию профилей на уровне файловой системы.
 * 
 * Безопасность:
 * - Валидация путей для защиты от path traversal
 * - Проверка существования директорий
 * - Безопасное удаление с проверками
 * 
 * @module modules/profiles/isolation/profile-directory.manager
 */

import { join, resolve, relative } from 'path';
import { mkdir, access, rm, stat } from 'fs/promises';
import { constants } from 'fs';
import logger from '../../../config/logger';

/**
 * Менеджер директорий профилей
 */
export class ProfileDirectoryManager {
  private basePath: string;

  constructor(basePath: string = './profiles') {
    // Нормализация базового пути (абсолютный путь)
    this.basePath = resolve(basePath);
  }

  /**
   * Получение пути к директории профиля
   * 
   * @param userId - ID пользователя
   * @param profileId - ID профиля
   * @returns Абсолютный путь к директории профиля
   */
  getProfilePath(userId: string, profileId: string): string {
    // Валидация входных данных
    this.validateIds(userId, profileId);

    // Создание пути: basePath/userId/profileId
    const profilePath = join(this.basePath, userId, profileId);

    // Проверка безопасности пути (защита от path traversal)
    this.validatePath(profilePath);

    return profilePath;
  }

  /**
   * Получение пути к директории пользователя
   * 
   * @param userId - ID пользователя
   * @returns Абсолютный путь к директории пользователя
   */
  getUserDirectoryPath(userId: string): string {
    this.validateUserId(userId);

    const userPath = join(this.basePath, userId);
    this.validatePath(userPath);

    return userPath;
  }

  /**
   * Создание директории профиля
   * 
   * Создает структуру:
   * - basePath/userId/ (если не существует)
   * - basePath/userId/profileId/ (директория профиля)
   * - basePath/userId/profileId/chrome-data/ (для данных Chrome)
   * - basePath/userId/profileId/logs/ (для логов профиля)
   * 
   * @param userId - ID пользователя
   * @param profileId - ID профиля
   * @returns Путь к созданной директории профиля
   */
  async createProfileDirectory(userId: string, profileId: string): Promise<string> {
    const profilePath = this.getProfilePath(userId, profileId);

    try {
      // Проверка существования директории
      try {
        const stats = await stat(profilePath);
        if (stats.isDirectory()) {
          logger.warn('Profile directory already exists', { profilePath, userId, profileId });
          return profilePath;
        }
        // Если существует, но не директория - ошибка
        throw new Error(`Path exists but is not a directory: ${profilePath}`);
      } catch (error) {
        // Если ошибка не "файл не найден" - пробрасываем дальше
        if (error instanceof Error && !error.message.includes('ENOENT')) {
          throw error;
        }
      }

      // Создание директории профиля с поддиректориями
      await mkdir(join(profilePath, 'chrome-data'), { recursive: true });
      await mkdir(join(profilePath, 'logs'), { recursive: true });

      logger.info('Profile directory created successfully', {
        profilePath,
        userId,
        profileId,
      });

      return profilePath;
    } catch (error) {
      logger.error('Failed to create profile directory', {
        error: error instanceof Error ? error.message : 'Unknown error',
        profilePath,
        userId,
        profileId,
      });
      throw new Error(`Failed to create profile directory: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Проверка существования директории профиля
   * 
   * @param userId - ID пользователя
   * @param profileId - ID профиля
   * @returns true если директория существует, false иначе
   */
  async profileDirectoryExists(userId: string, profileId: string): Promise<boolean> {
    const profilePath = this.getProfilePath(userId, profileId);

    try {
      await access(profilePath, constants.F_OK);
      const stats = await stat(profilePath);
      return stats.isDirectory();
    } catch {
      return false;
    }
  }

  /**
   * Удаление директории профиля
   * 
   * Безопасно удаляет директорию профиля со всем содержимым.
   * 
   * @param userId - ID пользователя
   * @param profileId - ID профиля
   * @throws Error если директория не существует или не может быть удалена
   */
  async deleteProfileDirectory(userId: string, profileId: string): Promise<void> {
    const profilePath = this.getProfilePath(userId, profileId);

    try {
      // Проверка существования директории
      const exists = await this.profileDirectoryExists(userId, profileId);
      if (!exists) {
        logger.warn('Profile directory does not exist, skipping deletion', {
          profilePath,
          userId,
          profileId,
        });
        return;
      }

      // Проверка, что путь действительно является директорией профиля
      this.validatePath(profilePath);

      // Рекурсивное удаление директории
      await rm(profilePath, { recursive: true, force: true });

      logger.info('Profile directory deleted successfully', {
        profilePath,
        userId,
        profileId,
      });
    } catch (error) {
      logger.error('Failed to delete profile directory', {
        error: error instanceof Error ? error.message : 'Unknown error',
        profilePath,
        userId,
        profileId,
      });
      throw new Error(`Failed to delete profile directory: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Получение размера директории профиля
   * 
   * @param userId - ID пользователя
   * @param profileId - ID профиля
   * @returns Размер директории в байтах
   */
  async getProfileDirectorySize(userId: string, profileId: string): Promise<number> {
    const profilePath = this.getProfilePath(userId, profileId);

    try {
      const stats = await stat(profilePath);
      if (!stats.isDirectory()) {
        return 0;
      }

      // Простая реализация - можно улучшить рекурсивным подсчетом
      return stats.size;
    } catch {
      return 0;
    }
  }

  /**
   * Очистка директории профиля (удаление содержимого, но не самой директории)
   * 
   * @param userId - ID пользователя
   * @param profileId - ID профиля
   */
  async clearProfileDirectory(userId: string, profileId: string): Promise<void> {
    const profilePath = this.getProfilePath(userId, profileId);

    try {
      const exists = await this.profileDirectoryExists(userId, profileId);
      if (!exists) {
        return;
      }

      // Удаление содержимого директории
      const chromeDataPath = join(profilePath, 'chrome-data');
      const logsPath = join(profilePath, 'logs');

      // Удаление поддиректорий
      try {
        await rm(chromeDataPath, { recursive: true, force: true });
      } catch (error) {
        logger.warn('Failed to remove chrome-data directory', { error, chromeDataPath });
      }

      try {
        await rm(logsPath, { recursive: true, force: true });
      } catch (error) {
        logger.warn('Failed to remove logs directory', { error, logsPath });
      }

      // Пересоздание поддиректорий
      await mkdir(chromeDataPath, { recursive: true });
      await mkdir(logsPath, { recursive: true });

      logger.info('Profile directory cleared successfully', {
        profilePath,
        userId,
        profileId,
      });
    } catch (error) {
      logger.error('Failed to clear profile directory', {
        error: error instanceof Error ? error.message : 'Unknown error',
        profilePath,
        userId,
        profileId,
      });
      throw new Error(`Failed to clear profile directory: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Валидация ID пользователя и профиля
   * 
   * @param userId - ID пользователя
   * @param profileId - ID профиля
   * @throws Error если ID невалидны
   */
  private validateIds(userId: string, profileId: string): void {
    this.validateUserId(userId);
    this.validateProfileId(profileId);
  }

  /**
   * Валидация ID пользователя
   * 
   * @param userId - ID пользователя
   * @throws Error если ID невалиден
   */
  private validateUserId(userId: string): void {
    if (!userId || typeof userId !== 'string') {
      throw new Error('User ID is required and must be a string');
    }

    // UUID формат (базовая проверка)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(userId)) {
      throw new Error('User ID must be a valid UUID');
    }
  }

  /**
   * Валидация ID профиля
   * 
   * @param profileId - ID профиля
   * @throws Error если ID невалиден
   */
  private validateProfileId(profileId: string): void {
    if (!profileId || typeof profileId !== 'string') {
      throw new Error('Profile ID is required and must be a string');
    }

    // UUID формат (базовая проверка)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(profileId)) {
      throw new Error('Profile ID must be a valid UUID');
    }
  }

  /**
   * Валидация пути для защиты от path traversal атак
   * 
   * Проверяет, что путь находится внутри базовой директории.
   * 
   * @param path - Путь для валидации
   * @throws Error если путь небезопасен
   */
  private validatePath(path: string): void {
    const resolvedPath = resolve(path);
    const resolvedBasePath = resolve(this.basePath);

    // Проверка на наличие опасных символов в исходном пути
    if (path.includes('..') || path.includes('~')) {
      logger.error('Dangerous path detected', { path });
      throw new Error('Invalid path: dangerous characters detected');
    }

    // Используем path.relative для более надежной проверки
    // Если путь находится внутри базовой директории, relative вернет путь без '..'
    const relativePath = relative(resolvedBasePath, resolvedPath);
    
    // Проверка, что путь находится внутри базовой директории
    // relativePath не должен начинаться с '..' (это означает выход за пределы базовой директории)
    // и не должен быть абсолютным путем (начинаться с сепаратора на Unix или с буквы диска на Windows)
    if (relativePath.startsWith('..')) {
      logger.error('Path traversal attempt detected', {
        path: resolvedPath,
        basePath: resolvedBasePath,
        relativePath,
      });
      throw new Error('Invalid path: path traversal detected');
    }

    // Дополнительная проверка: нормализованные пути должны совпадать в начале
    // Нормализуем сепараторы для сравнения (заменяем все на /)
    const normalizedPath = resolvedPath.replace(/\\/g, '/').toLowerCase();
    const normalizedBasePath = resolvedBasePath.replace(/\\/g, '/').toLowerCase();
    
    if (!normalizedPath.startsWith(normalizedBasePath + '/') && normalizedPath !== normalizedBasePath) {
      logger.error('Path traversal attempt detected', {
        path: resolvedPath,
        basePath: resolvedBasePath,
        normalizedPath,
        normalizedBasePath,
      });
      throw new Error('Invalid path: path traversal detected');
    }
  }

  /**
   * Получение базового пути
   * 
   * @returns Базовый путь к директории профилей
   */
  getBasePath(): string {
    return this.basePath;
  }
}

