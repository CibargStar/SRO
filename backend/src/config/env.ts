/**
 * Конфигурация переменных окружения
 * 
 * Загружает и валидирует переменные окружения с помощью dotenv-safe (если есть .env.example)
 * или обычного dotenv (для production без .env.example).
 * Все переменные валидируются через Zod схему для типобезопасности.
 */

import { z } from 'zod';
import { existsSync } from 'fs';

// Используем dotenv-safe если есть .env.example (для разработки),
// иначе обычный dotenv (для production в Docker)
if (existsSync('.env.example')) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const dotenvSafe = require('dotenv-safe');
  dotenvSafe.config({
    allowEmptyValues: false,
    example: '.env.example',
  });
} else {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('dotenv').config();
}

/**
 * Схема валидации переменных окружения
 * 
 * @property NODE_ENV - Режим работы: development, production, test
 * @property PORT - Порт сервера (положительное число)
 * @property DATABASE_URL - URL базы данных (строка, минимум 1 символ)
 * @property LOG_LEVEL - Уровень логирования: error, warn, info, debug
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform(Number).pipe(z.number().int().positive()),
  DATABASE_URL: z.string().min(1),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
});

/**
 * Валидированные переменные окружения
 * Типы автоматически выводятся из схемы Zod
 */
export const env = envSchema.parse(process.env);

