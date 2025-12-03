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
import { ensureMessengerServices } from './modules/profiles/messenger-accounts/init-messenger-services';
import { NotificationService } from './modules/profiles/notifications/notification.service';
import { LaunchCheckService } from './modules/profiles/messenger-accounts/launch-check/launch-check.service';
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

// Инициализация сервисов
import { ProfilesService } from './modules/profiles';
import { ProfilesRepository } from './modules/profiles';
import profilesRoutes from './routes/profiles.routes';

// Инициализация ProfilesService
import { ProfileLimitsRepository, ProfileLimitsService } from './modules/profiles/limits';
import { MessengerAccountsRepository, MessengerAccountsService } from './modules/profiles/messenger-accounts';
const profilesRepository = new ProfilesRepository(prisma);
const profileLimitsRepository = new ProfileLimitsRepository(prisma);
const profileLimitsService = new ProfileLimitsService(profileLimitsRepository, profilesRepository);
// КРИТИЧНО: Короткий путь для профилей (Windows имеет ограничение 260 символов)
// CacheStorage создаёт ОЧЕНЬ длинные пути внутри userDataDir
// На Windows используем C:\SROProf, на Linux/Mac - ~/.sroprof
import { mkdirSync, existsSync } from 'fs';

const getProfilesBasePath = (): string => {
  if (process.platform === 'win32') {
    // Windows: короткий путь в корне диска C:
    return 'C:\\SROProf';
  } else {
    // Linux/Mac: папка в домашней директории
    return process.env.HOME ? `${process.env.HOME}/.sroprof` : '/tmp/sroprof';
  }
};

const profilesBasePath = getProfilesBasePath();

// Автоматическое создание папки профилей при старте
if (!existsSync(profilesBasePath)) {
  try {
    mkdirSync(profilesBasePath, { recursive: true });
    logger.info('Profiles directory created', { path: profilesBasePath });
  } catch (err) {
    logger.error('Failed to create profiles directory', { path: profilesBasePath, error: err });
  }
}

logger.info('Profiles base path configured', { path: profilesBasePath, platform: process.platform });
const profilesService = new ProfilesService(profilesRepository, profilesBasePath, profileLimitsService);
app.set('profilesService', profilesService);
app.set('profileLimitsService', profileLimitsService);

// Получение ChromeProcessService для использования в других сервисах
const chromeProcessService = profilesService.chromeProcessService;

// Инициализация MessengerAccountsService (передаем ChromeProcessService и Prisma для проверки статусов и мониторинга)
const messengerAccountsRepository = new MessengerAccountsRepository(prisma);
const notificationServiceForMessengers = new NotificationService();
const messengerAccountsService = new MessengerAccountsService(
  messengerAccountsRepository,
  profilesRepository,
  chromeProcessService,
  prisma,
  notificationServiceForMessengers
);
app.set('messengerAccountsService', messengerAccountsService);

// Инициализация LaunchCheckService для проверки аккаунтов мессенджеров при запуске профиля
const statusCheckerService = messengerAccountsService.getStatusCheckerService();
if (statusCheckerService) {
  // Используем существующий NotificationService (можно использовать тот же, что и для мониторинга)
  const launchCheckService = new LaunchCheckService(
    prisma,
    messengerAccountsRepository,
    statusCheckerService,
    chromeProcessService, // Для открытия вкладок мессенджеров
    notificationServiceForMessengers // Используем тот же NotificationService
  );
  // Передаем LaunchCheckService в ProfilesService
  profilesService.setLaunchCheckService(launchCheckService);
}

// Запуск фоновых сервисов мониторинга профилей
profilesService.startBackgroundServices();

// Запуск мониторинга статусов мессенджеров
messengerAccountsService.startMonitoring().catch((err) => {
  logger.warn('Failed to start messenger accounts monitoring', { error: err instanceof Error ? err.message : 'Unknown error' });
});

// API Routes
import authRoutes from './routes/auth.routes';
import usersRoutes from './routes/users.routes';
import clientsRoutes from './routes/clients.routes';
import clientGroupsRoutes from './routes/client-groups.routes';
import regionsRoutes from './routes/regions.routes';
import importRoutes from './routes/import.routes';
import exportRoutes from './routes/export.routes';
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/clients', clientsRoutes);
app.use('/api/client-groups', clientGroupsRoutes);
app.use('/api/regions', regionsRoutes);
app.use('/api/import', importRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/profiles', profilesRoutes);
// Маршруты для аккаунтов мессенджеров (используют префикс /api, не /api/profiles, так как есть отдельные endpoints)
import messengerAccountsRoutes from './modules/profiles/messenger-accounts/messenger-accounts.routes';
app.use('/api', messengerAccountsRoutes);

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

    // Инициализация справочника мессенджеров
    logger.info('Initializing messenger services...');
    await ensureMessengerServices(prisma);
    logger.info('Messenger services initialization completed');

    // Восстановление профилей со статусом RUNNING при старте сервиса
    logger.info('Restoring running profiles...');
    await profilesService.restoreRunningProfiles();
    logger.info('Running profiles restoration completed');

    // Запуск мониторинга статусов аккаунтов мессенджеров
    logger.info('Starting messenger accounts status monitoring...');
    await messengerAccountsService.startMonitoring();
    logger.info('Messenger accounts status monitoring started');

    // Очистка истекших токенов при старте и настройка периодической очистки
    logger.info('Setting up token cleanup...');
    setupTokenCleanup();

    // Запуск HTTP сервера только после успешной инициализации
    const server = app.listen(env.PORT, () => {
      logger.info(`Server is running on port ${env.PORT}`);
    });

    // Настройка graceful shutdown
    setupGracefulShutdown(server, profilesService, messengerAccountsService);
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
 * @param profilesService - Сервис управления профилями
 */
function setupGracefulShutdown(
  server: ReturnType<typeof app.listen>,
  profilesService: any,
  messengerAccountsService: any
): void {
  /**
   * Graceful shutdown - корректное завершение работы сервера
   * Закрывает HTTP сервер и отключается от базы данных перед выходом
   * 
   * @param signal - Сигнал завершения (SIGTERM или SIGINT)
   */
  const gracefulShutdown = async (signal: string): Promise<void> => {
    logger.info(`${signal} received, shutting down gracefully`);
    
    // Остановка фоновых сервисов мониторинга профилей
    try {
      if (profilesService) {
        logger.info('Stopping background services for profiles...');
        profilesService.stopBackgroundServices();
        logger.info('Background services stopped');
      }
    } catch (error) {
      logger.error('Error stopping background services during shutdown', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
    
    // Остановка мониторинга статусов аккаунтов мессенджеров
    try {
      if (messengerAccountsService) {
        logger.info('Stopping messenger accounts monitoring...');
        messengerAccountsService.stopMonitoring();
        logger.info('Messenger accounts monitoring stopped');
      }
    } catch (error) {
      logger.error('Error stopping messenger accounts monitoring during shutdown', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    // Остановка всех Chrome процессов перед завершением
    try {
      if (profilesService && profilesService.chromeProcessService) {
        logger.info('Stopping all Chrome processes...');
        await profilesService.chromeProcessService.stopAllProcesses(true);
        logger.info('All Chrome processes stopped');
      }
    } catch (error) {
      logger.error('Error stopping Chrome processes during shutdown', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

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
