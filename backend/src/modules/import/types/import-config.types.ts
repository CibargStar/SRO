/**
 * Типы для конфигурации импорта
 * 
 * Определяет структуру конфигурации импорта клиентов с возможностью
 * детальной настройки всех параметров.
 * 
 * @module modules/import/types/import-config.types
 */

/**
 * Область поиска дубликатов
 */
export type SearchScope = 
  | 'none'                    // Не искать дубликаты
  | 'current_group'           // Только в выбранной группе
  | 'owner_groups'            // Во всех группах владельца
  | 'all_users';              // Во всех группах всех пользователей (только ROOT)

/**
 * Критерии поиска дубликатов
 */
export type MatchCriteria = 
  | 'phone'                   // Только по телефону
  | 'phone_and_name'          // По телефону + ФИО
  | 'name';                   // Только по ФИО

/**
 * Действие при найденном дубликате
 */
export type DuplicateAction = 
  | 'skip'                    // Пропустить строку
  | 'update'                  // Обновить существующего
  | 'create';                 // Создать нового (игнорировать дубликат)

/**
 * Действие при отсутствии дубликата
 */
export type NoDuplicateAction = 
  | 'create'                  // Создать нового
  | 'skip';                   // Пропустить строку

/**
 * Обработка ошибок валидации
 */
export type ErrorHandling = 
  | 'stop'                    // Остановить импорт
  | 'skip'                    // Пропустить строку и продолжить
  | 'warn';                   // Показать предупреждение и продолжить

/**
 * Статус для новых клиентов
 */
export type NewClientStatus = 
  | 'NEW'                     // Новый клиент
  | 'OLD'                     // Старый клиент
  | 'from_file';              // Из файла (если есть колонка)

/**
 * Настройки области поиска
 */
export interface SearchScopeConfig {
  scopes: SearchScope[];      // Области поиска (можно несколько)
  matchCriteria: MatchCriteria; // Критерии поиска
}

/**
 * Настройки действий при дубликате
 */
export interface DuplicateActionConfig {
  defaultAction: DuplicateAction; // Действие по умолчанию
  updateName: boolean;            // Обновлять ФИО (если в импорте есть, а у существующего нет)
  updateRegion: boolean;          // Обновлять регион
  addPhones: boolean;             // Добавлять новые телефоны
  addToGroup: boolean;             // Добавлять клиента в текущую группу (если его там нет)
  moveToGroup: boolean;            // Перемещать клиента в текущую группу (удалять из других)
}

/**
 * Настройки валидации и фильтрации
 */
export interface ValidationConfig {
  requireName: boolean;           // Пропускать строки без ФИО
  requirePhone: boolean;          // Пропускать строки без валидных телефонов
  requireRegion: boolean;         // Пропускать строки без региона
  errorHandling: ErrorHandling;   // Обработка ошибок
}

/**
 * Дополнительные настройки
 */
export interface AdditionalConfig {
  newClientStatus: NewClientStatus; // Статус для новых клиентов
  updateStatus: boolean;             // Обновлять статус существующих клиентов
}

/**
 * Полная конфигурация импорта
 */
export interface ImportConfig {
  id?: string;                    // ID конфигурации (для сохраненных)
  name: string;                    // Название конфигурации
  description?: string;            // Описание
  userId: string;                  // ID пользователя-владельца
  isDefault?: boolean;             // Конфигурация по умолчанию
  
  // Основные настройки
  searchScope: SearchScopeConfig;
  duplicateAction: DuplicateActionConfig;
  noDuplicateAction: NoDuplicateAction;
  validation: ValidationConfig;
  additional: AdditionalConfig;
  
  // Метаданные
  createdAt?: Date;
  updatedAt?: Date;
}

/**
 * Предустановленные шаблоны конфигураций
 */
