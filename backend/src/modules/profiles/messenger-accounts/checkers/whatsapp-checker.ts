/**
 * Чекер статуса входа для WhatsApp
 * 
 * Проверяет статус входа в WhatsApp Web через анализ DOM элементов.
 * Определяет статус по наличию определенных элементов на странице.
 * 
 * @module modules/profiles/messenger-accounts/checkers/whatsapp-checker
 */

import { Page } from 'puppeteer';
import { MessengerAccountStatus } from '@prisma/client';
import { BaseChecker } from './base-checker';
import { CheckContext } from './types';
import logger from '../../../../config/logger';

// Глобальные объекты браузера для TypeScript без DOM либ
// Код выполняется в браузерном контексте через Puppeteer, поэтому document доступен
// @ts-expect-error - document доступен в браузерном контексте Puppeteer
declare const document: Document;

/**
 * Селекторы DOM для WhatsApp Web
 * ОБНОВЛЕНО: Добавлены дополнительные fallback селекторы для разных версий WhatsApp Web
 */
const WHATSAPP_SELECTORS = {
  // Селекторы для проверки статуса входа (множественные fallback'и)
  LOGGED_IN_INDICATOR: [
    'div[data-testid="chatlist"]', // Список чатов (основной)
    'div[data-testid="conversation-panel-wrapper"]', // Панель разговора
    '#side', // Боковая панель с чатами
    '[data-testid="chat"]', // Элемент чата
    '[data-testid="default-user"]', // Аватар пользователя
    '[data-testid="menu-bar-menu"]', // Меню
    'div[aria-label="Список чатов"]', // Aria-label для списка чатов
    'div[data-testid="chat-list"]', // Альтернативный список чатов
    'header[data-testid="chatlist-header"]', // Заголовок списка чатов
  ],
  
  // Селекторы для страницы входа (QR код) - расширенный список fallback'ов
  QR_CODE_CONTAINER: [
    'div[data-ref] canvas', // Canvas с QR кодом (основной)
    'canvas[aria-label*="QR"]', // Canvas с aria-label содержащим QR
    'div._akau canvas', // Новый класс контейнера WhatsApp
    'div[data-testid="qrcode"] canvas', // TestID для QR
    'div._2EZ_m canvas', // Старый альтернативный селектор
    'div._19vUU canvas', // Ещё один альтернативный контейнер
    '[data-testid="landing-wrapper"] canvas', // Landing wrapper
    'section canvas', // Любой canvas в section
    'canvas', // Последний fallback - любой canvas
  ],
  
  // Селекторы, указывающие на необходимость входа
  LOGIN_REQUIRED_INDICATOR: [
    'div[data-ref]', // Контейнер с data-ref (QR код) - основной
    'div._2EZ_m', // Контейнер QR кода (старый)
    'div._akau', // Новый контейнер QR кода
    'span[data-icon="qr-code"]', // Иконка QR кода
    '[data-testid="qrcode"]', // TestID для QR
    '[data-testid="landing-wrapper"]', // Landing wrapper (страница входа)
    'div._19vUU', // Альтернативный контейнер
    '[data-testid="intro-text"]', // Текст на странице входа
  ],
} as const;

/**
 * Чекер статуса входа для WhatsApp
 */
