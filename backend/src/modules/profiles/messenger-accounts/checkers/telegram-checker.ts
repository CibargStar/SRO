/**
 * Чекер статуса входа для Telegram
 * 
 * Проверяет статус входа в Telegram Web через анализ DOM элементов.
 * Определяет статус по наличию определенных элементов на странице.
 * 
 * @module modules/profiles/messenger-accounts/checkers/telegram-checker
 */

import { Page } from 'puppeteer';
import { MessengerAccountStatus } from '@prisma/client';
import { BaseChecker } from './base-checker';
import { CheckContext } from './types';
import logger from '../../../../config/logger';

// Глобальные объекты браузера для TypeScript без DOM либ
// Код выполняется в браузерном контексте через Puppeteer, поэтому document доступен
// Эти типы используются только внутри page.evaluate() блоков

/**
 * Селекторы DOM для Telegram Web K (web.telegram.org/k/)
 * 
 * ВАЖНО: Telegram Web K грузится асинхронно!
 * Сначала показывается loader, потом либо QR код, либо чаты.
 * 
 * КРИТИЧНО: На странице 2FA есть обезьянка с canvas, которую НЕЛЬЗЯ путать с QR!
 */
const TELEGRAM_SELECTORS = {
  // Индикатор загрузки приложения (пока виден - страница не готова!)
  LOADING_INDICATOR: [
    '.preloader-container', // Основной лоадер
    '.loading-screen', // Экран загрузки
    '#loading', // ID загрузки
  ],

  // Селекторы для ТОЧНОГО определения залогиненного состояния
  LOGGED_IN_INDICATOR: [
    '.chatlist-chat', // Элемент чата в списке
    '.chat-input-container', // Поле ввода сообщения
    '.messages-container', // Контейнер сообщений
    '#column-center .bubbles', // Пузыри сообщений
  ],
  
  // Селекторы для QR кода canvas
  QR_CODE_CONTAINER: [
    'canvas.qr-canvas', // ✅ Canvas с классом qr-canvas
    '.qr-canvas', // Canvas QR кода
    '.qr-container canvas', // Canvas внутри контейнера
  ],
  
  // Селекторы страницы с QR кодом
  QR_PAGE_INDICATOR: [
    '.qr-canvas', // ✅ Canvas QR кода
    '.qr-container', // Контейнер QR кода
    '.page-signQR.active', // Активная страница QR
  ],
  
  // Селекторы, указывающие на страницу авторизации
  LOGIN_REQUIRED_INDICATOR: [
    '.auth-form', // Форма авторизации
    '.input-wrapper.phone-input', // Поле ввода телефона
    '#auth-pages', // Контейнер страниц авторизации
  ],
  
  // Селекторы для поля ввода облачного пароля (2FA)
  CLOUD_PASSWORD_INPUT: [
    '.page-password.active input[type="password"]', // ✅ Точный селектор!
    '.page-password input[type="password"]',
    'input[type="password"].input-field-input',
    'input[name="notsearch_password"]',
  ],
  
  // Индикаторы страницы 2FA (пароль) - ТОЛЬКО активные!
  TWO_FA_PAGE_INDICATOR: [
    '.page-password.active', // ✅ ТОЛЬКО активная страница пароля!
  ],
} as const;

/**
 * Время ожидания загрузки Telegram (мс)
 */
const TELEGRAM_TIMEOUTS = {
  PAGE_LOAD: 15000, // Максимальное ожидание загрузки страницы
  ELEMENT_APPEAR: 10000, // Ожидание появления элемента
  AFTER_NAVIGATION: 5000, // Пауза после навигации для загрузки JS
} as const;

/**
 * Чекер статуса входа для Telegram
 */
export class TelegramChecker extends BaseChecker {
  private readonly serviceType = 'telegram';

  /**
   * Получить тип мессенджера
   */
  getServiceType(): string {
    return this.serviceType;
  }

  /**
   * Получить URL для проверки статуса
   */
  getCheckUrl(): string {
    return 'https://web.telegram.org/k';
  }

