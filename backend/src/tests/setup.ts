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
if (!process.env.TEST_DATABASE_URL) {
  // Используем in-memory SQLite для тестов по умолчанию
  process.env.TEST_DATABASE_URL = 'file::memory:?cache=shared';
}

if (!process.env.TEST_ROOT_EMAIL) {
  process.env.TEST_ROOT_EMAIL = 'test-root@example.com';
}

if (!process.env.TEST_ROOT_PASSWORD) {
  process.env.TEST_ROOT_PASSWORD = 'TestRootPassword123!@#';
}

// Устанавливаем NODE_ENV в test, если не установлен
if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = 'test';
}

// Устанавливаем минимальные значения для JWT секретов (для тестов)
if (!process.env.JWT_ACCESS_SECRET) {
  process.env.JWT_ACCESS_SECRET = 'test-access-secret-min-32-chars-long-for-testing-only';
}

if (!process.env.JWT_REFRESH_SECRET) {
  process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-min-32-chars-long-for-testing-only';
}

// Устанавливаем значения для JWT expires
if (!process.env.JWT_ACCESS_EXPIRES_IN) {
  process.env.JWT_ACCESS_EXPIRES_IN = '15m';
}

if (!process.env.JWT_REFRESH_EXPIRES_IN) {
  process.env.JWT_REFRESH_EXPIRES_IN = '7d';
}

// Устанавливаем FRONTEND_URL для тестов
if (!process.env.FRONTEND_URL) {
  process.env.FRONTEND_URL = 'http://localhost:5173';
}

/**
 * Увеличиваем таймаут для Jest (для интеграционных тестов с БД)
 */
jest.setTimeout(30000);