export class WhatsAppChecker extends BaseChecker {
  private readonly serviceType = 'whatsapp';

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
    return 'https://web.whatsapp.com';
  }

  /**
   * Проверка статуса входа через DOM элементы
   * 
   * Логика проверки:
   * 1. Ищем индикаторы залогиненного состояния (список чатов, панель разговора)
   * 2. Если не найдены - ищем индикаторы страницы входа (QR код)
   * 3. Определяем статус на основе найденных элементов
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
      logger.debug('Checking WhatsApp login status from DOM', {
        profileId: context.profileId,
      });

      // Проверяем индикаторы залогиненного состояния
      const loggedIn = await this.checkLoggedInIndicators(page);
      if (loggedIn) {
        logger.debug('WhatsApp logged in indicators found', {
          profileId: context.profileId,
        });
        return 'LOGGED_IN';
      }

      // Проверяем индикаторы необходимости входа
      const loginRequired = await this.checkLoginRequiredIndicators(page);
      if (loginRequired) {
        logger.debug('WhatsApp login required indicators found', {
          profileId: context.profileId,
        });
        return 'NOT_LOGGED_IN';
      }

      // Если не удалось определить статус - пробуем получить URL страницы для отладки
      let currentUrl = 'unknown';
      try {
        currentUrl = page.url();
      } catch {
        // Игнорируем ошибку получения URL
      }

      logger.warn('WhatsApp status cannot be determined', {
        profileId: context.profileId,
        url: currentUrl,
        message: 'No logged in or login required indicators found. Page might be loading or in unexpected state.',
      });
      return 'UNKNOWN';
    } catch (error) {
      logger.error('Error checking WhatsApp status from DOM', {
        error: error instanceof Error ? error.message : 'Unknown error',
        profileId: context.profileId,
      });
      return 'ERROR';
    }
  }

  /**
   * Проверка индикаторов залогиненного состояния
   * 
   * @param page - Puppeteer Page instance
   * @returns true если пользователь залогинен
   */
  private async checkLoggedInIndicators(page: Page): Promise<boolean> {
    // Проверяем наличие хотя бы одного индикатора залогиненного состояния
    for (const selector of WHATSAPP_SELECTORS.LOGGED_IN_INDICATOR) {
      const exists = await this.elementExists(page, selector);
      if (exists) {
        logger.debug('Logged in indicator found', { selector });
        return true;
      }
    }

    return false;
  }

  /**
   * Проверка индикаторов необходимости входа
   * 
   * @param page - Puppeteer Page instance
   * @returns true если требуется вход
   */
  private async checkLoginRequiredIndicators(page: Page): Promise<boolean> {
    // Проверяем наличие индикаторов необходимости входа
    for (const selector of WHATSAPP_SELECTORS.LOGIN_REQUIRED_INDICATOR) {
      const exists = await this.elementExists(page, selector);
      if (exists) {
        logger.debug('Login required indicator found', { selector });
        return true;
      }
    }

    return false;
  }

  /**
   * Получение QR кода со страницы
   * 
   * Ищет canvas с QR кодом и возвращает его как base64 изображение.
   * ОПТИМИЗИРОВАНО: Быстрый путь если QR уже отображается, длинный путь для первой загрузки.
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
      logger.debug('Getting WhatsApp QR code', {
        profileId: context.profileId,
      });

      // КРИТИЧНО: Активируем вкладку перед получением QR кода!
      // Браузер не рендерит canvas на неактивных вкладках
      await page.bringToFront();
      
      // Даем время на рендеринг после активации
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // БЫСТРЫЙ ПУТЬ: Проверяем, есть ли уже видимый QR код canvas
      for (const selector of WHATSAPP_SELECTORS.QR_CODE_CONTAINER) {
        try {
          // Быстрая проверка наличия элемента (без ожидания)
          const element = await page.$(selector);
          if (element) {
            // Проверяем, что canvas имеет содержимое
            const canvasHasContent = await page.evaluate((sel) => {
              // @ts-expect-error - HTMLCanvasElement доступен в браузерном контексте Puppeteer
              const canvas = document.querySelector(sel) as HTMLCanvasElement;
              if (!canvas) return false;
              return canvas.width > 0 && canvas.height > 0;
            }, selector);

            if (canvasHasContent) {
              // QR уже готов - делаем скриншот сразу
              logger.debug('QR code canvas already visible, taking screenshot immediately', {
                selector,
                profileId: context.profileId,
              });
              
              // Небольшая пауза для стабильности
              await new Promise((resolve) => setTimeout(resolve, 300));
              
              const qrCode = await this.getElementScreenshot(page, selector);
              if (qrCode) {
                logger.debug('QR code screenshot taken (fast path)', {
                  profileId: context.profileId,
                  selector,
                });
                return qrCode;
              }
            }
          }
        } catch {
          // Продолжаем поиск
        }
      }

      // МЕДЛЕННЫЙ ПУТЬ: QR еще не загружен, ждем
      logger.debug('QR code not immediately visible, waiting for load', {
        profileId: context.profileId,
      });

      // Ожидание первичной загрузки (только если быстрый путь не сработал)
      await new Promise((resolve) => setTimeout(resolve, 3000));

      // Ищем canvas с QR кодом
      for (const selector of WHATSAPP_SELECTORS.QR_CODE_CONTAINER) {
        try {
          // Ждем появления элемента
          await page.waitForSelector(selector, {
            timeout: 10000,
            visible: true,
          });

          logger.debug('QR code canvas found', {
            selector,
            profileId: context.profileId,
          });

          // Небольшое ожидание для отрисовки
          await new Promise((resolve) => setTimeout(resolve, 1000));

          // Проверяем, что canvas содержит изображение
          const canvasHasContent = await page.evaluate((sel) => {
            const canvas = document.querySelector(sel) as HTMLCanvasElement;
            if (!canvas) return false;
            return canvas.width > 0 && canvas.height > 0;
          }, selector);

          if (!canvasHasContent) {
            logger.warn('QR code canvas found but appears to be empty', {
              selector,
              profileId: context.profileId,
            });
            continue;
          }

          // Получаем скриншот canvas с QR кодом
          const qrCode = await this.getElementScreenshot(page, selector);
          if (qrCode) {
            logger.debug('QR code screenshot taken (slow path)', {
              profileId: context.profileId,
              selector,
            });
            return qrCode;
          }
        } catch (waitError) {
          logger.debug('QR code canvas not found with selector', {
            selector,
            error: waitError instanceof Error ? waitError.message : 'Unknown error',
            profileId: context.profileId,
          });
          continue;
        }
      }

      logger.warn('QR code not found on WhatsApp page after all attempts', {
        profileId: context.profileId,
      });
      return undefined;
    } catch (error) {
      logger.error('Error getting WhatsApp QR code', {
        error: error instanceof Error ? error.message : 'Unknown error',
        profileId: context.profileId,
      });
      return undefined;
    }
  }
}

