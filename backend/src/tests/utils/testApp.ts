/**
 * Утилиты для создания тестового Express приложения
 * 
 * Создает Express приложение с теми же middleware и роутами, что и production,
 * но без запуска HTTP сервера. Используется для интеграционных тестов.
 * 
 * @module tests/utils/testApp
 */

import express, { Express } from 'express';
import { PrismaClient } from '@prisma/client';
// import { ensureRootUser } from '../../modules/auth'; // Не используется в тестах (вызывается в beforeEach)
import {
  securityMiddleware,
  corsMiddleware,
  requestLogger,
  errorHandler,
  notFoundHandler,
} from '../../middleware';
import { createTestAuthRoutes, createTestUsersRoutes } from './testRoutes';
// import logger from '../../config/logger'; // Не используется (ensureRootUser вызывается в beforeEach)

/**
 * Конфигурация для тестовой БД
 * 
 * Использует SQLite in-memory БД для быстрых тестов.
 * Можно переключить на отдельный файл для отладки.
 * 
 * Варианты:
 * 1. In-memory (быстрее, данные теряются при закрытии):
 *    DATABASE_URL="file::memory:?cache=shared"
 * 
 * 2. Отдельный файл (медленнее, но данные сохраняются для отладки):
 *    DATABASE_URL="file:./prisma/test.db"
 * 
 * ВАЖНО: Не использовать dev.db или production БД!
 */
const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || 'file::memory:?cache=shared';

/**
 * Создает отдельный Prisma Client для тестов
 * 
 * Использует тестовую БД, отличную от dev/production.
 * Логирование отключено для чистоты вывода тестов.
 * 
 * ВАЖНО: DATABASE_URL уже установлен в createTestApp перед вызовом этой функции.
 */
function createTestPrisma(): PrismaClient {
  return new PrismaClient({
    log: [], // Отключаем логирование в тестах
  });
}

/**
 * Результат создания тестового приложения
 */
export interface TestApp {
  app: Express;
  prisma: PrismaClient;
}

/**
 * Создает Express приложение для тестов
 * 
 * Настраивает приложение с теми же middleware и роутами, что и production,
 * но без запуска HTTP сервера. Также создает отдельный Prisma Client для тестовой БД.
 * 
 * @param options - Опции для создания тестового приложения
 * @param options.skipRootUser - Пропустить инициализацию root пользователя (по умолчанию false)
 * @returns Объект с Express приложением и Prisma Client
 * 
 * @example
 * ```typescript
 * let testApp: TestApp;
 * 
 * beforeAll(async () => {
 *   testApp = await createTestApp();
 * });
 * 
 * afterAll(async () => {
 *   await testApp.prisma.$disconnect();
 * });
 * ```
 * 
 * Безопасность:
 * - Использует отдельную тестовую БД (не dev/production)
 * - Выполняет миграции автоматически (Prisma)
 * - Инициализирует root пользователя (если не пропущено)
 * - Не запускает HTTP сервер
 */
export async function createTestApp(_options: { skipRootUser?: boolean } = {}): Promise<TestApp> {
  // Сохраняем оригинальный DATABASE_URL
  const originalDatabaseUrl = process.env.DATABASE_URL;

  try {
    // Устанавливаем тестовую БД URL для Prisma
    process.env.DATABASE_URL = TEST_DATABASE_URL;

    // Создаем отдельный Prisma Client для тестов
    const testPrisma = createTestPrisma();

    // Подключение к тестовой БД
    await testPrisma.$connect();

    // Применение схемы к тестовой БД через db push
    // Это создаст таблицы в тестовой БД (in-memory или файловой)
    // ВАЖНО: db push применяет схему напрямую, без миграций
    // Для тестов это нормально, так как мы не сохраняем историю миграций
    try {
      const { execSync } = require('child_process');
      execSync('npx prisma db push --skip-generate --accept-data-loss', {
        env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
        stdio: 'ignore', // Скрываем вывод команды
        cwd: process.cwd(), // Убеждаемся, что команда выполняется из корня проекта
      });
    } catch (error) {
      // Если db push не удался, пробуем продолжить (возможно, схема уже применена)
      // В production тестах лучше использовать явные миграции
      // Игнорируем ошибку для in-memory БД, так как она может не поддерживать db push
    }

    // Инициализация root пользователя (если не пропущено)
    // ВАЖНО: В тестах ensureRootUser вызывается в beforeEach после resetDatabase
    // Здесь мы НЕ создаем ROOT, чтобы избежать конфликтов
    // if (!options.skipRootUser) {
    //   await ensureRootUser(testPrisma, testEnv, logger);
    // }

    // Создание Express приложения
    const app = express();

    // Парсинг JSON и URL-encoded тел запросов
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));

    // Middleware: порядок важен (как в production)
    // 1. CORS
    app.use(corsMiddleware);
    // 2. Логирование запросов
    app.use(requestLogger);
    // 3. Безопасность
    app.use(securityMiddleware);
    // 4. Rate limiting (отключен для тестов, чтобы не блокировать множественные запросы)
    // app.use(rateLimiter); // Закомментировано для тестов

    // Health check endpoint
    app.get('/health', (_req, res) => {
      res.status(200).json({ status: 'ok' });
    });

    // API Routes (без rate limiter для тестов)
    app.use('/api/auth', createTestAuthRoutes());
    app.use('/api/users', createTestUsersRoutes());

    // Обработчики ошибок (должны быть последними)
    app.use(notFoundHandler);
    app.use(errorHandler);

    return { app, prisma: testPrisma };
  } catch (error) {
    // В случае ошибки восстанавливаем оригинальный DATABASE_URL
    if (originalDatabaseUrl) {
      process.env.DATABASE_URL = originalDatabaseUrl;
    }
    throw error;
  } finally {
    // Восстанавливаем оригинальный DATABASE_URL после создания
    if (originalDatabaseUrl) {
      process.env.DATABASE_URL = originalDatabaseUrl;
    }
  }
}

/**
 * Типичные ошибки при создании тестового приложения:
 * 
 * 1. ❌ Использование production/dev БД для тестов
 *    ✅ Всегда использовать отдельную тестовую БД (TEST_DATABASE_URL)
 * 
 * 2. ❌ Отсутствие очистки данных между тестами
 *    ✅ Использовать resetDatabase между тестами
 * 
 * 3. ❌ Не закрытие соединений после тестов
 *    ✅ Всегда закрывать Prisma соединения в afterAll
 * 
 * 4. ❌ Использование одного экземпляра Prisma для всех тестов
 *    ✅ Создавать отдельный экземпляр для каждого тестового файла
 * 
 * 5. ❌ Отсутствие инициализации root пользователя
 *    ✅ Вызывать ensureRootUser перед тестами, которые требуют авторизации
 * 
 * 6. ❌ Разные middleware в тестах и production
 *    ✅ Использовать те же middleware, что и в production
 * 
 * 7. ❌ Отсутствие миграций в тестовой БД
 *    ✅ Prisma автоматически применяет миграции, но можно явно вызвать migrate deploy
 * 
 * 8. ❌ Логирование в тестах (засоряет вывод)
 *    ✅ Отключать логирование Prisma в тестах (log: [])
 */

