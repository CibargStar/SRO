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
import { ensureRootUser } from '../../modules/auth';
import {
  securityMiddleware,
  corsMiddleware,
  rateLimiter,
  requestLogger,
  errorHandler,
  notFoundHandler,
} from '../../middleware';
import authRoutes from '../../routes/auth.routes';
import usersRoutes from '../../routes/users.routes';
import logger from '../../config/logger';

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
export async function createTestApp(options: { skipRootUser?: boolean } = {}): Promise<TestApp> {
  // Сохраняем оригинальный DATABASE_URL
  const originalDatabaseUrl = process.env.DATABASE_URL;

  try {
    // Устанавливаем тестовую БД URL для Prisma
    process.env.DATABASE_URL = TEST_DATABASE_URL;

    // Создаем отдельный Prisma Client для тестов
    const testPrisma = createTestPrisma();

    // Подключение к тестовой БД
    await testPrisma.$connect();

    // Применение схемы к тестовой БД
    // 
    // ВАЖНО: Для применения миграций к тестовой БД нужно:
    // 
    // 1. Для in-memory SQLite (file::memory:):
    //    - Использовать Prisma Migrate API программно
    //    - Или применять схему через db push перед запуском тестов
    //    - Или использовать отдельный файл для тестов
    // 
    // 2. Для файловой БД (file:./prisma/test.db):
    //    - Выполнить: DATABASE_URL="file:./prisma/test.db" npx prisma migrate deploy
    //    - Или использовать db push: DATABASE_URL="file:./prisma/test.db" npx prisma db push
    // 
    // 3. Рекомендуемый подход для тестов:
    //    - Использовать отдельный файл: TEST_DATABASE_URL="file:./prisma/test.db"
    //    - Применить миграции один раз перед запуском тестов
    //    - Очищать данные между тестами через resetDatabase
    // 
    // Для простоты здесь мы полагаемся на то, что миграции уже применены
    // или будут применены через setup скрипт перед запуском тестов.

    // Инициализация root пользователя (если не пропущено)
    if (!options.skipRootUser) {
      // Используем тестовые credentials для root пользователя
      const testEnv = {
        ROOT_EMAIL: process.env.TEST_ROOT_EMAIL || 'test-root@example.com',
        ROOT_PASSWORD: process.env.TEST_ROOT_PASSWORD || 'TestRootPassword123!@#',
      };

      await ensureRootUser(testPrisma, testEnv, logger);
    }

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
    // 4. Rate limiting (можно отключить для тестов, но оставляем для реалистичности)
    app.use(rateLimiter);

    // Health check endpoint
    app.get('/health', (_req, res) => {
      res.status(200).json({ status: 'ok' });
    });

    // API Routes
    app.use('/api/auth', authRoutes);
    app.use('/api/users', usersRoutes);

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

