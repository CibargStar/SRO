/**
 * Zod схемы валидации для модуля авторизации
 * 
 * Определяет схемы валидации для входных данных API endpoints авторизации.
 * Используется для типобезопасной валидации запросов.
 * 
 * @module modules/auth/auth.schemas
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
 * const loginData = loginSchema.parse(req.body);
 * // loginData.email и loginData.password типобезопасны
 * ```
 */
export const loginSchema = z.object({
  email: z
    .string({ required_error: 'Email is required' })
    .min(1, { message: 'Email cannot be empty' })
    .email({ message: 'Invalid email format' })
    .toLowerCase() // Нормализация email (приводим к нижнему регистру)
    .trim(), // Удаляем пробелы

  password: z
    .string({ required_error: 'Password is required' })
    .min(1, { message: 'Password cannot be empty' })
    .min(8, { message: 'Password must be at least 8 characters long' }),
});

/**
 * Тип для данных входа, выведенный из loginSchema
 * Используется для типобезопасности в контроллерах
 */
export type LoginInput = z.infer<typeof loginSchema>;

/**
 * Схема валидации для обновления access токена
 * 
 * @property refreshToken - Refresh токен (не пустая строка)
 * 
 * Примечание: Refresh токен также может передаваться через httpOnly cookie,
 * в этом случае эта схема используется для валидации, если токен передается в body.
 * 
 * @example
 * ```typescript
 * const refreshData = refreshSchema.parse(req.body);
 * // refreshData.refreshToken типобезопасен
 * ```
 */
export const refreshSchema = z.object({
  refreshToken: z
    .string({ required_error: 'Refresh token is required' })
    .min(1, { message: 'Refresh token cannot be empty' })
    .trim(),
});

/**
 * Тип для данных обновления токена, выведенный из refreshSchema
 * Используется для типобезопасности в контроллерах
 */
export type RefreshInput = z.infer<typeof refreshSchema>;

