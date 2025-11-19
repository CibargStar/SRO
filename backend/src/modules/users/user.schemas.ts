/**
 * Zod схемы валидации для модуля управления пользователями
 * 
 * Определяет схемы валидации для входных данных API endpoints управления пользователями.
 * Используется для типобезопасной валидации запросов.
 * 
 * @module modules/users/user.schemas
 */

import { z } from 'zod';

/**
 * Схема валидации для создания пользователя
 * 
 * @property email - Email пользователя (валидный email, не пустой, уникальный)
 * @property password - Пароль пользователя (строка, не пустая, минимум 12 символов)
 * @property name - Имя пользователя (опционально, строка, нормальная длина)
 * 
 * Используется только ROOT пользователем для создания новых пользователей.
 * 
 * @example
 * ```typescript
 * const userData = createUserSchema.parse(req.body);
 * // userData.email, userData.password, userData.name типобезопасны
 * ```
 */
export const createUserSchema = z.object({
  email: z
    .string({ required_error: 'Email is required' })
    .min(1, { message: 'Email cannot be empty' })
    .email({ message: 'Invalid email format' })
    .toLowerCase() // Нормализация email
    .trim(), // Удаляем пробелы

  password: z
    .string({ required_error: 'Password is required' })
    .min(1, { message: 'Password cannot be empty' })
    .min(12, { message: 'Password must be at least 12 characters long' })
    .regex(/[A-Z]/, { message: 'Password must contain at least one uppercase letter' })
    .regex(/[a-z]/, { message: 'Password must contain at least one lowercase letter' })
    .regex(/[0-9]/, { message: 'Password must contain at least one number' })
    .regex(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/, {
      message: 'Password must contain at least one special character',
    }),

  name: z
    .string()
    .min(1, { message: 'Name cannot be empty if provided' })
    .max(100, { message: 'Name must be at most 100 characters long' })
    .trim()
    .optional(),
});

/**
 * Тип для данных создания пользователя, выведенный из createUserSchema
 * Используется для типобезопасности в контроллерах
 */
export type CreateUserInput = z.infer<typeof createUserSchema>;

/**
 * Схема валидации для обновления пользователя
 * 
 * Все поля опциональны - можно обновлять только нужные поля.
 * 
 * @property email - Email пользователя (опционально, валидный email)
 * @property password - Пароль пользователя (опционально, минимум 12 символов)
 * @property name - Имя пользователя (опционально, строка)
 * @property isActive - Активен ли пользователь (опционально, boolean)
 * 
 * Используется только ROOT пользователем для обновления данных пользователей.
 * 
 * @example
 * ```typescript
 * const updateData = updateUserSchema.parse(req.body);
 * // updateData.email, updateData.password и т.д. типобезопасны и опциональны
 * ```
 */
export const updateUserSchema = z
  .object({
    email: z
      .string()
      .min(1, { message: 'Email cannot be empty if provided' })
      .email({ message: 'Invalid email format' })
      .toLowerCase() // Нормализация email
      .trim()
      .optional(),

    password: z
      .string()
      .min(1, { message: 'Password cannot be empty if provided' })
      .min(12, { message: 'Password must be at least 12 characters long' })
      .regex(/[A-Z]/, { message: 'Password must contain at least one uppercase letter' })
      .regex(/[a-z]/, { message: 'Password must contain at least one lowercase letter' })
      .regex(/[0-9]/, { message: 'Password must contain at least one number' })
      .regex(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/, {
        message: 'Password must contain at least one special character',
      })
      .optional(),

    name: z
      .string()
      .min(1, { message: 'Name cannot be empty if provided' })
      .max(100, { message: 'Name must be at most 100 characters long' })
      .trim()
      .optional(),

    isActive: z.boolean().optional(),
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
 * Тип для данных обновления пользователя, выведенный из updateUserSchema
 * Используется для типобезопасности в контроллерах
 */
export type UpdateUserInput = z.infer<typeof updateUserSchema>;