  /**
   * Проверка статуса входа через DOM элементы
   * 
   * ВАЖНО: Порядок проверки критичен!
   * 1. Ждём загрузки
   * 2. Проверяем LOGGED_IN (самый надёжный)
   * 3. Проверяем 2FA (обезьянка = 100% 2FA)
   * 4. Проверяем QR код
   * 5. Проверяем форму входа
   * 
   * @param page - Puppeteer Page instance
   * @param context - Контекст проверки
   * @returns Статус входа
   */
  protected async checkStatusFromDOM(
    page: Page,
    context: CheckContext
  ): Promise<MessengerAccountStatus> {
    try {
      logger.debug('Checking Telegram login status from DOM', {
        profileId: context.profileId,
      });

      // 1. Ждём загрузки приложения Telegram
      const pageReady = await this.waitForTelegramLoad(page, context);
      if (!pageReady) {
        logger.warn('Telegram page did not load properly', { profileId: context.profileId });
        return 'UNKNOWN';
      }

      // 2. ПЕРВЫМ делом проверяем залогинен ли пользователь
      // Это самая надёжная проверка - чаты есть только у залогиненных
      const loggedIn = await this.checkLoggedInIndicators(page);
      if (loggedIn) {
        logger.info('Telegram LOGGED_IN - chat elements found', { profileId: context.profileId });
        return 'LOGGED_IN';
      }

      // 3. Проверяем страницу 2FA (обезьянка = 100% 2FA!)
      const is2FAPage = await this.check2FAPage(page);
      if (is2FAPage) {
        logger.info('Telegram 2FA page detected (monkey found)', { profileId: context.profileId });
        return 'NOT_LOGGED_IN';
      }

      // 4. Проверяем страницу с QR кодом
      const isQRPage = await this.checkQRPage(page);
      if (isQRPage) {
        logger.info('Telegram QR page detected', { profileId: context.profileId });
        return 'NOT_LOGGED_IN';
      }

      // 5. Проверяем общую страницу авторизации
      const loginRequired = await this.checkLoginRequiredIndicators(page);
      if (loginRequired) {
        logger.info('Telegram login required', { profileId: context.profileId });
        return 'NOT_LOGGED_IN';
      }

      // Не удалось определить статус
      logger.warn('Telegram status cannot be determined', {
        profileId: context.profileId,
        url: page.url(),
      });
      return 'UNKNOWN';
    } catch (error) {
      logger.error('Error checking Telegram status from DOM', {
        error: error instanceof Error ? error.message : 'Unknown error',
        profileId: context.profileId,
      });
      return 'ERROR';
    }
  }

