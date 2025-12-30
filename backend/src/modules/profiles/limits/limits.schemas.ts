/**
 * Zod схемы валидации для модуля управления лимитами профилей
 * 
 * Определяет схемы валидации для входных данных API endpoints управления лимитами.
 * 
 * @module modules/profiles/limits/limits.schemas
 */

import { z } from 'zod';

/**
 * Схема валидации для установки лимитов профилей
 * 
 * @property maxProfiles - Максимальное количество профилей (обязательно, минимум 0)
 * @property maxCpuPerProfile - Максимальное использование CPU на профиль (0-1, опционально)
 * @property maxMemoryPerProfile - Максимальное использование памяти на профиль в MB (опционально)
 * @property maxNetworkPerProfile - Максимальная скорость сети на профиль в KB/s (опционально)
 */
export const setProfileLimitsSchema = z.object({
  maxProfiles: z
    .number()
    .int()
    .nonnegative({ message: 'maxProfiles must be non-negative' })
    .min(0, { message: 'maxProfiles must be at least 0' }),

  maxCpuPerProfile: z
    .number()
    .min(0, { message: 'maxCpuPerProfile must be at least 0' })
    .max(1, { message: 'maxCpuPerProfile must be at most 1' })
    .optional()
    .nullable(),

  maxMemoryPerProfile: z
    .number()
    .int()
    .nonnegative({ message: 'maxMemoryPerProfile must be non-negative' })
    .optional()
    .nullable(),

  maxNetworkPerProfile: z
    .number()
    .int()
    .nonnegative({ message: 'maxNetworkPerProfile must be non-negative' })
    .optional()
    .nullable(),
});

/**
 * Тип для данных установки лимитов
 */
export type SetProfileLimitsInput = z.infer<typeof setProfileLimitsSchema>;









