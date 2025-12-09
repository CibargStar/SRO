/**
 * TypeScript типы для модуля управления мессенджерами
 * 
 * Определяет все типы данных, используемые в модуле мессенджеров.
 */

/**
 * Статус аккаунта мессенджера
 */
export type MessengerAccountStatus = 'LOGGED_IN' | 'NOT_LOGGED_IN' | 'CHECKING' | 'ERROR' | 'UNKNOWN';

/**
 * Тип мессенджера
 */
export type MessengerType = 'WHATSAPP' | 'TELEGRAM';

/**
 * Мессенджер (справочник)
 */
export interface MessengerService {
  id: string;
  name: string; // Техническое имя (whatsapp, telegram)
  displayName: string; // Отображаемое имя
  icon: string | null; // Иконка или путь к иконке
  enabled: boolean; // Включен ли мессенджер в системе
  createdAt: string;
  updatedAt: string;
}

/**
 * Аккаунт мессенджера, привязанный к профилю
 */
export interface ProfileMessengerAccount {
  id: string;
  profileId: string;
  serviceId: string;
  service: MessengerService; // Полная информация о мессенджере
  isEnabled: boolean; // Включен ли мессенджер для этого профиля
  status: MessengerAccountStatus; // Статус входа
  lastCheckedAt: string | null; // Время последней проверки
  lastStatusChangeAt: string | null; // Время последнего изменения статуса
  metadata: Record<string, unknown> | null; // Метаданные в формате JSON
  createdAt: string;
  updatedAt: string;
}

/**
 * Конфигурация проверки статуса входа для мессенджера (ROOT only)
 */
export interface MessengerCheckConfig {
  id: string;
  serviceId: string;
  service: {
    id: string;
    name: string;
    displayName: string;
    enabled: boolean;
  };
  checkIntervalSeconds: number; // Интервал проверки в секундах
  enabled: boolean; // Включен ли мониторинг этого мессенджера
  createdAt: string;
  updatedAt: string;
  updatedBy: string | null; // ID пользователя, который обновил конфигурацию
}

/**
 * Результат проверки статуса входа
 */
export interface LoginCheckResult {
  status: MessengerAccountStatus;
  qrCode?: string; // Base64 строка QR-кода
  cloudPasswordRequired?: boolean; // Для Telegram
  error?: string; // Сообщение об ошибке
  checkedAt: string; // ISO 8601 дата
}

/**
 * Данные для создания аккаунта мессенджера
 */
export interface CreateMessengerAccountInput {
  serviceId: string; // UUID мессенджера
  isEnabled?: boolean; // По умолчанию true
  metadata?: Record<string, unknown> | null; // Метаданные
}

/**
 * Данные для обновления аккаунта мессенджера
 */
export interface UpdateMessengerAccountInput {
  isEnabled?: boolean;
  metadata?: Record<string, unknown> | null;
}

/**
 * Данные для обновления конфигурации проверки (ROOT only)
 */
export interface UpdateMessengerCheckConfigInput {
  checkIntervalSeconds: number; // Минимум 60, максимум 3600
  enabled?: boolean; // По умолчанию true
}







