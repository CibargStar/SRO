/**
 * TypeScript типы для модуля управления шаблонами сообщений
 * 
 * Определяет все типы данных, используемые в модуле шаблонов.
 */

/**
 * Тип шаблона
 */
export type TemplateType = 'SINGLE' | 'MULTI';

/**
 * Тип элемента шаблона
 */
export type TemplateItemType = 'TEXT' | 'FILE';

/**
 * Тип файла
 */
export type FileType = 'IMAGE' | 'VIDEO' | 'DOCUMENT';

/**
 * Целевой мессенджер для шаблона
 */
export type MessengerTarget = 'WHATSAPP_ONLY' | 'TELEGRAM_ONLY' | 'UNIVERSAL';

/**
 * Категория шаблонов
 */
export interface TemplateCategory {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  color: string | null;
  orderIndex: number;
  createdAt: string;
  updatedAt: string;
  _count?: {
    templates: number;
  };
}

/**
 * Элемент шаблона (сообщение или файл)
 */
export interface TemplateItem {
  id: string;
  templateId: string;
  orderIndex: number;
  type: TemplateItemType;
  // Для типа TEXT
  content: string | null;
  // Для типа FILE
  fileName: string | null;
  filePath: string | null;
  fileUrl: string | null;
  fileSize: number | null;
  mimeType: string | null;
  fileType: FileType | null;
  delayAfterMs: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Шаблон сообщений
 */
export interface Template {
  id: string;
  userId: string;
  categoryId: string;
  name: string;
  description: string | null;
  type: TemplateType;
  messengerTarget: MessengerTarget;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  category?: TemplateCategory | null;
  items?: TemplateItem[];
  _count?: {
    items: number;
  };
}

/**
 * Query параметры для списка шаблонов
 */
export interface ListTemplatesQuery {
  page?: number;
  limit?: number;
  search?: string;
  categoryId?: string;
  type?: TemplateType;
  messengerTarget?: MessengerTarget;
  sortBy?: 'createdAt' | 'updatedAt' | 'name';
  sortOrder?: 'asc' | 'desc';
}

/**
 * Ответ со списком шаблонов (с пагинацией)
 */
export interface TemplatesListResponse {
  data: Template[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

/**
 * Данные для создания категории
 */
export interface CreateCategoryInput {
  name: string;
  description?: string | null;
  color?: string | null;
  orderIndex?: number;
}

/**
 * Данные для обновления категории
 */
export interface UpdateCategoryInput {
  name?: string;
  description?: string | null;
  color?: string | null;
  orderIndex?: number;
}

/**
 * Данные для создания шаблона
 */
export interface CreateTemplateInput {
  categoryId: string;
  name: string;
  description?: string | null;
  type: TemplateType;
  messengerTarget: MessengerTarget;
  // items не используется - элементы добавляются отдельно после создания шаблона
  // Для SINGLE шаблона можно использовать content для создания первого элемента (не реализовано в текущей версии)
}

/**
 * Данные для обновления шаблона
 */
export interface UpdateTemplateInput {
  categoryId?: string;
  name?: string;
  description?: string | null;
  messengerTarget?: MessengerTarget;
  isActive?: boolean;
}

/**
 * Данные для создания элемента шаблона
 */
export interface CreateTemplateItemInput {
  type: TemplateItemType;
  content?: string | null;
  // orderIndex не передается - backend вычисляет автоматически на основе maxIndex + 1
  delayAfterMs?: number;
}

/**
 * Данные для обновления элемента шаблона
 */
export interface UpdateTemplateItemInput {
  content?: string | null;
  // orderIndex не используется - порядок изменяется через reorderItems
  delayAfterMs?: number;
}

/**
 * Данные для переупорядочивания элементов
 */
export interface ReorderItemsInput {
  items: Array<{
    id: string;
    orderIndex: number;
  }>;
}

/**
 * Данные для перемещения шаблона в категорию
 */
export interface MoveTemplateInput {
  categoryId: string;
}

/**
 * Данные для предпросмотра шаблона
 */
export interface PreviewTemplateInput {
  clientData?: {
    firstName?: string;
    lastName?: string;
    middleName?: string;
    phone?: string;
    [key: string]: string | undefined;
  };
}

/**
 * Результат предпросмотра шаблона
 */
export interface TemplatePreviewResponse {
  items: Array<{
    orderIndex: number;
    type: TemplateItemType;
    content: string | null;
    fileUrl: string | null;
    fileName: string | null;
    fileType: FileType | null;
    mimeType: string | null;
  }>;
  variables: string[];
  usedVariables: string[];
}

/**
 * Результат загрузки файла
 */
export interface FileUploadResponse {
  itemId: string;
  fileName: string;
  filePath: string;
  fileUrl: string;
  fileSize: number;
  mimeType: string;
  fileType: FileType;
  sizeWarning?: boolean;
}

/**
 * Поддерживаемые переменные для шаблонов
 */
export type TemplateVariable = 
  | 'firstName'
  | 'lastName'
  | 'middleName'
  | 'fullName'
  | 'phone'
  | 'date'
  | 'time'
  | 'groupName'
  | 'regionName';

/**
 * Информация о переменной шаблона
 */
export interface TemplateVariableInfo {
  name: TemplateVariable;
  label: string;
  description: string;
  example: string;
}

/**
 * Список доступных переменных с описаниями
 */
export const TEMPLATE_VARIABLES: TemplateVariableInfo[] = [
  {
    name: 'firstName',
    label: 'Имя',
    description: 'Имя клиента',
    example: 'Иван',
  },
  {
    name: 'lastName',
    label: 'Фамилия',
    description: 'Фамилия клиента',
    example: 'Иванов',
  },
  {
    name: 'middleName',
    label: 'Отчество',
    description: 'Отчество клиента',
    example: 'Иванович',
  },
  {
    name: 'fullName',
    label: 'Полное имя',
    description: 'ФИО клиента полностью',
    example: 'Иванов Иван Иванович',
  },
  {
    name: 'phone',
    label: 'Телефон',
    description: 'Номер телефона клиента',
    example: '+79991234567',
  },
  {
    name: 'date',
    label: 'Дата',
    description: 'Текущая дата',
    example: '08.12.2025',
  },
  {
    name: 'time',
    label: 'Время',
    description: 'Текущее время',
    example: '14:30',
  },
  {
    name: 'groupName',
    label: 'Группа',
    description: 'Название группы клиента',
    example: 'VIP-клиенты',
  },
  {
    name: 'regionName',
    label: 'Регион',
    description: 'Регион клиента',
    example: 'Москва',
  },
];

/**
 * Допустимые MIME-типы для файлов
 */
export const ALLOWED_MIME_TYPES = {
  IMAGE: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  VIDEO: ['video/mp4'],
  DOCUMENT: [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ],
} as const;

/**
 * Допустимые расширения файлов
 */
export const ALLOWED_EXTENSIONS = {
  IMAGE: ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
  VIDEO: ['.mp4'],
  DOCUMENT: ['.pdf', '.doc', '.docx', '.xls', '.xlsx'],
} as const;

/**
 * Максимальный размер файла в байтах (50MB)
 */
export const MAX_FILE_SIZE = 50 * 1024 * 1024;

/**
 * Порог для предупреждения о большом файле (20MB)
 */
export const FILE_SIZE_WARNING_THRESHOLD = 20 * 1024 * 1024;

/**
 * Максимальное количество элементов в Multi-шаблоне
 */
export const MAX_TEMPLATE_ITEMS = 50;


