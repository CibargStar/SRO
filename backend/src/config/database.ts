/**
 * Prisma Client - подключение к базе данных
 * 
 * Настраивает Prisma Client с логированием запросов для отладки.
 * Все SQL запросы логируются через Winston logger на уровне debug.
 */

import { PrismaClient } from '@prisma/client';
import logger from './logger';

/**
 * Prisma Client instance
 * 
 * Настроен для логирования:
 * - query: все SQL запросы (через события)
 * - error: ошибки в stdout
 * - warn: предупреждения в stdout
 */
// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
const prisma = new PrismaClient({
  log: [
    { level: 'query', emit: 'event' },
    { level: 'error', emit: 'stdout' },
    { level: 'warn', emit: 'stdout' },
  ],
});

// Логирование всех SQL запросов для отладки
// eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
prisma.$on('query', (e: { query: string; params: string; duration: number }) => {
  logger.debug({
    query: e.query,
    params: e.params,
    duration: `${e.duration}ms`,
  });
});

export default prisma;

