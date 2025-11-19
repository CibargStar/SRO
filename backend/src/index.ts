/**
 * BM Tools Backend - Main Entry Point
 * 
 * Настраивает Express сервер с middleware для безопасности, логирования и обработки ошибок.
 * Реализует graceful shutdown для корректного завершения работы.
 * 
 * Порядок инициализации:
 * 1. Инициализация root-пользователя (ensureRootUser)
 * 2. Настройка Express приложения
 * 3. Запуск HTTP сервера
 */

import express from 'express';
import { env, logger, prisma } from './config';
import { ensureRootUser } from './modules/auth';
import {
  securityMiddleware,
  corsMiddleware,
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
// 1. CORS (должен быть первым для обработки preflight запросов)
app.use(corsMiddleware);
// 2. Логирование запросов
app.use(requestLogger);
// 3. Безопасность (заголовки безопасности)
app.use(securityMiddleware);
// 4. Глобальный rate limiting (ограничение количества запросов)
app.use(rateLimiter);

// Health check endpoint для мониторинга
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

// API Routes
import authRoutes from './routes/auth.routes';
app.use('/api/auth', authRoutes);

// Обработчики ошибок должны быть последними
app.use(notFoundHandler); // 404 для несуществующих маршрутов
app.use(errorHandler); // Глобальный обработчик ошибок

/**
 * Bootstrap функция - инициализация приложения
 * 
 * Выполняется ДО старта HTTP сервера:
 * 1. Инициализация root-пользователя (гарантирует наличие ROOT)
 * 2. Запуск HTTP сервера
 * 
 * Если инициализация не удалась - приложение не стартует.
 */
async function bootstrap(): Promise<void> {
  try {
    // ВАЖНО: Инициализация root-пользователя ДО старта сервера
    // Это гарантирует, что ROOT существует до обработки любых запросов
    logger.info('Initializing root user...');
    await ensureRootUser(prisma, env, logger);
    logger.info('Root user initialization completed');

    // Запуск HTTP сервера только после успешной инициализации
    const server = app.listen(env.PORT, () => {
      logger.info(`Server is running on port ${env.PORT}`);
    });

    // Настройка graceful shutdown
    setupGracefulShutdown(server);
  } catch (error) {
    // Критическая ошибка - приложение не должно стартовать
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to bootstrap application', { error: errorMessage });
    
    // Закрываем соединение с БД перед выходом
    await prisma.$disconnect();
    
    // Выходим с ошибкой
    process.exit(1);
  }
}

/**
 * Настройка graceful shutdown для сервера
 * 
 * @param server - HTTP сервер Express
 */
function setupGracefulShutdown(server: ReturnType<typeof app.listen>): void {
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
}

// Запуск приложения
bootstrap().catch((error) => {
  logger.error('Unhandled error during bootstrap', { error });
  process.exit(1);
});
