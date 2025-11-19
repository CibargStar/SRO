/**
 * Глобальная настройка для тестов
 * 
 * Выполняется перед запуском всех тестов.
 * Используется для настройки тестового окружения.
 * 
 * @module tests/setup
 */

/**
 * Настройка переменных окружения для тестов
 * 
 * Устанавливает тестовые значения для переменных окружения,
 * если они не установлены явно.
 */
// Используем in-memory SQLite для тестов по умолчанию
process.env.TEST_DATABASE_URL ??= 'file::memory:?cache=shared';

process.env.TEST_ROOT_EMAIL ??= 'test-root@example.com';

process.env.TEST_ROOT_PASSWORD ??= 'TestRootPassword123!@#';

// Устанавливаем NODE_ENV в test, если не установлен
process.env.NODE_ENV ??= 'test';

// Устанавливаем минимальные значения для JWT секретов (для тестов)
process.env.JWT_ACCESS_SECRET ??= 'test-access-secret-min-32-chars-long-for-testing-only';

process.env.JWT_REFRESH_SECRET ??= 'test-refresh-secret-min-32-chars-long-for-testing-only';

// Устанавливаем значения для JWT expires
process.env.JWT_ACCESS_EXPIRES_IN ??= '15m';

process.env.JWT_REFRESH_EXPIRES_IN ??= '7d';

// Устанавливаем FRONTEND_URL для тестов
process.env.FRONTEND_URL ??= 'http://localhost:5173';

/**
 * Примечание: Таймаут для тестов настроен в jest.config.js (testTimeout: 30000)
 * Здесь настраиваем только переменные окружения
 */

