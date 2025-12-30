/**
 * Базовый класс для проверки статуса входа в мессенджеры
 * 
 * Определяет интерфейс для всех чекеров мессенджеров.
 * Каждый мессенджер должен реализовать этот класс со своей логикой проверки.
 * 
 * @module modules/profiles/messenger-accounts/checkers/base-checker
 */

import { Page } from 'puppeteer';
import { MessengerAccountStatus } from '@prisma/client';
import { LoginCheckResult, CheckerConfig, CheckContext } from './types';
import logger from '../../../../config/logger';

/**
 * Базовый класс для проверки статуса входа
 */
export abstract class BaseChecker {
  protected config: CheckerConfig;

  constructor(config: CheckerConfig = {}) {
    this.config = {
      pageLoadTimeout: config.pageLoadTimeout ?? 60000, // 60 секунд по умолчанию (увеличено для WhatsApp)
      elementWaitTimeout: config.elementWaitTimeout ?? 15000, // 15 секунд по умолчанию
      qrScreenshotTimeout: config.qrScreenshotTimeout ?? 10000, // 10 секунд по умолчанию
      maxRetries: config.maxRetries ?? 3,
      ...config,
    };
  }

  /**
   * Получить тип мессенджера (техническое имя)
   */
  abstract getServiceType(): string;

  /**
   * Получить URL для проверки статуса
   */
  abstract getCheckUrl(): string;

