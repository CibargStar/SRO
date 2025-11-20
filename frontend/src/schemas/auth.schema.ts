/**
 * Zod схемы валидации для авторизации
 * 
 * Схемы валидации для форм авторизации на фронтенде.
 * Соответствуют backend схемам для консистентности.
 */

import { z } from 'zod';

/**
 * Схема валидации для входа в систему
 * 
 * @property email - Email пользователя (валидный email, не пустой)
 * @property password - Пароль пользователя (строка, не пустая, минимум 8 символов)
 * 
 * @example
 * ```typescript
 * const loginData = loginSchema.parse(formData);
 * ```
 */
export const loginSchema = z.object({
  email: z
    .string({ required_error: 'Email обязателен' })
    .min(1, { message: 'Email не может быть пустым' })
    .email({ message: 'Неверный формат email' })
    .toLowerCase() // Нормализация email (приводим к нижнему регистру)
    .trim(), // Удаляем пробелы

  password: z
    .string({ required_error: 'Пароль обязателен' })
    .min(1, { message: 'Пароль не может быть пустым' })
    .min(8, { message: 'Пароль должен содержать минимум 8 символов' }),
});

/**
 * Тип для данных входа, выведенный из loginSchema
 */
export type LoginFormData = z.infer<typeof loginSchema>;

