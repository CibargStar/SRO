/**
 * Jest конфигурация для frontend
 * 
 * Настройки для запуска тестов React компонентов.
 * Использует jsdom для эмуляции браузерного окружения.
 */

export default {
  preset: 'ts-jest', // Использование ts-jest для TypeScript
  testEnvironment: 'jsdom', // Браузерное окружение (jsdom)
  roots: ['<rootDir>/src'], // Корневая директория для поиска тестов
  testMatch: ['**/__tests__/**/*.ts', '**/__tests__/**/*.tsx', '**/?(*.)+(spec|test).ts', '**/?(*.)+(spec|test).tsx'],
  transform: {
    '^.+\\.tsx?$': 'ts-jest', // Трансформация TypeScript и TSX файлов
  },
  // Алиасы путей (соответствуют tsconfig.json)
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1', // @/ -> src/
  },
  // Файл с настройками перед запуском тестов (например, jest-dom matchers)
  setupFilesAfterEnv: ['<rootDir>/src/setupTests.ts'],
  // Файлы для сбора coverage (исключая тесты и типы)
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/*.test.{ts,tsx}',
    '!src/**/*.spec.{ts,tsx}',
  ],
  coverageDirectory: 'coverage', // Директория для отчетов coverage
  coverageReporters: ['text', 'lcov', 'html'], // Форматы отчетов
};

