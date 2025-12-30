/**
 * Утилиты для безопасной работы с JSON
 * 
 * @module modules/campaigns/utils/json-utils
 */

import logger from '../../../config/logger';

/**
 * Безопасный парсинг JSON с обработкой ошибок
 * 
 * @param json - JSON строка для парсинга
 * @param defaultValue - Значение по умолчанию, если парсинг не удался
 * @returns Распарсенное значение или значение по умолчанию
 */
export function safeJsonParse<T>(json: string | null | undefined, defaultValue: T): T {
  if (!json) {
    return defaultValue;
  }

  try {
    return JSON.parse(json) as T;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to parse JSON', { 
      json: json.substring(0, 100), // Логируем только первые 100 символов
      error: errorMessage 
    });
    return defaultValue;
  }
}

/**
 * Безопасная сериализация в JSON
 * 
 * @param value - Значение для сериализации
 * @param defaultValue - Значение по умолчанию, если сериализация не удалась
 * @returns JSON строка или значение по умолчанию
 */
export function safeJsonStringify(value: unknown, defaultValue: string | null = null): string | null {
  try {
    return JSON.stringify(value);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to stringify JSON', { error: errorMessage });
    return defaultValue;
  }
}







