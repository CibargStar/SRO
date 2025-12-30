/**
 * Сервис проверки статуса входа в мессенджеры
 * 
 * Использует чекеры для проверки статуса входа аккаунтов мессенджеров.
 * Интегрируется с ChromeProcessService для доступа к браузеру профиля.
 * 
 * @module modules/profiles/messenger-accounts/checkers/status-checker.service
 */

import { Page } from 'puppeteer';
import { ChromeProcessService } from '../../chrome-process/chrome-process.service';
import { getCheckerOrThrow } from './checker-factory';
import { LoginCheckResult, CheckContext, CloudPasswordChecker } from './types';
import { BaseChecker } from './base-checker';
import logger from '../../../../config/logger';

/**
 * Type guard для проверки поддержки облачного пароля
 */
function isCloudPasswordChecker(checker: BaseChecker): checker is BaseChecker & CloudPasswordChecker {
  return 'enterCloudPassword' in checker && typeof (checker as unknown as CloudPasswordChecker).enterCloudPassword === 'function';
}

/**
 * Сервис проверки статуса входа
 */
export class StatusCheckerService {
  constructor(private chromeProcessService: ChromeProcessService) {}

  /**
   * Проверка статуса входа для аккаунта мессенджера
   * 
   * Каждый мессенджер использует свою отдельную вкладку браузера.
   * 
   * @param profileId - ID профиля
   * @param accountId - ID аккаунта мессенджера
   * @param serviceId - ID мессенджера
   * @param serviceName - Техническое имя мессенджера (whatsapp, telegram)
   * @returns Результат проверки
   * @throws Error если профиль не запущен или чекер не найден
   */
  async checkLoginStatus(
    profileId: string,
    accountId: string,
    serviceId: string,
    serviceName: string
  ): Promise<LoginCheckResult> {
    try {
      logger.debug('Starting login status check', {
        profileId,
        accountId,
        serviceId,
        serviceName,
      });

      // Проверка, запущен ли профиль
      if (!this.chromeProcessService.isProfileRunning(profileId)) {
        throw new Error(`Profile ${profileId} is not running`);
      }

      // Получение чекера для мессенджера
      const checker = getCheckerOrThrow(serviceName);

      // Получение или создание вкладки для мессенджера
      const page = await this.getOrCreateMessengerPage(profileId, serviceName, checker.getCheckUrl());
      if (!page) {
        throw new Error(`Cannot get/create page for messenger ${serviceName} in profile ${profileId}`);
      }

      // КРИТИЧНО: Проверяем, не занят ли профиль рассылкой перед переключением фокуса
      // Если профиль занят - не переключаем фокус, чтобы не нарушить процесс отправки файлов
      const isBusy = this.chromeProcessService.isProfileBusy(profileId);
      if (!isBusy) {
        // ВАЖНО: Активируем вкладку перед проверкой только если профиль не занят!
        // Браузер не рендерит контент (включая QR коды) на неактивных вкладках
        await page.bringToFront();
        logger.debug('Brought messenger page to front', { profileId, serviceName });

        // Небольшая пауза для рендеринга после активации
        await new Promise((resolve) => setTimeout(resolve, 500));
      } else {
        logger.debug('Skipping bringToFront - profile is busy with campaign', { profileId, serviceName });
      }

      // Создание контекста проверки
      const context: CheckContext = {
        profileId,
        accountId,
        serviceId,
        url: checker.getCheckUrl(),
      };

      // Выполнение проверки
      const result = await checker.checkLoginStatus(page, context);

      logger.info('Login status check completed', {
        profileId,
        accountId,
        serviceName,
        status: result.status,
      });

      return result;
    } catch (error) {
      logger.error('Login status check failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        profileId,
        accountId,
        serviceName,
      });

      return {
        status: 'ERROR',
        error: error instanceof Error ? error.message : 'Unknown error',
        checkedAt: new Date(),
      };
    }
  }

  /**
   * Получение или создание вкладки для мессенджера
   * 
   * Каждый мессенджер использует свою вкладку для изоляции.
   * 
   * @param profileId - ID профиля
   * @param serviceName - Имя мессенджера (whatsapp, telegram)
   * @param url - URL для навигации
   * @returns Page или null
   */
  private async getOrCreateMessengerPage(profileId: string, serviceName: string, url?: string): Promise<Page | null> {
    try {
      return await this.chromeProcessService.getOrCreateMessengerPage(profileId, serviceName, url);
    } catch (error) {
      logger.error('Failed to get/create messenger page', {
        error: error instanceof Error ? error.message : 'Unknown error',
        profileId,
        serviceName,
      });
      return null;
    }
  }

  /**
   * Получение вкладки мессенджера (без создания)
   * 
   * @param profileId - ID профиля
   * @param serviceName - Имя мессенджера
   * @returns Page или null
   */
  getMessengerPage(profileId: string, serviceName: string): Page | null {
    return this.chromeProcessService.getMessengerPage(profileId, serviceName);
  }

  /**
   * Проверка, запущен ли профиль
   * 
   * @param profileId - ID профиля
   * @returns true если профиль запущен
   */
  isProfileRunning(profileId: string): boolean {
    return this.chromeProcessService.isProfileRunning(profileId);
  }

  /**
   * Ввод облачного пароля (2FA) для Telegram
   * 
   * Использует вкладку Telegram для ввода пароля.
   * 
   * @param profileId - ID профиля
   * @param accountId - ID аккаунта
   * @param password - Облачный пароль
   * @returns Результат ввода пароля
   */
  async submitCloudPassword(
    profileId: string,
    accountId: string,
    password: string
  ): Promise<{ success: boolean; status: string; error?: string }> {
    try {
      logger.debug('Submitting cloud password', {
        profileId,
        accountId,
      });

      // Проверка, запущен ли профиль
      if (!this.chromeProcessService.isProfileRunning(profileId)) {
        throw new Error(`Profile ${profileId} is not running`);
      }

      // Получение вкладки Telegram
      const page = this.getMessengerPage(profileId, 'telegram');
      if (!page) {
        throw new Error(`Telegram tab not found for profile ${profileId}. Please check status first.`);
      }

      // Получение Telegram чекера
      const checker = getCheckerOrThrow('telegram');

      // Проверяем, поддерживает ли чекер ввод пароля
      if (!isCloudPasswordChecker(checker)) {
        throw new Error('Telegram checker does not support cloud password');
      }

      // Вызов метода ввода пароля
      const success = await checker.enterCloudPassword(page, password);

      if (success) {
        logger.info('Cloud password submitted successfully', {
          profileId,
          accountId,
        });
        return { success: true, status: 'PENDING' };
      } else {
        return {
          success: false,
          status: 'NOT_LOGGED_IN',
          error: 'Failed to enter password - input field not found',
        };
      }
    } catch (error) {
      logger.error('Failed to submit cloud password', {
        error: error instanceof Error ? error.message : 'Unknown error',
        profileId,
        accountId,
      });

      return {
        success: false,
        status: 'ERROR',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

