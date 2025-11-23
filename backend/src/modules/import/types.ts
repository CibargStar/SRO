/**
 * Типы для модуля импорта клиентов
 * 
 * Определяет все интерфейсы и типы, используемые в процессе импорта.
 * 
 * @module modules/import/types
 */

/**
 * Строка из Excel после парсинга
 */
export interface ParsedRow {
  name: string | null;      // Полное ФИО или null
  phone: string;            // Строка с номерами (может быть несколько)
  region: string;           // Название региона
  rowNumber: number;        // Номер строки для отчета об ошибках
}

/**
 * Результат парсинга ФИО
 */
export interface ParsedName {
  lastName: string | null;
  firstName: string | null;
  middleName: string | null;
}

/**
 * Результат парсинга телефонов
 */
export interface ParsedPhone {
  normalized: string;       // Нормализованный номер
  original: string;         // Оригинальный формат
  isValid: boolean;         // Прошла ли валидация
}

/**
 * Результат обработки строки
 */
export interface ProcessedRow {
  parsedRow: ParsedRow;
  parsedName: ParsedName;
  parsedPhones: ParsedPhone[];
  regionId: string | null;
  status: 'new' | 'updated' | 'skipped' | 'error';
  error?: string;
  clientId?: string;        // ID созданного/обновленного клиента
}

/**
 * Статистика импорта
 */
export interface ImportStatistics {
  total: number;            // Всего строк обработано
  created: number;          // Создано новых клиентов
  updated: number;          // Обновлено существующих
  skipped: number;          // Пропущено (дубликаты)
  errors: number;           // Ошибок
  regionsCreated: number;   // Создано новых регионов
}

/**
 * Результат импорта
 */
export interface ImportResult {
  success: boolean;
  statistics: ImportStatistics;
  processedRows: ProcessedRow[];
  errors: Array<{
    rowNumber: number;
    message: string;
    data?: {
      name: string | null;
      phone: string;
      region: string;
    };
  }>;
  groupId: string;
  groupName: string;
}

/**
 * Стратегия дедупликации
 */
export interface DeduplicationStrategy {
  action: 'create' | 'update' | 'skip';
  reason: string;
  existingClientId?: string;
}

/**
 * Тип совпадения при поиске существующего клиента
 */
export type MatchType = 'phone' | 'name_and_phone' | null;

// Экспорт типов конфигурации
export type {
  ImportConfig,
  SearchScope,
  MatchCriteria,
  DuplicateAction,
  NoDuplicateAction,
  ErrorHandling,
  NewClientStatus,
  SearchScopeConfig,
  DuplicateActionConfig,
  ValidationConfig,
  AdditionalConfig,
} from './types/import-config.types';

export { PRESET_TEMPLATES, getDefaultImportConfig } from './types/import-config.types';

