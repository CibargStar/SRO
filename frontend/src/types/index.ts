/**
 * TypeScript типы и интерфейсы для frontend
 * 
 * Централизованное место для всех типов, используемых в React компонентах.
 * Включает типы для API ответов, форм, состояний и т.д.
 */

/**
 * Роль пользователя
 */
export type UserRole = 'ROOT' | 'USER';

/**
 * Пользователь
 * 
 * Соответствует структуре данных, возвращаемых API.
 */
export interface User {
  id: string;
  email: string;
  role: UserRole;
  name: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Данные для входа в систему
 */
export interface LoginInput {
  email: string;
  password: string;
}

/**
 * Ответ при успешном входе
 */
export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number; // Время жизни access token в секундах
  refreshExpiresIn: number; // Время жизни refresh token в секундах
  user: {
    id: string;
    email: string;
    role: UserRole;
    name: string | null;
  };
}

/**
 * Данные для обновления токенов
 */
export interface RefreshInput {
  refreshToken: string;
}

/**
 * Ответ при успешном обновлении токенов
 */
export interface RefreshResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number; // Время жизни access token в секундах
  refreshExpiresIn: number; // Время жизни refresh token в секундах
}

/**
 * Данные для выхода из системы
 */
export interface LogoutInput {
  refreshToken: string;
}

/**
 * Ошибка API
 */
export interface ApiError {
  message: string;
  error?: string;
  details?: unknown;
  statusCode?: number; // HTTP статус код для специальной обработки ошибок
}

/**
 * Статус клиента
 */
export type ClientStatus = 'NEW' | 'OLD';

/**
 * Регион
 */
export interface Region {
  id: string;
  name: string;
  createdAt: string;
  _count?: {
    clients: number;
  };
}

/**
 * Группа клиентов
 */
export interface ClientGroup {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  color: string | null;
  orderIndex: number | null;
  createdAt: string;
  updatedAt: string;
  _count?: {
    clients: number;
  };
}

/**
 * Статус мессенджера для телефона
 */
export type MessengerStatus = 'Valid' | 'Invalid' | 'Unknown';

/**
 * Телефон клиента
 */
export interface ClientPhone {
  id: string;
  clientId: string;
  phone: string;
  whatsAppStatus: MessengerStatus;
  telegramStatus: MessengerStatus;
}

/**
 * Клиент
 */
export interface Client {
  id: string;
  userId: string;
  lastName: string;
  firstName: string;
  middleName: string | null;
  regionId: string | null;
  groupId: string | null;
  status: ClientStatus;
  createdAt: string;
  region?: {
    id: string;
    name: string;
  } | null;
  group?: {
    id: string;
    name: string;
  } | null;
  phones?: ClientPhone[];
}

/**
 * Ответ списка клиентов с пагинацией
 */
export interface ClientsListResponse {
  data: Client[];
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
 * Query параметры для списка клиентов
 */
export interface ListClientsQuery {
  page?: number;
  limit?: number;
  search?: string;
  regionId?: string;
  groupId?: string;
  status?: ClientStatus;
  userId?: string; // Опциональный параметр для ROOT (для просмотра клиентов другого пользователя)
  sortBy?: 'createdAt' | 'lastName' | 'firstName' | 'regionId' | 'status';
  sortOrder?: 'asc' | 'desc';
}

/**
 * Данные для создания клиента
 */
export interface CreateClientInput {
  lastName: string;
  firstName: string;
  middleName?: string | null;
  regionId?: string | null;
  groupId?: string | null;
  status?: ClientStatus;
  userId?: string; // Опциональный параметр для ROOT (для создания клиента от имени другого пользователя)
  phones?: Array<{
    phone: string;
    whatsAppStatus?: MessengerStatus;
    telegramStatus?: MessengerStatus;
  }>;
}

/**
 * Данные для обновления клиента
 */
export interface UpdateClientInput {
  lastName?: string;
  firstName?: string;
  middleName?: string | null;
  regionId?: string | null;
  groupId?: string | null;
  status?: ClientStatus;
}

/**
 * Данные для создания группы клиентов
 */
export interface CreateClientGroupInput {
  name: string;
  description?: string | null;
  color?: string | null;
  orderIndex?: number | null;
}

/**
 * Данные для обновления группы клиентов
 */
export interface UpdateClientGroupInput {
  name?: string;
  description?: string | null;
  color?: string | null;
  orderIndex?: number | null;
}

/**
 * Данные для создания региона
 */
export interface CreateRegionInput {
  name: string;
}

/**
 * Данные для обновления региона
 */
export interface UpdateRegionInput {
  name?: string;
}

/**
 * Данные для создания телефона клиента
 */
export interface CreateClientPhoneInput {
  phone: string;
  whatsAppStatus?: MessengerStatus;
  telegramStatus?: MessengerStatus;
}

/**
 * Данные для обновления телефона клиента
 */
export interface UpdateClientPhoneInput {
  phone?: string;
  whatsAppStatus?: MessengerStatus;
  telegramStatus?: MessengerStatus;
}

/**
 * Экспорт типов для Sidebar
 */
export type {
  SidebarNavigationItem,
  NavigationVisibility,
  VisibilityChecker,
} from './sidebar';

/**
 * Экспорт типов для модуля профилей
 */
export * from './profile';

/**
 * Экспорт типов для модуля мессенджеров
 */
export * from './messenger';