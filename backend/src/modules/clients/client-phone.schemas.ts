/**
 * Zod схемы валидации для модуля управления телефонами клиентов
 * 
 * Определяет схемы валидации для входных данных API endpoints управления телефонами клиентов.
 * Используется для типобезопасной валидации запросов.
 * 
 * @module modules/clients/client-phone.schemas
 */

import { z } from 'zod';

/**
 * Валидация номера телефона
 * 
 * Поддерживает различные форматы:
 * - +7 (999) 123-45-67
 * - 8 (999) 123-45-67
 * - +79991234567
 * - 89991234567
 * - (999) 123-45-67
 * - 999-123-45-67
 * 
 * Минимум 10 цифр, максимум 15 цифр (международный формат)
 */
const phoneRegex = /^[\+]?[(]?[0-9]{1,4}[)]?[-\s\.]?[(]?[0-9]{1,4}[)]?[-\s\.]?[0-9]{1,9}$/;

/**
 * Enum для статусов мессенджеров
 */
export const MessengerStatusEnum = z.enum(['Valid', 'Invalid', 'Unknown'], {
  errorMap: () => ({ message: 'Status must be Valid, Invalid, or Unknown' }),
});

/**
 * Схема валидации для создания телефона клиента
 * 
 * @property phone - Номер телефона (обязательно, валидный формат)
 * @property whatsAppStatus - Статус WhatsApp (опционально, по умолчанию Unknown)
 * @property telegramStatus - Статус Telegram (опционально, по умолчанию Unknown)
 * 
 * @example
 * ```typescript
 * const phoneData = createClientPhoneSchema.parse(req.body);
 * ```
 */
export const createClientPhoneSchema = z.object({
  phone: z
    .string({ required_error: 'Phone is required' })
    .min(1, { message: 'Phone cannot be empty' })
    .max(20, { message: 'Phone must be at most 20 characters long' })
    .trim()
    .regex(phoneRegex, { message: 'Invalid phone number format' }),
  whatsAppStatus: MessengerStatusEnum.optional().default('Unknown'),
  telegramStatus: MessengerStatusEnum.optional().default('Unknown'),
});

/**
 * Тип для данных создания телефона клиента
 */
export type CreateClientPhoneInput = z.infer<typeof createClientPhoneSchema>;

/**
 * Схема валидации для обновления телефона клиента
 * 
 * @property phone - Номер телефона (опционально, валидный формат)
 * @property whatsAppStatus - Статус WhatsApp (опционально)
 * @property telegramStatus - Статус Telegram (опционально)
 * 
 * @example
 * ```typescript
 * const updateData = updateClientPhoneSchema.parse(req.body);
 * ```
 */
export const updateClientPhoneSchema = z
  .object({
    phone: z
      .string()
      .min(1, { message: 'Phone cannot be empty if provided' })
      .max(20, { message: 'Phone must be at most 20 characters long' })
      .trim()
      .regex(phoneRegex, { message: 'Invalid phone number format' })
      .optional(),
    whatsAppStatus: MessengerStatusEnum.optional(),
    telegramStatus: MessengerStatusEnum.optional(),
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
 * Тип для данных обновления телефона клиента
 */
export type UpdateClientPhoneInput = z.infer<typeof updateClientPhoneSchema>;

