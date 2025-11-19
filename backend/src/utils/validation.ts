/**
 * Утилиты для валидации с Zod
 * 
 * Предоставляет функции для валидации данных с помощью Zod схем.
 */

import { z } from 'zod';

/**
 * Создает функцию валидации на основе Zod схемы
 * 
 * Возвращает функцию, которая принимает данные и валидирует их
 * против переданной схемы. Выбрасывает ZodError если валидация не прошла.
 * 
 * @template T - Тип данных после валидации
 * @param schema - Zod схема для валидации
 * @returns Функция валидации, которая принимает unknown и возвращает T
 * 
 * @example
 * ```typescript
 * const userSchema = z.object({ name: z.string(), age: z.number() });
 * const validateUser = validate(userSchema);
 * const user = validateUser({ name: 'John', age: 30 }); // Тип: { name: string, age: number }
 * ```
 */
export const validate = <T>(schema: z.ZodSchema<T>) => {
  return (data: unknown): T => {
    return schema.parse(data);
  };
};

