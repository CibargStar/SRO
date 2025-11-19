/**
 * BM Tools Backend - Main Entry Point
 * 
 * Настраивает Express сервер с middleware для безопасности, логирования и обработки ошибок.
 * Реализует graceful shutdown для корректного завершения работы.
 */

import express from 'express';
import { env, logger, prisma } from './config';
import {
  securityMiddleware,
  rateLimiter,
  requestLogger,
  errorHandler,
  notFoundHandler,
} from './middleware';

const app = express();

// Парсинг JSON и URL-encoded тел запросов
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Middleware: порядок важен!
// 1. Логирование запросов (должно быть первым для логирования всех запросов)
app.use(requestLogger);
// 2. Безопасность (заголовки безопасности)
app.use(securityMiddleware);
// 3. Rate limiting (ограничение количества запросов)
app.use(rateLimiter);

// Health check endpoint для мониторинга
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Обработчики ошибок должны быть последними
app.use(notFoundHandler); // 404 для несуществующих маршрутов
app.use(errorHandler); // Глобальный обработчик ошибок

// Запуск сервера
const server = app.listen(env.PORT, () => {
  logger.info(`Server is running on port ${env.PORT}`);
});

/**
 * Graceful shutdown - корректное завершение работы сервера
 * Закрывает HTTP сервер и отключается от базы данных перед выходом
 * 
 * @param signal - Сигнал завершения (SIGTERM или SIGINT)
 */
const gracefulShutdown = (signal: string): void => {
  logger.info(`${signal} received, shutting down gracefully`);
  server.close(() => {
    logger.info('HTTP server closed');
    prisma.$disconnect().then(() => {
      logger.info('Database disconnected');
      process.exit(0);
    });
  });
};

// Обработка сигналов завершения
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
