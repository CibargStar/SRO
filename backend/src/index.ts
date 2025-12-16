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
import { ensureCampaignGlobalSettings } from './modules/campaign-settings';
import { WebSocketServer } from './modules/websocket';
import { ProfilesService } from './modules/profiles';
import { NotificationService } from './modules/profiles/notifications/notification.service';
import { LaunchCheckService } from './modules/profiles/messenger-accounts/launch-check/launch-check.service';
import { getCampaignExecutorService, getCampaignRecovery } from './modules/campaigns';
import { CampaignSchedulerService } from './modules/campaigns';
import { UserBotManagerService, NotificationDispatcherService } from './modules/telegram-bot';
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
import { createTemplatesRouter } from './modules/templates';
import { campaignsRoutes, campaignAdminRoutes } from './modules/campaigns';
import path from 'path';
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
// Маршруты для шаблонов рассылки
app.use('/api/templates', createTemplatesRouter(prisma));
// Маршруты для кампаний рассылки
app.use('/api/campaigns', campaignsRoutes);
// Админ-маршруты для кампаний (ROOT только)
app.use('/api/admin/campaigns', campaignAdminRoutes);
// Маршруты для Telegram ботов
import telegramBotRoutes from './modules/telegram-bot/telegram-bot.routes';
app.use('/api/telegram-bot', telegramBotRoutes);
// Static file serving для файлов шаблонов (защита через токены в URL не реализована - файлы доступны по прямой ссылке)
// TODO: В будущем добавить защиту доступа к файлам через проверку владельца
app.use('/uploads/templates', express.static(path.join(process.cwd(), 'uploads', 'templates')));

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

    // Инициализация глобальных настроек кампаний
    logger.info('Initializing campaign global settings...');
    await ensureCampaignGlobalSettings(prisma);
    logger.info('Campaign global settings initialization completed');

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

    // Инициализация WebSocket сервера
    logger.info('Initializing WebSocket server...');
    const wsServer = new WebSocketServer();
    wsServer.initialize(server);
    app.set('wsServer', wsServer);

    // Прокидываем WS сервер в профили и мониторинг мессенджеров для real-time событий
    profilesService.setWebSocketServer(wsServer);
    messengerAccountsService.setWebSocketServer(wsServer);

    logger.info('WebSocket server initialized');

    // Инициализация User Bot Manager
    logger.info('Initializing User Bot Manager...');
    const userBotManager = new UserBotManagerService(prisma);
    await userBotManager.startAllBots();
    app.set('userBotManager', userBotManager);
    logger.info('User Bot Manager initialized');

    // Инициализация Notification Dispatcher
    logger.info('Initializing Notification Dispatcher...');
    const notificationDispatcher = new NotificationDispatcherService(prisma, userBotManager, wsServer);
    app.set('notificationDispatcher', notificationDispatcher);
    profilesService.setNotificationDispatcher(notificationDispatcher);
    notificationServiceForMessengers.setNotificationDispatcher(notificationDispatcher);
    logger.info('Notification Dispatcher initialized');

    // Инициализация Campaign Executor
    logger.info('Initializing Campaign Executor...');
    const campaignExecutor = getCampaignExecutorService(prisma, wsServer, chromeProcessService);
    campaignExecutor.setNotificationDispatcher(notificationDispatcher);
    campaignExecutor.setProfilesService(profilesService);
    app.set('campaignExecutor', campaignExecutor);
    logger.info('Campaign Executor initialized');

    // Инициализация Campaign Recovery Service
    logger.info('Initializing Campaign Recovery Service...');
    const campaignRecovery = getCampaignRecovery(prisma, wsServer, chromeProcessService);
    app.set('campaignRecovery', campaignRecovery);
    logger.info('Campaign Recovery Service initialized');

    // Инициализация Campaign Scheduler
    logger.info('Initializing Campaign Scheduler...');
    const campaignScheduler = new CampaignSchedulerService(prisma);
    campaignScheduler.setCallbacks({
      onCampaignReady: async (campaignId: string) => {
        await campaignExecutor.startCampaign(campaignId);
      },
      onCampaignPause: async (campaignId: string) => {
        await campaignExecutor.pauseCampaign(campaignId);
      },
      onCampaignResume: async (campaignId: string) => {
        await campaignExecutor.resumeCampaign(campaignId);
      },
    });
    campaignScheduler.start();
    app.set('campaignScheduler', campaignScheduler);
    logger.info('Campaign Scheduler initialized and started');

    // Восстановление кампаний после рестарта
    logger.info('Restoring campaigns after restart...');
    await campaignRecovery.restoreRunningCampaigns();
    logger.info('Campaigns restoration completed');

    // Настройка graceful shutdown
    setupGracefulShutdown(server, profilesService, messengerAccountsService, wsServer, campaignScheduler, campaignExecutor, userBotManager);
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
 * @param profilesService - Сервис управления профилями
 */
