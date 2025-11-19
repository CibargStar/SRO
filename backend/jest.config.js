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
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'], // Паттерны для поиска тестов
  transform: {
    '^.+\\.ts$': 'ts-jest', // Трансформация TypeScript файлов
  },
  // Файлы для сбора coverage (исключая тесты и типы)
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/*.test.ts',
    '!src/**/*.spec.ts',
  ],
  coverageDirectory: 'coverage', // Директория для отчетов coverage
  coverageReporters: ['text', 'lcov', 'html'], // Форматы отчетов
};

