/**
 * Jest конфигурация для backend
 * 
 * Настройки для запуска unit и integration тестов.
 * Использует ts-jest для поддержки TypeScript.
 */

module.exports = {
  preset: 'ts-jest', // Использование ts-jest для TypeScript
  testEnvironment: 'node', // Node.js окружение (не браузер)
  roots: ['<rootDir>/src'], // Корневая директория для поиска тестов
  testMatch: ['**/*.spec.ts', '**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'], // Паттерны для поиска тестов
  transform: {
    '^.+\\.ts$': 'ts-jest', // Трансформация TypeScript файлов
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1', // Алиас для импортов (опционально)
  },
  // Файлы для сбора coverage (исключая тесты и типы)
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/*.test.ts',
    '!src/**/*.spec.ts',
    '!src/tests/**', // Исключаем тестовые утилиты
  ],
  coverageDirectory: 'coverage', // Директория для отчетов coverage
  coverageReporters: ['text', 'lcov', 'html'], // Форматы отчетов
  // Настройки для тестовой среды
  setupFilesAfterEnv: ['<rootDir>/src/tests/setup.ts'], // Файл для глобальной настройки тестов
  // Игнорируем node_modules и dist
  testPathIgnorePatterns: ['/node_modules/', '/dist/'],
  // Время ожидания для тестов (30 секунд для интеграционных тестов)
  testTimeout: 30000,
};