export const PRESET_TEMPLATES: Record<string, Omit<ImportConfig, 'id' | 'userId' | 'createdAt' | 'updatedAt'>> = {
  'full_import': {
    name: 'Полный импорт',
    description: 'Импорт без проверки дубликатов. Все клиенты создаются как новые.',
    isDefault: true,
    searchScope: {
      scopes: ['none'],
      matchCriteria: 'phone',
    },
    duplicateAction: {
      defaultAction: 'create',
      updateName: false,
      updateRegion: false,
      addPhones: false,
      addToGroup: false,
      moveToGroup: false,
    },
    noDuplicateAction: 'create',
    validation: {
      requireName: false,
      requirePhone: true,
      requireRegion: false,
      errorHandling: 'skip',
    },
    additional: {
      newClientStatus: 'NEW',
      updateStatus: false,
    },
  },
  
  'group_search': {
    name: 'Поиск в группе',
    description: 'Поиск дубликатов только в выбранной группе. Обновление существующих, создание новых.',
    searchScope: {
      scopes: ['current_group'],
      matchCriteria: 'phone',
    },
    duplicateAction: {
      defaultAction: 'update',
      updateName: true,
      updateRegion: false,
      addPhones: true,
      addToGroup: false,
      moveToGroup: false,
    },
    noDuplicateAction: 'create',
    validation: {
      requireName: false,
      requirePhone: true,
      requireRegion: false,
      errorHandling: 'skip',
    },
    additional: {
      newClientStatus: 'NEW',
      updateStatus: false,
    },
  },
  
  'owner_search': {
    name: 'Поиск по всем клиентам',
    description: 'Поиск дубликатов среди всех клиентов владельца. Обновление существующих, создание новых.',
    searchScope: {
      scopes: ['owner_groups'],
      matchCriteria: 'phone',
    },
    duplicateAction: {
      defaultAction: 'update',
      updateName: true,
      updateRegion: false,
      addPhones: true,
      addToGroup: true,
      moveToGroup: false,
    },
    noDuplicateAction: 'create',
    validation: {
      requireName: false,
      requirePhone: true,
      requireRegion: false,
      errorHandling: 'skip',
    },
    additional: {
      newClientStatus: 'NEW',
      updateStatus: false,
    },
  },
  
  'smart_import': {
    name: 'Умный импорт',
    description: 'Добавляет существующих клиентов в группу, обновляет данные, создает новых.',
    searchScope: {
      scopes: ['owner_groups'],
      matchCriteria: 'phone',
    },
    duplicateAction: {
      defaultAction: 'update',
      updateName: true,
      updateRegion: false,
      addPhones: true,
      addToGroup: true,
      moveToGroup: false,
    },
    noDuplicateAction: 'create',
    validation: {
      requireName: false,
      requirePhone: true,
      requireRegion: false,
      errorHandling: 'skip',
    },
    additional: {
      newClientStatus: 'NEW',
      updateStatus: false,
    },
  },
  
  'update_only': {
    name: 'Только обновление',
    description: 'Обновляет только существующих клиентов. Новые не создаются.',
    searchScope: {
      scopes: ['owner_groups'],
      matchCriteria: 'phone',
    },
    duplicateAction: {
      defaultAction: 'update',
      updateName: true,
      updateRegion: false,
      addPhones: true,
      addToGroup: false,
      moveToGroup: false,
    },
    noDuplicateAction: 'skip',
    validation: {
      requireName: false,
      requirePhone: true,
      requireRegion: false,
      errorHandling: 'skip',
    },
    additional: {
      newClientStatus: 'NEW',
      updateStatus: false,
    },
  },
  
  'create_only': {
    name: 'Только новые',
    description: 'Создает только новых клиентов. Существующие пропускаются.',
    searchScope: {
      scopes: ['owner_groups'],
      matchCriteria: 'phone',
    },
    duplicateAction: {
      defaultAction: 'skip',
      updateName: false,
      updateRegion: false,
      addPhones: false,
      addToGroup: false,
      moveToGroup: false,
    },
    noDuplicateAction: 'create',
    validation: {
      requireName: false,
      requirePhone: true,
      requireRegion: false,
      errorHandling: 'skip',
    },
    additional: {
      newClientStatus: 'NEW',
      updateStatus: false,
    },
  },
};

/**
 * Значения по умолчанию для новой конфигурации
 */
export function getDefaultImportConfig(userId: string): ImportConfig {
  return {
    name: 'Новая конфигурация',
    description: '',
    userId,
    isDefault: false,
    searchScope: {
      scopes: ['owner_groups'],
      matchCriteria: 'phone',
    },
    duplicateAction: {
      defaultAction: 'update',
      updateName: true,
      updateRegion: false,
      addPhones: true,
      addToGroup: true,
      moveToGroup: false,
    },
    noDuplicateAction: 'create',
    validation: {
      requireName: false,
      requirePhone: true,
      requireRegion: false,
      errorHandling: 'skip',
    },
    additional: {
      newClientStatus: 'NEW',
      updateStatus: false,
    },
  };
}


