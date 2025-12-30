/**
 * Zod схемы валидации для модуля аккаунтов мессенджеров
 * 
 * Определяет схемы валидации для входных данных API endpoints управления аккаунтами мессенджеров.
 * Используется для типобезопасной валидации запросов.
 * 
 * @module modules/profiles/messenger-accounts/messenger-accounts.schemas
 */

import { z } from 'zod';

/**
 * Enum для статуса аккаунта мессенджера
 */
export const MessengerAccountStatusEnum = z.enum([
  'LOGGED_IN',
  'NOT_LOGGED_IN',
  'CHECKING',
  'ERROR',
  'UNKNOWN',
]);

/**
 * Схема валидации для создания/привязки аккаунта мессенджера к профилю
 * 
 * @property serviceId - ID мессенджера (обязательно)
 * @property isEnabled - Включен ли мессенджер для профиля (опционально, по умолчанию true)
 * @property metadata - Метаданные аккаунта в формате JSON (опционально)
 */
export const createMessengerAccountSchema = z.object({
  serviceId: z
    .string({ required_error: 'Service ID is required' })
    .uuid({ message: 'Service ID must be a valid UUID' }),

  isEnabled: z
    .boolean()
    .optional()
    .default(true),

  metadata: z
    .record(z.unknown())
    .optional()
    .nullable(),
});

/**
 * Тип для данных создания аккаунта мессенджера
 */
export type CreateMessengerAccountInput = z.infer<typeof createMessengerAccountSchema>;

/**
 * Схема валидации для обновления аккаунта мессенджера
 * 
 * Все поля опциональны - можно обновлять только нужные поля.
 */
export const updateMessengerAccountSchema = z
  .object({
    isEnabled: z
      .boolean()
      .optional(),

    metadata: z
      .record(z.unknown())
      .optional()
      .nullable(),
  })
  .refine(
    (data) => {
      // Проверка: хотя бы одно поле должно быть предоставлено
      return Object.keys(data).length > 0;
    },
    {
      message: 'At least one field must be provided for update',
    }
  );

/**
 * Тип для данных обновления аккаунта мессенджера
 */
export type UpdateMessengerAccountInput = z.infer<typeof updateMessengerAccountSchema>;

/**
 * Схема валидации для обновления конфигурации проверки мессенджера (ROOT only)
 */
export const updateMessengerCheckConfigSchema = z.object({
  checkIntervalSeconds: z
    .number({ required_error: 'Check interval is required' })
    .int({ message: 'Check interval must be an integer' })
    .positive({ message: 'Check interval must be positive' })
    .min(60, { message: 'Check interval must be at least 60 seconds' })
    .max(3600, { message: 'Check interval must not exceed 3600 seconds (1 hour)' }),

  enabled: z
    .boolean()
    .optional()
    .default(true),
});

/**
 * Тип для данных обновления конфигурации проверки
 */
export type UpdateMessengerCheckConfigInput = z.infer<typeof updateMessengerCheckConfigSchema>;

