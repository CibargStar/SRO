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
import swaggerUi from 'swagger-ui-express';
import { env, logger, prisma } from './config';
import { swaggerSpec } from './config/swagger';
import { ensureRootUser } from './modules/auth';
import { cleanupExpiredTokens } from './modules/auth/token.service';
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

// Swagger UI документация
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'BM Tools API Documentation',
  customfavIcon: '/favicon.ico',
}));

// API Routes
import authRoutes from './routes/auth.routes';
import usersRoutes from './routes/users.routes';
import clientsRoutes from './routes/clients.routes';
import clientGroupsRoutes from './routes/client-groups.routes';
import regionsRoutes from './routes/regions.routes';
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/clients', clientsRoutes);
app.use('/api/client-groups', clientGroupsRoutes);
app.use('/api/regions', regionsRoutes);

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
/**
 * Настройка периодической очистки истекших токенов
 * 
 * Запускает очистку каждые 24 часа для поддержания БД в чистом состоянии.
 */
function setupTokenCleanup(): void {
  // Очистка при старте
  cleanupExpiredTokens(prisma).catch((error) => {
    logger.error('Failed to cleanup expired tokens on startup', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  });

  // Периодическая очистка каждые 24 часа
  const cleanupInterval = 24 * 60 * 60 * 1000; // 24 часа в миллисекундах
  
  setInterval(() => {
    cleanupExpiredTokens(prisma).catch((error) => {
      logger.error('Failed to cleanup expired tokens', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    });
  }, cleanupInterval);

  logger.info('Token cleanup scheduled (every 24 hours)');
}

async function bootstrap(): Promise<void> {
  try {
    // ВАЖНО: Инициализация root-пользователя ДО старта сервера
    // Это гарантирует, что ROOT существует до обработки любых запросов
    logger.info('Initializing root user...');
    await ensureRootUser(prisma, env, logger);
    logger.info('Root user initialization completed');

    // Очистка истекших токенов при старте и настройка периодической очистки
    logger.info('Setting up token cleanup...');
    setupTokenCleanup();

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
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
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
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
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
bootstrap().catch((error: unknown) => {
  logger.error('Unhandled error during bootstrap', { error });
  process.exit(1);
});
