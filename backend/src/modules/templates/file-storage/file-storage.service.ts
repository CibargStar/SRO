/**
 * Сервис для работы с файловым хранилищем шаблонов
 * 
 * Обеспечивает загрузку, удаление и валидацию файлов для шаблонов рассылки.
 * Файлы хранятся в структуре: /uploads/templates/{userId}/{templateId}/
 * 
 * @module modules/templates/file-storage/file-storage.service
 */

import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import logger from '../../../config/logger';
import {
  UploadResult,
  FileValidationError,
  FILE_SIZE_LIMITS,
  getFileTypeByMimeType,
  getFileTypeByExtension,
  isValidMimeType,
  isValidExtension,
  getAllowedExtensions,
} from './file-storage.types';

/**
 * Конфигурация файлового хранилища
 */
interface FileStorageConfig {
  /** Базовая директория для хранения файлов */
  uploadsDir: string;
}

/**
 * Сервис файлового хранилища для шаблонов
 */
export class FileStorageService {
  private uploadsDir: string;

  constructor(config?: FileStorageConfig) {
    // По умолчанию используем директорию uploads в корне проекта
    this.uploadsDir = config?.uploadsDir ?? path.join(process.cwd(), 'uploads', 'templates');
  }

  /**
   * Инициализация хранилища (создание базовых директорий)
   */
  async initialize(): Promise<void> {
    try {
      await fs.mkdir(this.uploadsDir, { recursive: true });
      logger.info('File storage initialized', { uploadsDir: this.uploadsDir });
    } catch (error) {
      logger.error('Failed to initialize file storage', { error, uploadsDir: this.uploadsDir });
      throw error;
    }
  }

  /**
   * Загрузка файла для шаблона
   * 
   * @param userId - ID пользователя
   * @param templateId - ID шаблона
   * @param file - Файл (Buffer)
   * @param originalName - Оригинальное имя файла
   * @param mimeType - MIME-тип файла
   * @returns Результат загрузки
   */
  async uploadFile(
    userId: string,
    templateId: string,
    file: Buffer,
    originalName: string,
    mimeType: string
  ): Promise<UploadResult> {
    // Валидация
    this.validateFile(file, originalName, mimeType);

    // Определение типа файла
    const fileType = getFileTypeByMimeType(mimeType);
    if (!fileType) {
      throw new FileValidationError(
        `Invalid MIME type: ${mimeType}. Allowed types: ${getAllowedExtensions().join(', ')}`,
        'INVALID_MIME_TYPE'
      );
    }

    // Создание директории для шаблона
    const templateDir = path.join(this.uploadsDir, userId, templateId);
    await fs.mkdir(templateDir, { recursive: true });

    // Генерация уникального имени файла с сохранением расширения
    const ext = path.extname(originalName).toLowerCase();
    const uniqueFileName = `${uuidv4()}${ext}`;
    const filePath = path.join(templateDir, uniqueFileName);

    try {
      // Запись файла
      await fs.writeFile(filePath, file);

      // Формирование относительного пути для БД
      const relativePath = path.join(userId, templateId, uniqueFileName);

      logger.info('File uploaded', {
        userId,
        templateId,
        fileName: originalName,
        fileSize: file.length,
        relativePath,
      });

      return {
        filePath: relativePath,
        fileName: originalName,
        fileType,
        fileSize: file.length,
        fileMimeType: mimeType,
        isLargeFile: file.length > FILE_SIZE_LIMITS.WARNING_THRESHOLD,
      };
    } catch (error) {
      logger.error('Failed to upload file', { error, userId, templateId, originalName });
      throw new FileValidationError('Failed to save file to disk', 'UPLOAD_ERROR');
    }
  }

