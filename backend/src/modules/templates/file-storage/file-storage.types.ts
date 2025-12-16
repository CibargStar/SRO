/**
 * Типы для файлового хранилища шаблонов
 * 
 * @module modules/templates/file-storage/types
 */

import { FileType } from '@prisma/client';

/**
 * Допустимые расширения файлов
 */
export const ALLOWED_EXTENSIONS = {
  IMAGE: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
  VIDEO: ['mp4'],
  DOCUMENT: ['pdf', 'doc', 'docx', 'xls', 'xlsx'],
} as const;

/**
 * Допустимые MIME-типы
 */
export const ALLOWED_MIME_TYPES = {
  IMAGE: [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
  ],
  VIDEO: [
    'video/mp4',
  ],
  DOCUMENT: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ],
} as const;

/**
 * Лимиты размеров файлов
 */
export const FILE_SIZE_LIMITS = {
  /** Максимальный размер файла в байтах (50 MB) */
  MAX_FILE_SIZE: 50 * 1024 * 1024,
  /** Порог для предупреждения о большом файле (20 MB) */
  WARNING_THRESHOLD: 20 * 1024 * 1024,
} as const;

/**
 * Результат загрузки файла
 */
export interface UploadResult {
  /** Путь к файлу относительно корня uploads */
  filePath: string;
  /** Оригинальное имя файла */
  fileName: string;
  /** Тип файла */
  fileType: FileType;
  /** Размер файла в байтах */
  fileSize: number;
  /** MIME-тип файла */
  fileMimeType: string;
  /** Флаг большого файла (>20 MB) */
  isLargeFile: boolean;
}

/**
 * Метаданные файла
 */
export interface FileMetadata {
  /** Путь к файлу */
  filePath: string;
  /** Оригинальное имя файла */
  fileName: string;
  /** Тип файла */
  fileType: FileType;
  /** Размер файла в байтах */
  fileSize: number;
  /** MIME-тип */
  fileMimeType: string;
}

/**
 * Ошибка валидации файла
 */
export class FileValidationError extends Error {
  constructor(
    message: string,
    public code: 'INVALID_MIME_TYPE' | 'INVALID_EXTENSION' | 'FILE_TOO_LARGE' | 'FILE_NOT_FOUND' | 'UPLOAD_ERROR'
  ) {
    super(message);
    this.name = 'FileValidationError';
  }
}

/**
 * Получение FileType по MIME-типу
 */
export function getFileTypeByMimeType(mimeType: string): FileType | null {
  const imageTypes: readonly string[] = ALLOWED_MIME_TYPES.IMAGE;
  const videoTypes: readonly string[] = ALLOWED_MIME_TYPES.VIDEO;
  const documentTypes: readonly string[] = ALLOWED_MIME_TYPES.DOCUMENT;
  
  if (imageTypes.includes(mimeType)) {
    return 'IMAGE';
  }
  if (videoTypes.includes(mimeType)) {
    return 'VIDEO';
  }
  if (documentTypes.includes(mimeType)) {
    return 'DOCUMENT';
  }
  return null;
}

/**
 * Получение FileType по расширению файла
 */
export function getFileTypeByExtension(extension: string): FileType | null {
  const ext = extension.toLowerCase();
  const imageExts: readonly string[] = ALLOWED_EXTENSIONS.IMAGE;
  const videoExts: readonly string[] = ALLOWED_EXTENSIONS.VIDEO;
  const documentExts: readonly string[] = ALLOWED_EXTENSIONS.DOCUMENT;
  
  if (imageExts.includes(ext)) {
    return 'IMAGE';
  }
  if (videoExts.includes(ext)) {
    return 'VIDEO';
  }
  if (documentExts.includes(ext)) {
    return 'DOCUMENT';
  }
  return null;
}

/**
 * Проверка допустимости MIME-типа
 */
export function isValidMimeType(mimeType: string): boolean {
  return getFileTypeByMimeType(mimeType) !== null;
}

/**
 * Проверка допустимости расширения
 */
export function isValidExtension(extension: string): boolean {
  return getFileTypeByExtension(extension) !== null;
}

/**
 * Получение всех допустимых расширений
 */
export function getAllowedExtensions(): string[] {
  return [
    ...ALLOWED_EXTENSIONS.IMAGE,
    ...ALLOWED_EXTENSIONS.VIDEO,
    ...ALLOWED_EXTENSIONS.DOCUMENT,
  ];
}

/**
 * Получение всех допустимых MIME-типов
 */
export function getAllowedMimeTypes(): string[] {
  return [
    ...ALLOWED_MIME_TYPES.IMAGE,
    ...ALLOWED_MIME_TYPES.VIDEO,
    ...ALLOWED_MIME_TYPES.DOCUMENT,
  ];
}




