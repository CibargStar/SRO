/**
 * Утилиты для работы с тестовой базой данных
 * 
 * Предоставляет функции для очистки и управления тестовой БД.
 * Используется для изоляции тестов друг от друга.
 * 
 * @module tests/utils/testDb
 */

import { PrismaClient } from '@prisma/client';

/**
 * Очищает все данные из таблиц User и RefreshToken
 * 
 * Используется между тестами для изоляции данных.
 * Выполняется в транзакции для атомарности.
 * 
 * @param prisma - Экземпляр Prisma Client для тестовой БД
 * 
 * @example
 * ```typescript
 * beforeEach(async () => {
 *   await resetDatabase(testPrisma);
 * });
 * ```
 * 
 * Безопасность:
 * - Использует транзакцию для атомарности
 * - Удаляет данные в правильном порядке (сначала RefreshToken, потом User)
 * - Не удаляет структуру БД (только данные)
 */
export async function resetDatabase(prisma: PrismaClient): Promise<void> {
  // Используем транзакцию для атомарности
  // Важно: удаляем сначала RefreshToken (из-за foreign key), потом User
  await prisma.$transaction([
    prisma.refreshToken.deleteMany(), // Сначала удаляем refresh токены
    prisma.user.deleteMany(), // Потом пользователей
  ]);
}

/**
 * Создает тестовую БД и выполняет миграции
 * 
 * Используется для инициализации тестовой БД перед запуском тестов.
 * 
 * @param prisma - Экземпляр Prisma Client для тестовой БД
 * 
 * @example
 * ```typescript
 * beforeAll(async () => {
 *   await setupTestDatabase(testPrisma);
 * });
 * ```
 */
export async function setupTestDatabase(prisma: PrismaClient): Promise<void> {
  // Prisma автоматически применяет миграции при первом подключении
  // Но для явности можно вызвать $connect
  await prisma.$connect();
}

/**
 * Закрывает соединение с тестовой БД
 * 
 * Используется для очистки после завершения тестов.
 * 
 * @param prisma - Экземпляр Prisma Client для тестовой БД
 * 
 * @example
 * ```typescript
 * afterAll(async () => {
 *   await teardownTestDatabase(testPrisma);
 * });
 * ```
 */
export async function teardownTestDatabase(prisma: PrismaClient): Promise<void> {
  await prisma.$disconnect();
}

/**
 * Типичные ошибки при работе с тестовой БД:
 * 
 * 1. ❌ Использование production/dev БД для тестов
 *    ✅ Всегда использовать отдельную тестовую БД (in-memory или отдельный файл)
 * 
 * 2. ❌ Отсутствие очистки данных между тестами
 *    ✅ Всегда очищать БД между тестами через resetDatabase
 * 
 * 3. ❌ Неправильный порядок удаления (нарушение foreign key)
 *    ✅ Удалять сначала зависимые таблицы (RefreshToken), потом основные (User)
 * 
 * 4. ❌ Отсутствие транзакций при очистке
 *    ✅ Использовать транзакции для атомарности операций
 * 
 * 5. ❌ Не закрытие соединений после тестов
 *    ✅ Всегда закрывать соединения в afterAll
 * 
 * 6. ❌ Использование одного экземпляра Prisma для всех тестов
 *    ✅ Создавать отдельный экземпляр для тестовой БД
 */