  /**
   * Ожидание загрузки приложения Telegram
   * 
   * Telegram Web K загружается асинхронно:
   * 1. Сначала показывается loader
   * 2. Потом загружается JS приложение
   * 3. Потом показывается либо QR код, либо чаты
   * 
   * @param page - Puppeteer Page instance
   * @param context - Контекст проверки
   * @returns true если страница загружена
   */
  private async waitForTelegramLoad(page: Page, context: CheckContext): Promise<boolean> {
    try {
      logger.debug('Waiting for Telegram to load', { profileId: context.profileId });

      // Ждём исчезновения лоадера (если он есть)
      for (const loaderSelector of TELEGRAM_SELECTORS.LOADING_INDICATOR) {
        try {
          await page.waitForSelector(loaderSelector, { 
            hidden: true, 
            timeout: TELEGRAM_TIMEOUTS.PAGE_LOAD 
          });
          logger.debug('Telegram loader disappeared', { selector: loaderSelector });
        } catch {
          // Лоадер не найден или уже исчез - это ОК
        }
      }

      // Ждём появления ЛЮБОГО ключевого элемента (QR, форма авторизации, 2FA или чаты)
      const keySelectors = [
        ...TELEGRAM_SELECTORS.LOGIN_REQUIRED_INDICATOR,
        ...TELEGRAM_SELECTORS.LOGGED_IN_INDICATOR,
        ...TELEGRAM_SELECTORS.TWO_FA_PAGE_INDICATOR,
        ...TELEGRAM_SELECTORS.QR_PAGE_INDICATOR,
      ];

      // Пробуем дождаться любого из селекторов
      const waitPromises = keySelectors.map(selector => 
        page.waitForSelector(selector, { 
          timeout: TELEGRAM_TIMEOUTS.ELEMENT_APPEAR,
          visible: true,
        }).then(() => selector).catch(() => null)
      );

      const foundSelector = await Promise.race([
        Promise.any(waitPromises.map(p => p.then(s => s ? s : Promise.reject()))),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), TELEGRAM_TIMEOUTS.ELEMENT_APPEAR))
      ]).catch(() => null);

      if (foundSelector) {
        logger.debug('Telegram page loaded, found element', { 
          selector: foundSelector,
          profileId: context.profileId,
        });
        
        // Небольшая пауза для стабилизации DOM
        await new Promise((resolve) => setTimeout(resolve, 1000));
        return true;
      }

      // Проверяем, что страница вообще загрузилась (есть body)
      const hasContent = await page.evaluate(() => {
        const body = document.body;
        return body && body.children.length > 0 && body.innerHTML.length > 100;
      });

      if (hasContent) {
        logger.debug('Telegram page has content but no key elements found', {
          profileId: context.profileId,
        });
        // Дополнительная пауза - может приложение ещё загружается
        await new Promise((resolve) => setTimeout(resolve, 3000));
        return true;
      }

      logger.warn('Telegram page appears empty', { profileId: context.profileId });
      return false;
    } catch (error) {
      logger.error('Error waiting for Telegram load', {
        error: error instanceof Error ? error.message : 'Unknown error',
        profileId: context.profileId,
      });
      return false;
    }
  }

  /**
   * Проверка элемента на видимость
   */
  private async isElementVisible(page: Page, selector: string): Promise<boolean> {
    try {
      const element = await page.$(selector);
      if (!element) return false;

      return await page.evaluate((sel) => {
        const el = document.querySelector(sel);
        if (!el) return false;
        const style = window.getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        return style.display !== 'none' && 
               style.visibility !== 'hidden' && 
               style.opacity !== '0' &&
               rect.width > 0 && 
               rect.height > 0;
      }, selector);
    } catch {
      return false;
    }
  }

  /**
   * Проверка индикаторов залогиненного состояния
   */
  private async checkLoggedInIndicators(page: Page): Promise<boolean> {
    for (const selector of TELEGRAM_SELECTORS.LOGGED_IN_INDICATOR) {
      if (await this.isElementVisible(page, selector)) {
        logger.debug('Telegram logged in indicator found', { selector });
        return true;
      }
    }
    return false;
  }

  /**
   * Проверка страницы 2FA (облачный пароль)
   * 
   * КРИТИЧНО: Проверяем ТОЛЬКО .page-password.active!
   * .page-password без .active может существовать в DOM когда показан QR.
   */
  private async check2FAPage(page: Page): Promise<boolean> {
    // ГЛАВНАЯ ПРОВЕРКА: активная страница пароля
    const isPasswordPageActive = await this.isElementVisible(page, '.page-password.active');
    
    if (isPasswordPageActive) {
      logger.debug('Telegram 2FA: .page-password.active found');
      return true;
    }

    // Дополнительная проверка через evaluate для точности
    const is2FAPage = await page.evaluate(() => {
      // Проверяем, что активна именно страница пароля
      const passwordTab = document.querySelector('.page-password.active');
      if (passwordTab) return true;

      // Проверяем, что НЕ активна страница QR
      const qrTab = document.querySelector('.page-signQR.active');
      if (qrTab) return false;

      // Проверяем наличие видимого поля пароля И отсутствие QR контейнера
      const passwordInput = document.querySelector('input[type="password"]');
      const qrContainer = document.querySelector('.qr-container');
      
      if (passwordInput && !qrContainer) {
        const rect = (passwordInput as HTMLElement).getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          return true;
        }
      }

      return false;
    });

    if (is2FAPage) {
      logger.debug('Telegram 2FA detected via evaluate');
      return true;
    }

    return false;
  }

  /**
   * Проверка страницы с QR кодом
   */
  private async checkQRPage(page: Page): Promise<boolean> {
    // Проверяем наличие контейнера QR
    for (const selector of TELEGRAM_SELECTORS.QR_PAGE_INDICATOR) {
      if (await this.isElementVisible(page, selector)) {
        logger.debug('Telegram QR page indicator found', { selector });
        return true;
      }
    }
    return false;
  }

  /**
   * Проверка индикаторов необходимости входа (форма телефона)
   */
  private async checkLoginRequiredIndicators(page: Page): Promise<boolean> {
    for (const selector of TELEGRAM_SELECTORS.LOGIN_REQUIRED_INDICATOR) {
      if (await this.isElementVisible(page, selector)) {
        logger.debug('Telegram login required indicator found', { selector });
        return true;
      }
    }
    return false;
  }

  /**
   * Получение данных для входа (QR код или запрос пароля)
   * 
   * Логика:
   * 1. Проверяем какая страница активна
   * 2. Если 2FA - возвращаем cloudPasswordRequired
   * 3. Если QR - возвращаем qrCode
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
    const result: {
      qrCode?: string;
      cloudPasswordRequired?: boolean;
      metadata?: Record<string, unknown>;
    } = {};

    // Определяем тип страницы через evaluate
    // Код выполняется в браузерном контексте через Puppeteer, поэтому document доступен
    const pageType = await page.evaluate(() => {
      // @ts-expect-error - document доступен в браузерном контексте Puppeteer
      const passwordActive = document.querySelector('.page-password.active');
      // @ts-expect-error - document доступен в браузерном контексте Puppeteer
      const qrActive = document.querySelector('.page-signQR.active');
      // Ищем QR canvas с разными селекторами
      // @ts-expect-error - document доступен в браузерном контексте Puppeteer
      const qrCanvas1 = document.querySelector('canvas.qr-canvas');
      // @ts-expect-error - document доступен в браузерном контексте Puppeteer
      const qrCanvas2 = document.querySelector('.qr-canvas');
      // @ts-expect-error - document доступен в браузерном контексте Puppeteer
      const qrCanvas3 = document.querySelector('.qr-container canvas');
      const qrCanvas = qrCanvas1 || qrCanvas2 || qrCanvas3;
      
      if (passwordActive) return 'password';
      if (qrActive || qrCanvas) return 'qr';
      return 'unknown';
      // @ts-expect-error - код выполняется в браузерном контексте
    });

    logger.debug('Telegram page type detected', { profileId: context.profileId, pageType });

    if (pageType === 'password') {
      result.cloudPasswordRequired = true;
      result.qrCode = undefined;
      logger.info('Telegram: Password page active', { profileId: context.profileId });
      return result;
    }

    if (pageType === 'qr') {
      result.cloudPasswordRequired = false;
      result.qrCode = await this.getQRCode(page, context);
      logger.info('Telegram: QR page active', { 
        profileId: context.profileId, 
        hasQRCode: !!result.qrCode 
      });
      return result;
    }

    // Fallback: проверяем старым методом
    const is2FA = await this.check2FAPage(page);
    if (is2FA) {
      result.cloudPasswordRequired = true;
      logger.info('Telegram: 2FA detected (fallback)', { profileId: context.profileId });
      return result;
    }

    // Пробуем получить QR
    result.cloudPasswordRequired = false;
    result.qrCode = await this.getQRCode(page, context);

    logger.debug('Telegram login data (fallback)', {
      profileId: context.profileId,
      hasQRCode: !!result.qrCode,
      cloudPasswordRequired: result.cloudPasswordRequired,
    });

    return result;
  }

  /**
   * Обновление QR кода на странице без перезагрузки
   * 
   * Telegram показывает кнопку обновления когда QR истёк.
   * Также можно триггернуть обновление кликом на QR область.
   * 
   * @param page - Puppeteer Page instance
   * @returns true если QR код был обновлён
   */
  private async refreshQRCode(page: Page): Promise<boolean> {
    try {
      // Проверяем, истёк ли QR код (есть кнопка "Show QR" или подобная)
      const needsRefresh = await page.evaluate(() => {
        // Ищем кнопку обновления QR или текст о истечении
        const refreshButton = document.querySelector('.qr-container .btn-primary') ||
                              document.querySelector('.qr-container button') ||
                              document.querySelector('[class*="qr"] button') ||
                              document.querySelector('.auth-image button');
        
        // Проверяем, скрыт ли canvas (QR истёк)
        const qrCanvas = document.querySelector('canvas.qr-canvas') ||
                         document.querySelector('.qr-canvas');
        if (qrCanvas) {
          const style = window.getComputedStyle(qrCanvas);
          const isHidden = style.display === 'none' || 
                          style.visibility === 'hidden' ||
                          style.opacity === '0';
          if (isHidden) return true;
        }
        
        // Если есть кнопка обновления - кликаем
        if (refreshButton) {
          (refreshButton as HTMLElement).click();
          return true;
        }
        
        // Проверяем текст на странице
        const pageText = document.body.innerText.toLowerCase();
        if (pageText.includes('expired') || 
            pageText.includes('истёк') ||
            pageText.includes('retry') ||
            pageText.includes('повторить')) {
          // Пробуем кликнуть на QR контейнер для обновления
          const qrContainer = document.querySelector('.qr-container') ||
                              document.querySelector('[class*="qr"]');
          if (qrContainer) {
            (qrContainer as HTMLElement).click();
            return true;
          }
        }
        
        return false;
      });

      if (needsRefresh) {
        logger.info('Telegram: Triggering QR refresh');
        // Ждём обновления QR
        await new Promise((resolve) => setTimeout(resolve, 2000));
        return true;
      }

      return false;
    } catch (error) {
      logger.debug('Error checking QR refresh', { 
        error: error instanceof Error ? error.message : 'Unknown' 
      });
      return false;
    }
  }

  /**
   * Получение QR кода со страницы
   * 
   * Ищем canvas с классом .qr-canvas и при необходимости обновляем
   * 
   * @param page - Puppeteer Page instance
   * @param context - Контекст проверки
   * @returns QR код в формате base64 или undefined
   */
  protected async getQRCode(
    page: Page,
    context: CheckContext
  ): Promise<string | undefined> {
    try {
      logger.debug('Getting Telegram QR code', { profileId: context.profileId });

      // КРИТИЧНО: Активируем вкладку перед получением QR кода!
      // Браузер не рендерит canvas на неактивных вкладках
      await page.bringToFront();
      
      // Даем время на рендеринг после активации
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Сначала пробуем обновить QR если он истёк
      await this.refreshQRCode(page);

      // Проверяем состояние страницы через evaluate
      const pageState = await page.evaluate(() => {
        const qrPageActive = document.querySelector('.page-signQR.active');
        const passwordPageActive = document.querySelector('.page-password.active');
        // Ищем canvas с классом qr-canvas
        const qrCanvas = document.querySelector('canvas.qr-canvas') as HTMLCanvasElement ||
                         document.querySelector('.qr-canvas') as HTMLCanvasElement ||
                         document.querySelector('.qr-container canvas') as HTMLCanvasElement;
        
        let canvasData: string | null = null;
        if (qrCanvas && qrCanvas.width > 50 && qrCanvas.height > 50) {
          try {
            // Получаем данные canvas напрямую (без скриншота)
            canvasData = qrCanvas.toDataURL('image/png');
          } catch {
            // Может быть CORS ошибка
          }
        }
        
        return {
          isQRPageActive: !!qrPageActive,
          isPasswordPageActive: !!passwordPageActive,
          hasQRCanvas: !!qrCanvas,
          canvasSize: qrCanvas ? { width: qrCanvas.width, height: qrCanvas.height } : null,
          canvasClass: qrCanvas ? qrCanvas.className : null,
          canvasData, // Данные canvas напрямую
        };
      });

      logger.debug('Telegram page state for QR', { 
        profileId: context.profileId, 
        ...pageState,
        canvasData: pageState.canvasData ? 'present' : 'absent',
      });

      // Если активна страница пароля - QR нет
      if (pageState.isPasswordPageActive) {
        logger.debug('Telegram: Password page active, no QR', { profileId: context.profileId });
        return undefined;
      }

      // Если получили данные canvas напрямую - возвращаем
      if (pageState.canvasData && pageState.canvasData.length > 100) {
        logger.info('Telegram QR code captured via toDataURL', { profileId: context.profileId });
        return pageState.canvasData;
      }

      // Если нет QR canvas - пробуем подождать и обновить
      if (!pageState.hasQRCanvas) {
        logger.debug('Telegram: No QR canvas found, trying to refresh...', { profileId: context.profileId });
        
        // Пробуем обновить QR
        await this.refreshQRCode(page);
        await new Promise((resolve) => setTimeout(resolve, 2000));
        
        // Проверяем ещё раз
        const hasCanvas = await page.evaluate(() => {
          const canvas = document.querySelector('canvas.qr-canvas') ||
                         document.querySelector('.qr-canvas') ||
                         document.querySelector('.qr-container canvas');
          return !!canvas;
        });

        if (!hasCanvas) {
          logger.warn('Telegram: QR canvas still not found after refresh', { profileId: context.profileId });
          return undefined;
        }
      }

      // Определяем правильный селектор
      const qrSelector = await page.evaluate(() => {
        if (document.querySelector('canvas.qr-canvas')) return 'canvas.qr-canvas';
        if (document.querySelector('.qr-canvas')) return '.qr-canvas';
        if (document.querySelector('.qr-container canvas')) return '.qr-container canvas';
        return null;
      });

      if (!qrSelector) {
        logger.warn('Telegram: Could not find QR selector', { profileId: context.profileId });
        return undefined;
      }

      logger.debug('Telegram: Using QR selector', { profileId: context.profileId, qrSelector });

      // Пробуем получить данные canvas напрямую (второй раз)
      const directData = await page.evaluate((sel) => {
        const canvas = document.querySelector(sel) as HTMLCanvasElement;
        if (!canvas || canvas.width < 50 || canvas.height < 50) return null;
        try {
          return canvas.toDataURL('image/png');
        } catch {
          return null;
        }
      }, qrSelector);

      if (directData && directData.length > 100) {
        logger.info('Telegram QR code captured via toDataURL (second attempt)', { profileId: context.profileId });
        return directData;
      }

      // Fallback: делаем скриншот QR кода
      logger.debug('Telegram: Capturing QR via screenshot', { profileId: context.profileId, qrSelector });
      await new Promise((resolve) => setTimeout(resolve, 500));
      
      const qrCode = await this.getElementScreenshot(page, qrSelector);
      if (qrCode) {
        logger.info('Telegram QR code captured via screenshot', { profileId: context.profileId });
        return qrCode;
      }

      logger.warn('Telegram: Failed to capture QR', { profileId: context.profileId });
      return undefined;
    } catch (error) {
      logger.error('Error getting Telegram QR code', {
        error: error instanceof Error ? error.message : 'Unknown error',
        profileId: context.profileId,
      });
      return undefined;
    }
  }

  /**
   * Ввод облачного пароля
   * 
   * @param page - Puppeteer Page instance
   * @param password - Облачный пароль
   * @returns true если пароль успешно введен
   */
  async enterCloudPassword(page: Page, password: string): Promise<boolean> {
    try {
      logger.info('=== Entering Telegram cloud password ===');

      // Сначала проверим, что мы на странице 2FA
      const is2FA = await this.check2FAPage(page);
      if (!is2FA) {
        logger.warn('Not on 2FA page, cannot enter password');
        return false;
      }

      // Ждём немного для стабилизации страницы
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Находим поле пароля через evaluate (самый надёжный способ)
      const inputInfo = await page.evaluate(() => {
        // Ищем активную страницу пароля
        const passwordPage = document.querySelector('.page-password.active') || document.querySelector('.page-password');
        if (!passwordPage) {
          logger.debug('Password page not found');
          return null;
        }

        // Ищем input внутри неё
        const input = passwordPage.querySelector('input[type="password"]') || 
                      passwordPage.querySelector('.input-field-input') ||
                      document.querySelector('input[type="password"]');
        
        if (!input) {
          logger.debug('Password input not found');
          return null;
        }

        const rect = (input as HTMLElement).getBoundingClientRect();
        return {
          found: true,
          tagName: input.tagName,
          type: (input as HTMLInputElement).type,
          className: input.className,
          x: rect.x + rect.width / 2,
          y: rect.y + rect.height / 2,
          width: rect.width,
          height: rect.height,
        };
      });

      logger.info('Password input search result', { inputInfo });

      if (!inputInfo || !inputInfo.found) {
        logger.error('Password input not found on page');
        return false;
      }

      // Кликаем по координатам поля ввода
      logger.info('Clicking at password input coordinates', { x: inputInfo.x, y: inputInfo.y });
      await page.mouse.click(inputInfo.x, inputInfo.y);
      await new Promise((resolve) => setTimeout(resolve, 300));

      // Очищаем поле через keyboard
      await page.keyboard.down('Control');
      await page.keyboard.press('KeyA');
      await page.keyboard.up('Control');
      await page.keyboard.press('Backspace');
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Вводим пароль через keyboard.type (самый надёжный метод)
      logger.info('Typing password via keyboard...');
      await page.keyboard.type(password, { delay: 30 });
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Проверяем, что пароль введён
      const inputValue = await page.evaluate(() => {
        const input = document.querySelector('.page-password.active input[type="password"]') ||
                      document.querySelector('.page-password input[type="password"]') ||
                      document.querySelector('input[type="password"]');
        return input ? (input as HTMLInputElement).value.length : 0;
      });

      logger.info('Password input check', { valueLength: inputValue, expectedLength: password.length });

      if (inputValue === 0) {
        logger.warn('Password was not typed, trying alternative method');
        
        // Альтернативный метод: фокус через evaluate и ввод
        await page.evaluate((pwd) => {
          const input = document.querySelector('.page-password input[type="password"]') ||
                        document.querySelector('input[type="password"]');
          if (input) {
            (input as HTMLInputElement).focus();
            (input as HTMLInputElement).value = pwd;
            // Триггерим события
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
          }
        }, password);
        
        await new Promise((resolve) => setTimeout(resolve, 300));
      }

      logger.info('Looking for submit button...');

      // Ищем и кликаем кнопку отправки
      const buttonClicked = await page.evaluate(() => {
        const passwordPage = document.querySelector('.page-password.active') || document.querySelector('.page-password');
        if (!passwordPage) return false;

        // Ищем кнопку
        const button = passwordPage.querySelector('.btn-primary') ||
                       passwordPage.querySelector('button') ||
                       document.querySelector('.btn-primary');
        
        if (button && (button as HTMLElement).offsetWidth > 0) {
          (button as HTMLElement).click();
          return true;
        }
        return false;
      });

      if (buttonClicked) {
        logger.info('Submit button clicked via evaluate');
        await new Promise((resolve) => setTimeout(resolve, 2000));
        return true;
      }

      // Fallback: нажимаем Enter
      logger.info('No button found, pressing Enter');
      await page.keyboard.press('Enter');
      await new Promise((resolve) => setTimeout(resolve, 2000));

      logger.info('=== Cloud password entry completed ===');
      return true;
    } catch (error) {
      logger.error('Error entering cloud password', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      });
      return false;
    }
  }
}

