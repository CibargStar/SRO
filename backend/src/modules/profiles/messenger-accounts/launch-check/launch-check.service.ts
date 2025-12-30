/**
 * Сервис проверки статусов аккаунтов мессенджеров при запуске профиля
 * 
 * Проверяет статусы всех включенных аккаунтов мессенджеров после запуска профиля
 * и создает уведомления, если требуется вход.
 * 
 * ВАЖНО: Каждый мессенджер открывается в своей вкладке браузера!
 * Это позволяет работать с WhatsApp и Telegram параллельно.
 * 
 * @module modules/profiles/messenger-accounts/launch-check/launch-check.service
 */

import { PrismaClient, ProfileMessengerAccount } from '@prisma/client';
import { MessengerAccountsRepository } from '../messenger-accounts.repository';
import { StatusCheckerService } from '../checkers/status-checker.service';
import { ChromeProcessService } from '../../chrome-process/chrome-process.service';
import { NotificationService } from '../../notifications/notification.service';
import { getCheckerOrThrow } from '../checkers/checker-factory';
import logger from '../../../../config/logger';

/**
 * Результат проверки при запуске профиля
 */
export interface LaunchCheckResult {
  /** Количество проверенных аккаунтов */
  checkedCount: number;
  
  /** Количество аккаунтов, требующих входа */
  loginRequiredCount: number;
  
  /** Количество ошибок при проверке */
  errorCount: number;
  
  /** Детали проверки */
  details: Array<{
    accountId: string;
    serviceName: string;
    serviceDisplayName: string;
    status: string;
    requiresLogin: boolean;
    hasError: boolean;
    error?: string;
  }>;
}

/**
 * Сервис проверки при запуске профиля
 */
export class LaunchCheckService {
  constructor(
    _prisma: PrismaClient,
    private repository: MessengerAccountsRepository,
    private statusCheckerService: StatusCheckerService,
    private chromeProcessService: ChromeProcessService,
    private notificationService: NotificationService
  ) {}

  /**
   * Проверка статусов аккаунтов мессенджеров при запуске профиля
   * 
   * ВАЖНО: Сначала открывает вкладки для всех мессенджеров ПАРАЛЛЕЛЬНО,
   * затем проверяет статус входа. Каждый мессенджер работает в своей вкладке!
   * 
   * @param profileId - ID профиля
   * @param userId - ID пользователя
   * @returns Результат проверки
   */
  async checkMessengerAccountsOnLaunch(
    profileId: string,
    userId: string
  ): Promise<LaunchCheckResult> {
    try {
      logger.info('Checking messenger accounts on profile launch', { profileId, userId });

      // Получаем все включенные аккаунты мессенджеров для профиля
      const accounts = await this.repository.getAccountsByProfileId(profileId);

      // Фильтруем только включенные аккаунты
      const enabledAccounts = accounts.filter((account) => account.isEnabled);

      if (enabledAccounts.length === 0) {
        logger.debug('No enabled messenger accounts found for profile', { profileId });
        return {
          checkedCount: 0,
          loginRequiredCount: 0,
          errorCount: 0,
          details: [],
        };
      }

      logger.info('Opening messenger tabs for profile', {
        profileId,
        accountsCount: enabledAccounts.length,
        messengers: enabledAccounts.map(a => a.service?.name).filter(Boolean),
      });

      // ШАГ 1: Открываем вкладки для всех мессенджеров ПАРАЛЛЕЛЬНО
      logger.info('=== Opening messenger tabs ===', {
        profileId,
        messengers: enabledAccounts.map(a => a.service?.name).filter(Boolean),
      });

      const openTabsPromises = enabledAccounts.map(async (account) => {
        const serviceName = account.service?.name;
        if (!serviceName) {
          logger.warn('Service name not found for account', { accountId: account.id, profileId });
          return;
        }

        try {
          const checker = getCheckerOrThrow(serviceName);
          const url = checker.getCheckUrl();
          
          logger.info('Opening messenger tab', { profileId, serviceName, url });
          
          const page = await this.chromeProcessService.getOrCreateMessengerPage(profileId, serviceName, url);
          
          if (page) {
            // Активируем вкладку чтобы браузер начал рендерить контент
            await page.bringToFront();
            logger.info('Messenger tab opened and activated', { profileId, serviceName, pageUrl: page.url() });
          } else {
            logger.error('Failed to create messenger page - returned null', { profileId, serviceName });
          }
        } catch (error) {
          logger.error('Failed to open messenger tab', {
            profileId,
            serviceName,
            error: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined,
          });
        }
      });

      await Promise.allSettled(openTabsPromises);
      
      logger.info('All messenger tabs opening attempts completed', { profileId });

      // ВАЖНО: Ждём полной загрузки страниц перед проверкой статуса
      // Мессенджеры (WhatsApp, Telegram) грузятся асинхронно
      logger.info('Waiting for pages to fully load before checking status...', { profileId });
      await new Promise((resolve) => setTimeout(resolve, 5000)); // 5 секунд на загрузку

      const result: LaunchCheckResult = {
        checkedCount: enabledAccounts.length,
        loginRequiredCount: 0,
        errorCount: 0,
        details: [],
      };

      // ШАГ 2: Проверяем статус каждого аккаунта ПАРАЛЛЕЛЬНО
      logger.debug('Checking messenger account statuses', {
        profileId,
        accountsCount: enabledAccounts.length,
      });

      const checkPromises = enabledAccounts.map((account) =>
        this.checkAccountStatus(account, profileId, userId, result)
      );

      await Promise.allSettled(checkPromises);

      logger.info('Messenger accounts launch check completed', {
        profileId,
        checkedCount: result.checkedCount,
        loginRequiredCount: result.loginRequiredCount,
        errorCount: result.errorCount,
      });

      return result;
    } catch (error) {
      logger.error('Error checking messenger accounts on launch', {
        error: error instanceof Error ? error.message : 'Unknown error',
        profileId,
        userId,
      });

      return {
        checkedCount: 0,
        loginRequiredCount: 0,
        errorCount: 1,
        details: [
          {
            accountId: '',
            serviceName: '',
            serviceDisplayName: '',
            status: 'ERROR',
            requiresLogin: false,
            hasError: true,
            error: error instanceof Error ? error.message : 'Unknown error',
          },
        ],
      };
    }
  }