  /**
   * Удаление файла
   * 
   * @param relativePath - Относительный путь к файлу (из БД)
   */
  async deleteFile(relativePath: string): Promise<void> {
    const fullPath = path.join(this.uploadsDir, relativePath);

    try {
      await fs.unlink(fullPath);
      logger.info('File deleted', { relativePath });
    } catch (error: unknown) {
      // Игнорируем ошибку если файл не существует
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
        logger.warn('File not found for deletion', { relativePath });
        return;
      }
      logger.error('Failed to delete file', { error, relativePath });
      throw error;
    }
  }

  /**
   * Удаление всех файлов шаблона
   * 
   * @param userId - ID пользователя
   * @param templateId - ID шаблона
   */
  async deleteTemplateFiles(userId: string, templateId: string): Promise<void> {
    const templateDir = path.join(this.uploadsDir, userId, templateId);

    try {
      await fs.rm(templateDir, { recursive: true, force: true });
      logger.info('Template files deleted', { userId, templateId });
    } catch (error: unknown) {
      // Игнорируем ошибку если директория не существует
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
        logger.warn('Template directory not found for deletion', { userId, templateId });
        return;
      }
      logger.error('Failed to delete template files', { error, userId, templateId });
      throw error;
    }
  }

  /**
   * Удаление всех файлов пользователя (для очистки при удалении пользователя)
   * 
   * @param userId - ID пользователя
   */
  async deleteUserFiles(userId: string): Promise<void> {
    const userDir = path.join(this.uploadsDir, userId);

    try {
      await fs.rm(userDir, { recursive: true, force: true });
      logger.info('User files deleted', { userId });
    } catch (error: unknown) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
        logger.warn('User directory not found for deletion', { userId });
        return;
      }
      logger.error('Failed to delete user files', { error, userId });
      throw error;
    }
  }

  /**
   * Получение полного пути к файлу
   * 
   * @param relativePath - Относительный путь к файлу (из БД)
   * @returns Полный путь к файлу
   */
  getFullPath(relativePath: string): string {
    return path.join(this.uploadsDir, relativePath);
  }

  /**
   * Проверка существования файла
   * 
   * @param relativePath - Относительный путь к файлу (из БД)
   * @returns true если файл существует
   */
  async fileExists(relativePath: string): Promise<boolean> {
    const fullPath = path.join(this.uploadsDir, relativePath);
    try {
      await fs.access(fullPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Чтение файла
   * 
   * @param relativePath - Относительный путь к файлу (из БД)
   * @returns Buffer с содержимым файла
   */
  async readFile(relativePath: string): Promise<Buffer> {
    const fullPath = path.join(this.uploadsDir, relativePath);
    try {
      return await fs.readFile(fullPath);
    } catch (error: unknown) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
        throw new FileValidationError('File not found', 'FILE_NOT_FOUND');
      }
      logger.error('Failed to read file', { error, relativePath });
      throw error;
    }
  }

  /**
   * Получение информации о файле
   * 
   * @param relativePath - Относительный путь к файлу (из БД)
   * @returns Статистика файла или null
   */
  async getFileStats(relativePath: string): Promise<{ size: number; mtime: Date } | null> {
    const fullPath = path.join(this.uploadsDir, relativePath);
    try {
      const stats = await fs.stat(fullPath);
      return {
        size: stats.size,
        mtime: stats.mtime,
      };
    } catch (error: unknown) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
        return null;
      }
      logger.error('Failed to get file stats', { error, relativePath });
      throw error;
    }
  }

  /**
   * Копирование файла (для дублирования шаблона)
   * 
   * @param sourcePath - Исходный относительный путь
   * @param targetUserId - ID пользователя-владельца нового файла
   * @param targetTemplateId - ID нового шаблона
   * @param originalName - Оригинальное имя файла
   * @returns Новый относительный путь
   */
  async copyFile(
    sourcePath: string,
    targetUserId: string,
    targetTemplateId: string,
    originalName: string
  ): Promise<string> {
    const sourceFullPath = path.join(this.uploadsDir, sourcePath);

    // Создание директории для нового шаблона
    const targetDir = path.join(this.uploadsDir, targetUserId, targetTemplateId);
    await fs.mkdir(targetDir, { recursive: true });

    // Генерация уникального имени файла
    const ext = path.extname(originalName).toLowerCase();
    const uniqueFileName = `${uuidv4()}${ext}`;
    const targetFullPath = path.join(targetDir, uniqueFileName);

    try {
      await fs.copyFile(sourceFullPath, targetFullPath);
      const relativePath = path.join(targetUserId, targetTemplateId, uniqueFileName);
      
      logger.info('File copied', { sourcePath, targetPath: relativePath });
      return relativePath;
    } catch (error: unknown) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
        throw new FileValidationError('Source file not found', 'FILE_NOT_FOUND');
      }
      logger.error('Failed to copy file', { error, sourcePath, targetTemplateId });
      throw error;
    }
  }

  /**
   * Валидация файла
   * 
   * @param file - Файл (Buffer)
   * @param originalName - Оригинальное имя файла
   * @param mimeType - MIME-тип файла
   */
  private validateFile(file: Buffer, originalName: string, mimeType: string): void {
    // Проверка размера файла
    if (file.length > FILE_SIZE_LIMITS.MAX_FILE_SIZE) {
      const maxSizeMB = FILE_SIZE_LIMITS.MAX_FILE_SIZE / (1024 * 1024);
      throw new FileValidationError(
        `File size exceeds maximum allowed size of ${maxSizeMB} MB`,
        'FILE_TOO_LARGE'
      );
    }

    // Проверка расширения
    const ext = path.extname(originalName).toLowerCase().slice(1); // убираем точку
    if (!isValidExtension(ext)) {
      throw new FileValidationError(
        `Invalid file extension: ${ext}. Allowed extensions: ${getAllowedExtensions().join(', ')}`,
        'INVALID_EXTENSION'
      );
    }

    // Проверка MIME-типа
    if (!isValidMimeType(mimeType)) {
      throw new FileValidationError(
        `Invalid MIME type: ${mimeType}`,
        'INVALID_MIME_TYPE'
      );
    }

    // Проверка соответствия расширения и MIME-типа
    const typeByExt = getFileTypeByExtension(ext);
    const typeByMime = getFileTypeByMimeType(mimeType);
    if (typeByExt !== typeByMime) {
      throw new FileValidationError(
        `MIME type ${mimeType} does not match file extension ${ext}`,
        'INVALID_MIME_TYPE'
      );
    }
  }

  /**
   * Получение базовой директории uploads
   */
  getUploadsDir(): string {
    return this.uploadsDir;
  }
}




