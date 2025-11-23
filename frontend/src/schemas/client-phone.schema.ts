/**
 * Zod схемы валидации для управления телефонами клиентов
 * 
 * Схемы валидации для форм создания и редактирования телефонов клиентов на фронтенде.
 * Соответствуют backend схемам для консистентности.
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
 */
const phoneRegex = /^[\+]?[(]?[0-9]{1,4}[)]?[-\s\.]?[(]?[0-9]{1,4}[)]?[-\s\.]?[0-9]{1,9}$/;

/**
 * Enum для статусов мессенджеров
 */
const MessengerStatusEnum = z.enum(['Valid', 'Invalid', 'Unknown'], {
  errorMap: () => ({ message: 'Статус должен быть Valid, Invalid или Unknown' }),
});

/**
 * Схема валидации для создания телефона клиента
 */
export const createClientPhoneSchema = z.object({
  phone: z
    .string({ required_error: 'Номер телефона обязателен' })
    .min(1, { message: 'Номер телефона не может быть пустым' })
    .max(20, { message: 'Номер телефона не должен превышать 20 символов' })
    .trim()
    .regex(phoneRegex, { message: 'Неверный формат номера телефона' }),
  whatsAppStatus: MessengerStatusEnum.optional().default('Unknown'),
  telegramStatus: MessengerStatusEnum.optional().default('Unknown'),
});

/**
 * Тип для данных создания телефона клиента
 */
export type CreateClientPhoneFormData = z.infer<typeof createClientPhoneSchema>;

/**
 * Схема валидации для обновления телефона клиента
 */
export const updateClientPhoneSchema = z
  .object({
    phone: z
      .string()
      .min(1, { message: 'Номер телефона не может быть пустым, если указан' })
      .max(20, { message: 'Номер телефона не должен превышать 20 символов' })
      .trim()
      .regex(phoneRegex, { message: 'Неверный формат номера телефона' })
      .optional(),
    whatsAppStatus: MessengerStatusEnum.optional(),
    telegramStatus: MessengerStatusEnum.optional(),
  })
  .refine(
    (data) => {
      return Object.keys(data).length > 0;
    },
    {
      message: 'Хотя бы одно поле должно быть заполнено для обновления',
      path: ['root'],
    }
  );

/**
 * Тип для данных обновления телефона клиента
 */
export type UpdateClientPhoneFormData = z.infer<typeof updateClientPhoneSchema>;