  /**
   * Проверка статуса одного аккаунта
   * 
   * @param account - Аккаунт мессенджера
   * @param profileId - ID профиля
   * @param userId - ID пользователя
   * @param result - Результат проверки (обновляется)
   */
  private async checkAccountStatus(
    account: ProfileMessengerAccount & {
      service?: {
        id: string;
        name: string;
        displayName: string;
      } | null;
    },
    profileId: string,
    userId: string,
    result: LaunchCheckResult
  ): Promise<void> {
    try {
      const service = account.service;
      if (!service) {
        logger.warn('Service information not found for account', {
          accountId: account.id,
          profileId,
        });
        result.errorCount++;
        result.details.push({
          accountId: account.id,
          serviceName: 'unknown',
          serviceDisplayName: 'Unknown',
          status: 'ERROR',
          requiresLogin: false,
          hasError: true,
          error: 'Service information not found',
        });
        return;
      }

      logger.debug('Checking account status', {
        accountId: account.id,
        profileId,
        serviceName: service.name,
      });

      // Выполняем проверку статуса
      const checkResult = await this.statusCheckerService.checkLoginStatus(
        profileId,
        account.id,
        account.serviceId,
        service.name
      );

      // Обновляем статус в БД
      await this.repository.updateAccountStatus(account.id, checkResult.status);

      const requiresLogin = checkResult.status === 'NOT_LOGGED_IN';
      const hasError = checkResult.status === 'ERROR';

      if (hasError) {
        result.errorCount++;
      }

      // Если требуется вход - создаем уведомление
      if (requiresLogin) {
        result.loginRequiredCount++;

        // Создаем уведомление с QR кодом
        this.notificationService.notifyMessengerLoginRequired(
          profileId,
          userId,
          account.id,
          service.name,
          service.displayName,
          checkResult.qrCode,
          checkResult.cloudPasswordRequired
        );

        logger.info('Login required notification created', {
          accountId: account.id,
          profileId,
          serviceName: service.name,
          hasQRCode: !!checkResult.qrCode,
          cloudPasswordRequired: checkResult.cloudPasswordRequired,
        });
      }

      result.details.push({
        accountId: account.id,
        serviceName: service.name,
        serviceDisplayName: service.displayName,
        status: checkResult.status,
        requiresLogin,
        hasError,
        error: checkResult.error,
      });
    } catch (error) {
      logger.error('Error checking account status on launch', {
        error: error instanceof Error ? error.message : 'Unknown error',
        accountId: account.id,
        profileId,
      });

      result.errorCount++;
      result.details.push({
        accountId: account.id,
        serviceName: account.service?.name || 'unknown',
        serviceDisplayName: account.service?.displayName || 'Unknown',
        status: 'ERROR',
        requiresLogin: false,
        hasError: true,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
}