function setupGracefulShutdown(
  server: ReturnType<typeof app.listen>,
  profilesService: ProfilesService,
  messengerAccountsService: MessengerAccountsService,
  wsServer?: WebSocketServer,
  campaignScheduler?: CampaignSchedulerService,
  campaignExecutor?: ReturnType<typeof getCampaignExecutorService>,
  userBotManager?: UserBotManagerService
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
      logger.info('Stopping background services for profiles...');
      profilesService.stopBackgroundServices();
      logger.info('Background services stopped');
    } catch (error) {
      logger.error('Error stopping background services during shutdown', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
    
    // Остановка мониторинга статусов аккаунтов мессенджеров
    try {
      logger.info('Stopping messenger accounts monitoring...');
      messengerAccountsService.stopMonitoring();
      logger.info('Messenger accounts monitoring stopped');
    } catch (error) {
      logger.error('Error stopping messenger accounts monitoring during shutdown', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    // Остановка User Bot Manager
    try {
      if (userBotManager) {
        logger.info('Stopping User Bot Manager...');
        await userBotManager.stopAllBots();
        logger.info('User Bot Manager stopped');
      }
    } catch (error) {
      logger.error('Error stopping User Bot Manager during shutdown', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    // Остановка Campaign Scheduler
    try {
      if (campaignScheduler) {
        logger.info('Stopping Campaign Scheduler...');
        campaignScheduler.stop();
        logger.info('Campaign Scheduler stopped');
      }
    } catch (error) {
      logger.error('Error stopping Campaign Scheduler during shutdown', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    // Остановка всех активных кампаний через Executor
    try {
      if (campaignExecutor) {
        logger.info('Stopping all active campaigns...');
        // Executor сам остановит все воркеры при shutdown
        // Здесь можно добавить явную остановку если нужно
        logger.info('Active campaigns stopped');
      }
    } catch (error) {
      logger.error('Error stopping campaigns during shutdown', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    // Остановка WebSocket сервера
    try {
      if (wsServer) {
        logger.info('Stopping WebSocket server...');
        wsServer.close();
        logger.info('WebSocket server stopped');
      }
    } catch (error) {
      logger.error('Error stopping WebSocket server during shutdown', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    // Остановка всех Chrome процессов перед завершением
    try {
      if (profilesService?.chromeProcessService) {
        logger.info('Stopping all Chrome processes...');
        await profilesService.chromeProcessService.stopAllProcesses(true);
        logger.info('All Chrome processes stopped');
      }
    } catch (error) {
      logger.error('Error stopping Chrome processes during shutdown', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    await new Promise<void>((resolve) => {
      server.close(() => {
        logger.info('HTTP server closed');
        resolve();
      });
    });
    await prisma.$disconnect();
    logger.info('Database disconnected');
    process.exit(0);
  };

  // Обработка сигналов завершения
  process.on('SIGTERM', () => {
    void gracefulShutdown('SIGTERM');
  });
  process.on('SIGINT', () => {
    void gracefulShutdown('SIGINT');
  });
}

// Запуск приложения
bootstrap().catch((error: unknown) => {
  logger.error('Unhandled error during bootstrap', { error });
  process.exit(1);
});
