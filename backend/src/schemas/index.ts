/**
 * Zod схемы валидации
 * 
 * Определяет схемы валидации для различных сущностей приложения.
 * Используется для валидации входных данных API и типизации.
 */

import { z } from 'zod';

/**
 * Пример схемы валидации
 * 
 * Демонстрирует использование Zod для создания схем валидации.
 * Замените на реальные схемы для вашего приложения.
 * 
 * @example
 * ```typescript
 * const user = exampleSchema.parse({ name: 'John', email: 'john@example.com' });
 * ```
 */
export const exampleSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
});

/**
 * Тип, выведенный из exampleSchema
 * Используется для типобезопасности в TypeScript
 */
export type ExampleType = z.infer<typeof exampleSchema>;

