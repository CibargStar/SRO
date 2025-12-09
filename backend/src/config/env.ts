/**
 * Конфигурация переменных окружения
 * 
 * Загружает и валидирует переменные окружения с помощью dotenv-safe (если есть .env.example)
 * или обычного dotenv (для production без .env.example).
 * Все переменные валидируются через Zod схему для типобезопасности.
 * 
 * @module config/env
 */

import { z } from 'zod';
import { existsSync } from 'fs';

// Используем dotenv-safe если есть .env.example (для разработки),
// иначе обычный dotenv (для production в Docker)
if (existsSync('.env.example')) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-assignment
  const dotenvSafe = require('dotenv-safe');
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
  dotenvSafe.config({
    allowEmptyValues: false,
    example: '.env.example',
  });
} else {
  // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
  require('dotenv').config();
}

/**
 * Валидация формата времени для JWT токенов
 * Принимает строку в формате: число + единица времени (s, m, h, d)
 * Примеры: "15m", "1h", "7d", "3600s"
 */
const jwtExpiresInSchema = z
  .string()
  .regex(/^\d+[smhd]$/, {
    message: 'Должен быть в формате: число + единица времени (s=секунды, m=минуты, h=часы, d=дни). Пример: "15m", "7d"',
  })
  .refine(
    (val: string) => {
      const match = val.match(/^(\d+)([smhd])$/);
      if (!match) {
        return false;
      }
      const [, number, unit] = match;
      const num = parseInt(number, 10);
      // Минимум 1 секунда, максимум 365 дней
      const maxSeconds = unit === 's' ? num : unit === 'm' ? num * 60 : unit === 'h' ? num * 3600 : num * 86400;
      return maxSeconds >= 1 && maxSeconds <= 31536000; // 365 дней в секундах
    },
    {
      message: 'Время жизни токена должно быть от 1 секунды до 365 дней',
    }
  );

/**
 * Валидация пароля root-пользователя
 * Требования безопасности:
 * - Минимум 12 символов
 * - Должен содержать заглавные и строчные буквы
 * - Должен содержать цифры
 * - Должен содержать специальные символы
 */
const rootPasswordSchema = z
  .string()
  .min(12, { message: 'Пароль должен содержать минимум 12 символов' })
  .regex(/[A-Z]/, { message: 'Пароль должен содержать хотя бы одну заглавную букву' })
  .regex(/[a-z]/, { message: 'Пароль должен содержать хотя бы одну строчную букву' })
  .regex(/[0-9]/, { message: 'Пароль должен содержать хотя бы одну цифру' })
  .regex(/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/, {
    message: 'Пароль должен содержать хотя бы один специальный символ (!@#$%^&* и т.д.)',
  });

/**
 * Валидация JWT секрета
 * Требования:
 * - Минимум 32 символа (рекомендация OWASP)
 * - Должен быть достаточно сложным
 */
const jwtSecretSchema = z
  .string()
  .min(32, { message: 'JWT секрет должен содержать минимум 32 символа для безопасности' })
  .refine(
    (val: string) => {
      // Проверка на достаточную энтропию (не все одинаковые символы)
      const uniqueChars = new Set(val).size;
      return uniqueChars >= 8; // Минимум 8 уникальных символов
    },
    {
      message: 'JWT секрет должен содержать достаточно разнообразные символы',
    }
  );

/**
 * Базовая схема переменных окружения (без cross-field валидации)
 */
const baseEnvSchema = z.object({
  // Базовые настройки
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform(Number).pipe(z.number().int().positive()),
  DATABASE_URL: z.string().min(1, { message: 'DATABASE_URL не может быть пустым' }),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),

  // Frontend URL для CORS
  FRONTEND_URL: z
    .string()
    .url({ message: 'FRONTEND_URL должен быть валидным URL' })
    .default('http://localhost:5173'),

  // Авторизация
  ROOT_EMAIL: z.string().email({ message: 'ROOT_EMAIL должен быть валидным email адресом' }),
  ROOT_PASSWORD: rootPasswordSchema,
  JWT_ACCESS_SECRET: jwtSecretSchema,
  JWT_REFRESH_SECRET: jwtSecretSchema,
  JWT_ACCESS_EXPIRES_IN: jwtExpiresInSchema,
  JWT_REFRESH_EXPIRES_IN: jwtExpiresInSchema,

  // Интеграции
  TELEGRAM_BOT_TOKEN: z.string().optional(),
});

/**
 * Тип для базовой схемы (используется в refine)
 */
type BaseEnvType = z.infer<typeof baseEnvSchema>;

/**
 * Схема валидации переменных окружения
 * 
 * @property NODE_ENV - Режим работы: development, production, test
 * @property PORT - Порт сервера (положительное число)
 * @property DATABASE_URL - URL базы данных (строка, минимум 1 символ)
 * @property LOG_LEVEL - Уровень логирования: error, warn, info, debug
 * @property ROOT_EMAIL - Email root-пользователя (валидный email)
 * @property ROOT_PASSWORD - Пароль root-пользователя (сложный пароль, минимум 12 символов)
 * @property JWT_ACCESS_SECRET - Секретный ключ для Access токенов (минимум 32 символа)
 * @property JWT_REFRESH_SECRET - Секретный ключ для Refresh токенов (минимум 32 символа, должен отличаться от ACCESS_SECRET)
 * @property JWT_ACCESS_EXPIRES_IN - Время жизни Access токена (формат: "15m", "1h" и т.д.)
 * @property JWT_REFRESH_EXPIRES_IN - Время жизни Refresh токена (формат: "7d", должен быть больше ACCESS_EXPIRES_IN)
 */
const envSchema = baseEnvSchema
  .refine(
    (data: BaseEnvType) => {
      // Проверка: JWT секреты не должны совпадать
      return data.JWT_ACCESS_SECRET !== data.JWT_REFRESH_SECRET;
    },
    {
      message: 'JWT_ACCESS_SECRET и JWT_REFRESH_SECRET не должны совпадать',
      path: ['JWT_REFRESH_SECRET'], // Ошибка будет привязана к JWT_REFRESH_SECRET
    }
  )
  .refine(
    (data: BaseEnvType) => {
      // Проверка: Refresh токен должен жить дольше Access токена
      const parseTime = (timeStr: string): number => {
        const match = timeStr.match(/^(\d+)([smhd])$/);
        if (!match) {
          return 0;
        }
        const [, number, unit] = match;
        const num = parseInt(number, 10);
        const multipliers: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
        return num * (multipliers[unit] ?? 1);
      };

      const accessSeconds = parseTime(data.JWT_ACCESS_EXPIRES_IN);
      const refreshSeconds = parseTime(data.JWT_REFRESH_EXPIRES_IN);

      return refreshSeconds > accessSeconds;
    },
    {
      message: 'JWT_REFRESH_EXPIRES_IN должен быть больше JWT_ACCESS_EXPIRES_IN',
      path: ['JWT_REFRESH_EXPIRES_IN'],
    }
  );

/**
 * Валидированные переменные окружения
 * Типы автоматически выводятся из схемы Zod
 * 
 * @throws {ZodError} Если валидация не прошла - приложение не запустится
 * 
 * @example
 * ```typescript
 * import { env } from './config';
 * console.log(env.ROOT_EMAIL); // Типобезопасный доступ
 * ```
 */
export const env = envSchema.parse(process.env);