  /**
   * Проверить статус входа в мессенджер
   * 
   * Основной метод, который вызывается для проверки статуса.
   * Использует абстрактные методы для конкретной реализации.
   * ВКЛЮЧАЕТ РЕТРАИ при ошибках.
   * 
   * @param page - Puppeteer Page instance
   * @param context - Контекст проверки
   * @returns Результат проверки
   */
  async checkLoginStatus(page: Page, context: CheckContext): Promise<LoginCheckResult> {
    const maxRetries = this.config.maxRetries ?? 3;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        logger.debug('Starting login status check', {
          serviceType: this.getServiceType(),
          profileId: context.profileId,
          accountId: context.accountId,
          attempt,
          maxRetries,
        });

        // Переход на страницу мессенджера
        await this.navigateToPage(page, context);

        // Ожидание загрузки страницы
        await this.waitForPageLoad(page);

        // Проверка статуса через DOM элементы
        const status = await this.checkStatusFromDOM(page, context);

        // Формирование результата
        const result: LoginCheckResult = {
          status,
          checkedAt: new Date(),
        };

        // Если требуется вход - получаем QR код и дополнительные данные
        if (status === 'NOT_LOGGED_IN') {
          const loginData = await this.getLoginData(page, context);
          result.qrCode = loginData.qrCode;
          result.cloudPasswordRequired = loginData.cloudPasswordRequired;
          result.metadata = loginData.metadata;
        }

        logger.debug('Login status check completed', {
          serviceType: this.getServiceType(),
          profileId: context.profileId,
          status: result.status,
          attempt,
        });

        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        
        logger.warn('Login status check attempt failed', {
          error: lastError.message,
          serviceType: this.getServiceType(),
          profileId: context.profileId,
          accountId: context.accountId,
          attempt,
          maxRetries,
        });

        // Если это не последняя попытка - ждем перед следующей
        if (attempt < maxRetries) {
          const retryDelay = Math.min(1000 * Math.pow(2, attempt - 1), 5000); // Экспоненциальная задержка (max 5 сек)
          logger.debug('Waiting before retry', { retryDelay, attempt });
          await new Promise((resolve) => setTimeout(resolve, retryDelay));
        }
      }
    }

    // Все попытки исчерпаны
    logger.error('Login status check failed after all retries', {
      error: lastError?.message ?? 'Unknown error',
      serviceType: this.getServiceType(),
      profileId: context.profileId,
      accountId: context.accountId,
      maxRetries,
    });

    return {
      status: 'ERROR',
      error: lastError?.message ?? 'Unknown error',
      checkedAt: new Date(),
    };
  }

  /**
   * Переход на страницу мессенджера (умная навигация)
   * 
   * Если страница уже на нужном URL - не перезагружаем, только парсим элементы.
   * Это позволяет обновлять QR код без полной перезагрузки страницы.
   * 
   * @param page - Puppeteer Page instance
   * @param context - Контекст проверки
   */
  protected async navigateToPage(page: Page, context: CheckContext): Promise<void> {
    const targetUrl = context.url || this.getCheckUrl();
    
    // Получаем текущий URL страницы
    let currentUrl = '';
    try {
      currentUrl = page.url();
    } catch {
      // Игнорируем ошибку - страница может быть закрыта
    }

    // Проверяем, нужна ли навигация
    // Для WhatsApp проверяем, что мы на web.whatsapp.com
    const targetDomain = new URL(targetUrl).hostname;
    const isAlreadyOnPage = currentUrl.includes(targetDomain);

    if (isAlreadyOnPage) {
      logger.debug('Page already on target URL, skipping navigation', {
        serviceType: this.getServiceType(),
        currentUrl,
        targetUrl,
        profileId: context.profileId,
      });
      
      // Небольшая пауза для обновления DOM (QR код может обновиться)
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return;
    }

    logger.debug('Navigating to messenger page', {
      serviceType: this.getServiceType(),
      targetUrl,
      currentUrl,
      profileId: context.profileId,
    });

    // Для WhatsApp используем увеличенный таймаут, так как он может загружаться дольше
    const baseTimeout = this.config.pageLoadTimeout ?? 60000;
    const timeout = this.getServiceType() === 'whatsapp' 
      ? Math.max(baseTimeout, 90000) // Минимум 90 секунд для WhatsApp
      : baseTimeout;

    await page.goto(targetUrl, {
      waitUntil: 'domcontentloaded', // Изменено с networkidle2 для более быстрой загрузки
      timeout,
    });
  }

  /**
   * Ожидание загрузки страницы
   * 
   * Можно переопределить для специфичной логики ожидания.
   * Использует умное ожидание - короче если страница уже загружена.
   * 
   * @param page - Puppeteer Page instance
   */
  protected async waitForPageLoad(page: Page): Promise<void> {
    const serviceType = this.getServiceType();
    
    // Проверяем, загружена ли уже страница (есть ли основные элементы)
    let isPageReady = false;
    try {
      if (serviceType === 'whatsapp') {
        // Для WhatsApp проверяем наличие основных элементов
        // Код выполняется в браузерном контексте через Puppeteer, поэтому document доступен
        isPageReady = await page.evaluate(() => {
          // @ts-expect-error - document доступен в браузерном контексте Puppeteer
          const doc = document;
          if (!doc) return false;
          return !!(doc.querySelector('#side') || doc.querySelector('canvas') || doc.querySelector('[data-ref]'));
        });
      }
    } catch {
      // Игнорируем ошибку
    }

    if (isPageReady) {
      // Страница уже готова - минимальное ожидание для обновления DOM
      logger.debug('Page already loaded, using short wait time', { serviceType });
      await new Promise((resolve) => setTimeout(resolve, 500));
    } else {
      // Страница загружается - полное ожидание
      const waitTime = serviceType === 'whatsapp' ? 8000 : 3000;
      logger.debug('Waiting for page to fully load', { serviceType, waitTime });
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }
  }

  /**
   * Проверка статуса входа через DOM элементы
   * 
   * Абстрактный метод, должен быть реализован в каждом чекере.
   * Проверяет наличие определенных DOM элементов для определения статуса.
   * 
   * @param page - Puppeteer Page instance
   * @param context - Контекст проверки
   * @returns Статус входа
   */
  protected abstract checkStatusFromDOM(
    page: Page,
    context: CheckContext
  ): Promise<MessengerAccountStatus>;

  /**
   * Получение данных для входа (QR код и т.д.)
   * 
   * Вызывается только если статус NOT_LOGGED_IN.
   * Можно переопределить для специфичной логики.
   * 
   * @param page - Puppeteer Page instance
   * @param context - Контекст проверки
   * @returns Данные для входа
   */
  protected async getLoginData(
    page: Page,
    context: CheckContext
  ): Promise<{
    qrCode?: string;
    cloudPasswordRequired?: boolean;
    metadata?: Record<string, unknown>;
  }> {
    // Базовая реализация - пытаемся получить QR код
    const qrCode = await this.getQRCode(page, context);
    
    return {
      qrCode,
      cloudPasswordRequired: false,
    };
  }

  /**
   * Получение QR кода со страницы
   * 
   * Абстрактный метод, должен быть реализован в каждом чекере.
   * 
   * @param page - Puppeteer Page instance
   * @param context - Контекст проверки
   * @returns QR код в формате base64 или undefined
   */
  protected abstract getQRCode(page: Page, context: CheckContext): Promise<string | undefined>;

  /**
   * Ожидание появления элемента
   * 
   * Вспомогательный метод для ожидания появления DOM элементов.
   * 
   * @param page - Puppeteer Page instance
   * @param selector - CSS селектор элемента
   * @param timeout - Таймаут ожидания
   * @returns true если элемент появился, false иначе
   */
  protected async waitForElement(
    page: Page,
    selector: string,
    timeout?: number
  ): Promise<boolean> {
    try {
      await page.waitForSelector(selector, {
        timeout: timeout ?? this.config.elementWaitTimeout,
      });
      return true;
    } catch (error) {
      logger.debug('Element not found', {
        selector,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  /**
   * Проверка существования элемента
   * 
   * @param page - Puppeteer Page instance
   * @param selector - CSS селектор элемента
   * @returns true если элемент существует, false иначе
   */
  protected async elementExists(page: Page, selector: string): Promise<boolean> {
    try {
      const element = await page.$(selector);
      return element !== null;
    } catch (error) {
      logger.debug('Error checking element existence', {
        selector,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  /**
   * Получение текста элемента
   * 
   * @param page - Puppeteer Page instance
   * @param selector - CSS селектор элемента
   * @returns Текст элемента или null
   */
  protected async getElementText(page: Page, selector: string): Promise<string | null> {
    try {
      return await page.$eval(selector, (el) => el.textContent);
    } catch (error) {
      logger.debug('Error getting element text', {
        selector,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  /**
   * Получение скриншота элемента в base64
   * 
   * @param page - Puppeteer Page instance
   * @param selector - CSS селектор элемента
   * @returns Base64 изображение или undefined
   */
  protected async getElementScreenshot(
    page: Page,
    selector: string
  ): Promise<string | undefined> {
    try {
      const element = await page.$(selector);
      if (!element) {
        return undefined;
      }

      const screenshot = await element.screenshot({ encoding: 'base64' });
      return screenshot as string;
    } catch (error) {
      logger.warn('Failed to take element screenshot', {
        selector,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return undefined;
    }
  }

  /**
   * Выполнение JavaScript в контексте страницы
   * 
   * @param page - Puppeteer Page instance
   * @param script - JavaScript код для выполнения
   * @returns Результат выполнения
   */
  protected async evaluateScript<T>(page: Page, script: () => T): Promise<T> {
    try {
      return await page.evaluate(script);
    } catch (error) {
      logger.warn('Failed to evaluate script', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }
}

