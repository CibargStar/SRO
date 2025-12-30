/**
 * Сервис мониторинга статусов аккаунтов мессенджеров
 * 
 * Выполняет периодические проверки статусов входа для аккаунтов мессенджеров.
 * Проверяет только включенные аккаунты и только для запущенных профилей.
 * 
 * @module modules/profiles/messenger-accounts/monitoring/status-monitoring.service
 */

import { PrismaClient, ProfileMessengerAccount } from '@prisma/client';
import { MessengerAccountsRepository } from '../messenger-accounts.repository';
import { StatusCheckerService } from '../checkers/status-checker.service';
import { LoginCheckResult } from '../checkers/types';
import { ChromeProcessService } from '../../chrome-process/chrome-process.service';
import { NotificationService } from '../../notifications/notification.service';
import logger from '../../../../config/logger';
import { WebSocketServer } from '../../../websocket';
import { WsEventType, MessengerStatusPayload } from '../../../websocket/websocket.types';

/**
 * Минимальный интервал проверки - 1 минута
 */
const MIN_CHECK_INTERVAL_MS = 60 * 1000;

/**
 * Информация о задаче мониторинга
 */
interface MonitoringTask {
  accountId: string;
  profileId: string;
  serviceId: string;
  serviceName: string;
  intervalMs: number;
  lastCheckAt: Date | null;
  nextCheckAt: Date;
  timeoutId?: NodeJS.Timeout;
}

/**
 * Сервис мониторинга статусов
 */
export class StatusMonitoringService {
  private monitoringTasks: Map<string, MonitoringTask> = new Map();
  private isMonitoringActive: boolean = false;
  private globalCheckInterval?: NodeJS.Timeout;

  constructor(
    private prisma: PrismaClient,
    private repository: MessengerAccountsRepository,
    private statusCheckerService: StatusCheckerService,
    private chromeProcessService: ChromeProcessService,
    private notificationService?: NotificationService,
    private wsServer?: WebSocketServer
  ) {}

  setWebSocketServer(wsServer: WebSocketServer): void {
    this.wsServer = wsServer;
  }

  /**
   * Запуск мониторинга
   * 
   * Загружает все аккаунты и начинает их мониторинг.
   */
  async start(): Promise<void> {
    if (this.isMonitoringActive) {
      logger.warn('Monitoring is already active');
      return;
    }

    logger.info('Starting messenger account status monitoring...');
    this.isMonitoringActive = true;

    // Загрузка всех аккаунтов для мониторинга
    await this.loadMonitoringTasks();

    // Запуск глобального цикла проверки
    this.startGlobalCheckCycle();

    logger.info('Messenger account status monitoring started', {
      tasksCount: this.monitoringTasks.size,
    });
  }

  /**
   * Остановка мониторинга
   * 
   * Останавливает все задачи мониторинга и очищает ресурсы.
   */
  stop(): void {
    if (!this.isMonitoringActive) {
      logger.warn('Monitoring is not active');
      return;
    }

    logger.info('Stopping messenger account status monitoring...');

    // Остановка глобального цикла
    if (this.globalCheckInterval) {
      clearInterval(this.globalCheckInterval);
      this.globalCheckInterval = undefined;
    }

    // Остановка всех задач
    for (const task of this.monitoringTasks.values()) {
      if (task.timeoutId) {
        clearTimeout(task.timeoutId);
      }
    }

    this.monitoringTasks.clear();
    this.isMonitoringActive = false;

    logger.info('Messenger account status monitoring stopped');
  }

