/**
 * Инициализация root-пользователя
 * 
 * Гарантирует наличие одного ROOT пользователя в системе при старте приложения.
 * Функция идемпотентна - можно вызывать многократно без побочных эффектов.
 * 
 * @module modules/auth/ensureRootUser
 */

import { PrismaClient, UserRole } from '@prisma/client';
import type { Logger } from 'winston';
import { hashPassword } from './password.service';

/**
 * Тип для конфигурации окружения
 * Используется для типобезопасного доступа к env переменным
 */
type EnvConfig = {
  ROOT_EMAIL: string;
  ROOT_PASSWORD: string;
};

/**
 * Гарантирует наличие root-пользователя в системе
 * 
 * Логика:
 * 1. Проверяет наличие пользователя с ролью ROOT
 * 2. Если ROOT существует - ничего не делает (идемпотентность)
 * 3. Если ROOT не существует - создает нового пользователя из env переменных
 * 
 * @param prisma - Экземпляр Prisma Client для работы с БД
 * @param env - Конфигурация окружения с ROOT_EMAIL и ROOT_PASSWORD
 * @param logger - Winston logger для логирования
 * 
 * @throws {Error} Если не удалось создать root-пользователя
 * 
 * @example
 * ```typescript
 * import { prisma, env, logger } from './config';
 * import { ensureRootUser } from './modules/auth/ensureRootUser';
 * 
 * await ensureRootUser(prisma, env, logger);
 * ```
 * 
 * Безопасность:
 * - Не создает второго ROOT (проверка перед созданием)
 * - Не логирует пароль из env
 * - Идемпотентна (безопасно вызывать многократно)
 * - Вызывается ДО старта HTTP сервера
 */
export async function ensureRootUser(
  prisma: PrismaClient,
  env: EnvConfig,
  logger: Logger
): Promise<void> {
  try {
    // Проверяем наличие ROOT пользователя
    const existingRoot = await prisma.user.findFirst({
      where: {
        role: UserRole.ROOT,
      },
      select: {
        id: true,
        email: true,
        isActive: true,
      },
    });

    if (existingRoot) {
      // ROOT уже существует - ничего не делаем
      logger.info('Root user already exists', {
        email: existingRoot.email,
        isActive: existingRoot.isActive,
      });
      return;
    }

    // ROOT не найден - создаем нового
    logger.info('Root user not found, creating new root user', {
      email: env.ROOT_EMAIL,
    });

    // Хешируем пароль (ВАЖНО: не логируем пароль!)
    const passwordHash = await hashPassword(env.ROOT_PASSWORD);

    // Создаем ROOT пользователя
    const rootUser = await prisma.user.create({
      data: {
        email: env.ROOT_EMAIL,
        passwordHash,
        role: UserRole.ROOT,
        isActive: true,
        passwordVersion: 1, // Версия пароля (для будущей миграции алгоритма)
      },
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    // Логируем успешное создание (БЕЗ пароля и хеша!)
    logger.info('Root user created successfully', {
      id: rootUser.id,
      email: rootUser.email,
      role: rootUser.role,
      isActive: rootUser.isActive,
      createdAt: rootUser.createdAt,
    });
  } catch (error) {
    // Логируем ошибку без деталей пароля
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to ensure root user', {
      error: errorMessage,
      email: env.ROOT_EMAIL,
      // НЕ логируем ROOT_PASSWORD!
    });

    // Пробрасываем ошибку дальше - приложение не должно стартовать без ROOT
    throw new Error(`Failed to initialize root user: ${errorMessage}`);
  }
}

/**
 * Типичные ошибки при инициализации root-пользователя:
 * 
 * 1. ❌ Создание нескольких ROOT пользователей
 *    ✅ Проверять наличие ROOT перед созданием (findFirst с where: { role: ROOT })
 * 
 * 2. ❌ Логирование пароля из env
 *    ✅ Никогда не логировать ROOT_PASSWORD, даже в debug режиме
 * 
 * 3. ❌ Вызов ensureRootUser после старта HTTP сервера
 *    ✅ Вызывать ДО app.listen() в bootstrap функции
 * 
 * 4. ❌ Отсутствие обработки ошибок
 *    ✅ Обрабатывать ошибки и не позволять приложению стартовать без ROOT
 * 
 * 5. ❌ Использование синхронных операций
 *    ✅ Все операции асинхронные (не блокируют event loop)
 * 
 * 6. ❌ Создание ROOT с невалидными данными
 *    ✅ Использовать валидированные env переменные (через Zod schema)
 * 
 * 7. ❌ Отсутствие идемпотентности
 *    ✅ Функция должна быть безопасной для многократного вызова
 * 
 * 8. ❌ Логирование хеша пароля
 *    ✅ Не логировать passwordHash (даже хеш не должен попадать в логи)
 * 
 * 9. ❌ Создание ROOT с isActive = false
 *    ✅ Всегда создавать ROOT с isActive = true
 * 
 * 10. ❌ Отсутствие проверки на race condition
 *     ✅ Использовать транзакцию или уникальный индекс (email уже unique)
 * 
 * 11. ❌ Создание ROOT без passwordVersion
 *     ✅ Устанавливать passwordVersion для будущей миграции алгоритма
 * 
 * 12. ❌ Игнорирование ошибок создания
 *     ✅ Пробрасывать ошибки - приложение не должно работать без ROOT
 */

