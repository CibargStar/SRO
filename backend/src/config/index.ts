/**
 * Конфигурация приложения
 * 
 * Централизованный экспорт всех конфигурационных модулей:
 * - env: переменные окружения (валидированные)
 * - logger: Winston logger для логирования
 * - prisma: Prisma Client для работы с БД
 */

export { env } from './env';
export { default as logger } from './logger';
export { default as prisma } from './database';
export { swaggerSpec } from './swagger';