  /**
   * Загрузка задач мониторинга
   * 
   * Загружает все включенные аккаунты мессенджеров и создает для них задачи мониторинга.
   */
  private async loadMonitoringTasks(): Promise<void> {
    try {
      // Получаем все включенные аккаунты с их сервисами и конфигурациями
      const accounts = await this.prisma.profileMessengerAccount.findMany({
        where: {
          isEnabled: true,
        },
        include: {
          service: {
            include: {
              checkConfig: true,
            },
          },
        },
      });

      logger.debug('Loading monitoring tasks', { accountsCount: accounts.length });

      // Создаем задачи для каждого аккаунта
      for (const account of accounts) {
        // Проверяем, включен ли мониторинг для этого мессенджера глобально
        const checkConfig = account.service?.checkConfig;
        if (!checkConfig?.enabled) {
          logger.debug('Monitoring disabled for messenger', {
            accountId: account.id,
            serviceName: account.service?.name,
          });
          continue;
        }

        // Определяем интервал проверки
        const intervalSeconds = checkConfig.checkIntervalSeconds || 300; // 5 минут по умолчанию
        const intervalMs = Math.max(intervalSeconds * 1000, MIN_CHECK_INTERVAL_MS);

        // Создаем задачу
        const task: MonitoringTask = {
          accountId: account.id,
          profileId: account.profileId,
          serviceId: account.serviceId,
          serviceName: account.service.name,
          intervalMs,
          lastCheckAt: account.lastCheckedAt ? new Date(account.lastCheckedAt) : null,
          nextCheckAt: this.calculateNextCheckTime(
            account.lastCheckedAt ? new Date(account.lastCheckedAt) : null,
            intervalMs
          ),
        };

        this.monitoringTasks.set(account.id, task);
      }

      logger.info('Monitoring tasks loaded', { tasksCount: this.monitoringTasks.size });
    } catch (error) {
      logger.error('Failed to load monitoring tasks', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Запуск глобального цикла проверки
   * 
   * Запускает цикл, который периодически проверяет, какие задачи нужно выполнить.
   */
  private startGlobalCheckCycle(): void {
    // Проверяем каждые 30 секунд, какие задачи нужно выполнить
    const CHECK_CYCLE_INTERVAL_MS = 30 * 1000;

    this.globalCheckInterval = setInterval(() => {
      this.processMonitoringTasks().catch((error) => {
        logger.error('Error processing monitoring tasks', {
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      });
    }, CHECK_CYCLE_INTERVAL_MS);

    // Первая проверка сразу
    this.processMonitoringTasks().catch((error) => {
      logger.error('Error in initial monitoring check', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    });
  }

  /**
   * Обработка задач мониторинга
   * 
   * Проверяет все задачи и выполняет проверку для тех, у которых подошло время.
   */
  private async processMonitoringTasks(): Promise<void> {
    if (!this.isMonitoringActive) {
      return;
    }

    const now = new Date();
    const tasksToCheck: MonitoringTask[] = [];

    // Находим задачи, которые нужно проверить
    for (const task of this.monitoringTasks.values()) {
      if (now >= task.nextCheckAt) {
        tasksToCheck.push(task);
      }
    }

    if (tasksToCheck.length === 0) {
      return;
    }

    logger.debug('Processing monitoring tasks', { tasksCount: tasksToCheck.length });

    // Выполняем проверки параллельно
    const checkPromises = tasksToCheck.map((task) => this.checkAccountStatus(task));
    await Promise.allSettled(checkPromises);
  }

  /**
   * Проверка статуса аккаунта
   * 
   * ВАЖНО: Проверка выполняется ТОЛЬКО для запущенных профилей!
   * Остановленные профили пропускаются - их статус не актуален.
   * Также пропускаются профили, занятые рассылкой - чтобы не переключать вкладки.
   * 
   * @param task - Задача мониторинга
   */
  private async checkAccountStatus(task: MonitoringTask): Promise<void> {
    try {
      // КРИТИЧНО: Проверяем, запущен ли профиль ПЕРЕД любой проверкой
      const isRunning = this.chromeProcessService.isProfileRunning(task.profileId);
      
      if (!isRunning) {
        // Профиль не запущен - пропускаем проверку
        // НЕ логируем как debug - это нормальное поведение
        task.nextCheckAt = new Date(Date.now() + task.intervalMs);
        return;
      }

      // КРИТИЧНО: Проверяем, не занят ли профиль рассылкой
      // Если занят - пропускаем проверку, чтобы не переключать вкладки
      if (this.chromeProcessService.isProfileBusy(task.profileId)) {
        const busyInfo = this.chromeProcessService.getBusyProfileInfo(task.profileId);
        logger.debug('Skipping status check - profile busy with campaign', {
          accountId: task.accountId,
          profileId: task.profileId,
          serviceName: task.serviceName,
          busyMessenger: busyInfo?.messenger,
          campaignId: busyInfo?.campaignId,
        });
        // Откладываем следующую проверку на короткий интервал, чтобы проверить позже
        task.nextCheckAt = new Date(Date.now() + Math.min(task.intervalMs, 30000)); // Максимум 30 секунд
        return;
      }

      logger.debug('Checking account status for running profile', {
        accountId: task.accountId,
        profileId: task.profileId,
        serviceName: task.serviceName,
      });

      // Получаем текущий статус аккаунта перед проверкой
      const currentAccount = await this.repository.getAccountById(task.accountId);
      const previousStatus = currentAccount?.status;

      // Выполняем проверку статуса
      const result = await this.statusCheckerService.checkLoginStatus(
        task.profileId,
        task.accountId,
        task.serviceId,
        task.serviceName
      );

      // Обновляем статус в БД
      await this.repository.updateAccountStatus(task.accountId, result.status);

      // Проверяем, изменился ли статус и нужно ли создать уведомление/WS
      const statusChanged = previousStatus !== result.status;
      if (statusChanged && this.notificationService) {
        await this.handleStatusChangeNotification(
          task,
          result,
          previousStatus,
          currentAccount
        );
      }

      if (statusChanged) {
        await this.emitMessengerStatus(task, result.status);
      }

      // Обновляем информацию о задаче
      const now = new Date();
      task.lastCheckAt = now;
      task.nextCheckAt = this.calculateNextCheckTime(now, task.intervalMs);

      logger.debug('Account status checked', {
        accountId: task.accountId,
        status: result.status,
        previousStatus,
        statusChanged,
        nextCheckAt: task.nextCheckAt,
      });
    } catch (error) {
      logger.error('Error checking account status', {
        error: error instanceof Error ? error.message : 'Unknown error',
        accountId: task.accountId,
        profileId: task.profileId,
      });

      // В случае ошибки переносим следующую проверку на позже
      task.nextCheckAt = new Date(Date.now() + task.intervalMs);
    }
  }

  /**
   * Вычисление времени следующей проверки
   * 
   * @param lastCheckAt - Время последней проверки
   * @param intervalMs - Интервал проверки в миллисекундах
   * @returns Время следующей проверки
   */
  private calculateNextCheckTime(lastCheckAt: Date | null, intervalMs: number): Date {
    if (!lastCheckAt) {
      // Если проверка еще не выполнялась, проверяем через интервал
      return new Date(Date.now() + intervalMs);
    }

    // Вычисляем следующее время проверки
    const nextCheck = new Date(lastCheckAt.getTime() + intervalMs);
    
    // Если следующее время уже прошло, проверяем сейчас
    if (nextCheck <= new Date()) {
      return new Date(Date.now() + 1000); // Через 1 секунду
    }

    return nextCheck;
  }

  /**
   * Добавление аккаунта в мониторинг
   * 
   * Добавляет новый аккаунт в список задач мониторинга.
   * 
   * @param accountId - ID аккаунта
   */
  async addAccountToMonitoring(accountId: string): Promise<void> {
    if (!this.isMonitoringActive) {
      return;
    }

    try {
      // Загружаем информацию об аккаунте
      const account = await this.prisma.profileMessengerAccount.findUnique({
        where: { id: accountId },
        include: {
          service: {
            include: {
              checkConfig: true,
            },
          },
        },
      });

      if (!account || !account.isEnabled) {
        return;
      }

      const checkConfig = account.service?.checkConfig;
      if (!checkConfig?.enabled) {
        return;
      }

      const intervalSeconds = checkConfig.checkIntervalSeconds || 300;
      const intervalMs = Math.max(intervalSeconds * 1000, MIN_CHECK_INTERVAL_MS);

      const task: MonitoringTask = {
        accountId: account.id,
        profileId: account.profileId,
        serviceId: account.serviceId,
        serviceName: account.service.name,
        intervalMs,
        lastCheckAt: account.lastCheckedAt ? new Date(account.lastCheckedAt) : null,
        nextCheckAt: this.calculateNextCheckTime(
          account.lastCheckedAt ? new Date(account.lastCheckedAt) : null,
          intervalMs
        ),
      };

      this.monitoringTasks.set(accountId, task);

      logger.info('Account added to monitoring', { accountId, serviceName: account.service.name });
    } catch (error) {
      logger.error('Failed to add account to monitoring', {
        error: error instanceof Error ? error.message : 'Unknown error',
        accountId,
      });
    }
  }

  /**
   * Удаление аккаунта из мониторинга
   * 
   * Удаляет аккаунт из списка задач мониторинга.
   * 
   * @param accountId - ID аккаунта
   */
  removeAccountFromMonitoring(accountId: string): void {
    const task = this.monitoringTasks.get(accountId);
    if (task) {
      if (task.timeoutId) {
        clearTimeout(task.timeoutId);
      }
      this.monitoringTasks.delete(accountId);
      logger.info('Account removed from monitoring', { accountId });
    }
  }

  /**
   * Обновление задачи мониторинга
   * 
   * Обновляет информацию о задаче мониторинга (например, при изменении интервала).
   * 
   * @param accountId - ID аккаунта
   */
  async updateMonitoringTask(accountId: string): Promise<void> {
    // Удаляем старую задачу
    this.removeAccountFromMonitoring(accountId);

    // Добавляем обновленную задачу
    await this.addAccountToMonitoring(accountId);
  }

  /**
   * Получение статистики мониторинга
   * 
   * @returns Статистика мониторинга
   */
  getMonitoringStats(): {
    isActive: boolean;
    tasksCount: number;
    tasks: Array<{
      accountId: string;
      profileId: string;
      serviceName: string;
      nextCheckAt: Date;
      lastCheckAt: Date | null;
    }>;
  } {
    return {
      isActive: this.isMonitoringActive,
      tasksCount: this.monitoringTasks.size,
      tasks: Array.from(this.monitoringTasks.values()).map((task) => ({
        accountId: task.accountId,
        profileId: task.profileId,
        serviceName: task.serviceName,
        nextCheckAt: task.nextCheckAt,
        lastCheckAt: task.lastCheckAt,
      })),
    };
  }

  /**
   * Отправка WS события о статусе мессенджера
   */
  private async emitMessengerStatus(task: MonitoringTask, status: string): Promise<void> {
    if (!this.wsServer) {
      return;
    }
    try {
      const profile = await this.prisma.profile.findUnique({
        where: { id: task.profileId },
        select: { userId: true },
      });
      if (!profile) {
        return;
      }

      const payload: MessengerStatusPayload = {
        profileId: task.profileId,
        serviceId: task.serviceId,
        serviceName: task.serviceName,
        status,
        lastCheckedAt: new Date().toISOString(),
      };

      this.wsServer.emitProfileEvent(task.profileId, profile.userId, WsEventType.MESSENGER_STATUS, payload);
    } catch (error) {
      logger.error('Failed to emit messenger status', {
        error: error instanceof Error ? error.message : 'Unknown error',
        profileId: task.profileId,
        serviceId: task.serviceId,
      });
    }
  }

  /**
   * Обработка уведомлений при изменении статуса
   * 
   * @param task - Задача мониторинга
   * @param checkResult - Результат проверки
   * @param previousStatus - Предыдущий статус
   * @param account - Информация об аккаунте
   */
  private async handleStatusChangeNotification(
    task: MonitoringTask,
    checkResult: LoginCheckResult,
    previousStatus: string | undefined,
    account: (ProfileMessengerAccount & {
      service?: {
        displayName?: string | null;
        name: string;
        checkConfig?: { enabled?: boolean; checkIntervalSeconds?: number | null } | null;
      } | null;
    }) | null
  ): Promise<void> {
    if (!this.notificationService || !account) {
      return;
    }

    try {
      // Получаем информацию о профиле для userId
      const profile = await this.prisma.profile.findUnique({
        where: { id: task.profileId },
        select: { userId: true },
      });

      if (!profile) {
        logger.warn('Profile not found for notification', {
          profileId: task.profileId,
        });
        return;
      }

      const userId = profile.userId;

      // Если статус изменился на NOT_LOGGED_IN - создаем уведомление
      if (checkResult.status === 'NOT_LOGGED_IN') {
        const service = account.service ?? (account.serviceId ? await this.repository.getServiceById(task.serviceId) : null);

        if (service) {
          this.notificationService.notifyMessengerLoginRequired(
            task.profileId,
            userId,
            task.accountId,
            task.serviceName,
            service.displayName ?? task.serviceName,
            checkResult.qrCode,
            checkResult.cloudPasswordRequired
          );

          logger.info('Login required notification created during monitoring', {
            accountId: task.accountId,
            profileId: task.profileId,
            serviceName: task.serviceName,
            previousStatus,
            newStatus: checkResult.status,
          });
        }
      }
    } catch (error) {
      logger.error('Error handling status change notification', {
        error: error instanceof Error ? error.message : 'Unknown error',
        accountId: task.accountId,
        profileId: task.profileId,
      });
    }
  }
}

