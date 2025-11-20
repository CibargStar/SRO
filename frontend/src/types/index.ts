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
}
