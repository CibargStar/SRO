/**
 * Telegram Sender
 *
 * Реализация отправителя Telegram через Puppeteer и Telegram Web.
 * Использует Telegram Web K (web.telegram.org/k) для отправки сообщений.
 */

import { MessengerType } from '@prisma/client';
import { Page } from 'puppeteer';
import logger from '../../../config/logger';
import { validatePhone } from './utils';
import type { ChromeProcessService } from '../../profiles/chrome-process/chrome-process.service';

export interface SenderInput {
  phone: string;
  text?: string;
  attachments?: string[];
  profileId?: string; // ID профиля для доступа к Puppeteer
}

export interface SenderResult {
  success: boolean;
  messenger: MessengerType;
  error?: string;
}

/**
 * Селекторы для Telegram Web K
 */
const TELEGRAM_SELECTORS = {
  // Поле поиска контакта
  SEARCH_INPUT: '.input-field-input[placeholder*="Search"], .input-field-input[placeholder*="Поиск"]',
  // Список результатов поиска
  SEARCH_RESULTS: '.chatlist-chat',
  // Поле ввода сообщения
  MESSAGE_INPUT: '.input-message-input, .composer-input, textarea[placeholder*="Message"]',
  // Кнопка отправки сообщения
  SEND_BUTTON: '.btn-send, .send-button, button[aria-label*="Send"]',
  // Контейнер сообщений
  MESSAGES_CONTAINER: '.messages-container, .bubbles',
  // Кнопка прикрепления файла
  ATTACH_BUTTON: '.btn-attach, .attach-button, button[aria-label*="Attach"]',
  // Индикатор загрузки
  LOADING_INDICATOR: '.preloader-container, .loading-screen',
} as const;

export class TelegramSender {
  private chromeProcessService?: ChromeProcessService;

  constructor(chromeProcessService?: ChromeProcessService) {
    this.chromeProcessService = chromeProcessService;
  }

  /**
   * Вспомогательная функция для задержки
   */
  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Основной метод отправки (обертка для Executor)
   */
  async sendMessage(input: SenderInput): Promise<SenderResult> {
    try {
      validatePhone(input.phone);

      if (!input.profileId) {
        throw new Error('Profile ID is required for Telegram sending');
      }

      if (!this.chromeProcessService) {
        throw new Error('ChromeProcessService is not available');
      }

      // Получаем или создаем страницу Telegram Web
      const page = await this.chromeProcessService.getOrCreateMessengerPage(
        input.profileId,
        'telegram',
        'https://web.telegram.org/k'
      );

      if (!page) {
        throw new Error('Failed to get Telegram page for profile');
      }

      // Открываем чат с номером
      await this.openChat(page, input.phone);

      // Отправляем сообщение
      if (input.text) {
        await this.sendTextMessage(page, input.text);
        // Проверяем, что сообщение действительно отправлено
        const isSent = await this.verifyMessageSent(page, input.text);
        if (!isSent) {
          throw new Error('Message was not sent - verification failed');
        }
      }

      // Отправляем вложения, если есть
      if (input.attachments && input.attachments.length > 0) {
        for (const attachment of input.attachments) {
          await this.sendFileMessage(page, attachment);
          // Небольшая задержка между файлами
          await this.delay(1000);
        }
      }

      logger.info('Telegram message sent successfully', { phone: input.phone, profileId: input.profileId });
      return { success: true, messenger: 'TELEGRAM' };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Unknown Telegram error';
      logger.error('Telegram send failed', { phone: input.phone, profileId: input.profileId, error: msg });
      return { success: false, messenger: 'TELEGRAM', error: msg };
    }
  }

  /**
   * Открытие чата по номеру
   */
  private async openChat(page: Page, phone: string): Promise<void> {
    try {
      // Нормализуем номер телефона (убираем все кроме цифр)
      const normalizedPhone = phone.replace(/[^\d]/g, '');

      // Ждем загрузки страницы
      await page.waitForSelector(TELEGRAM_SELECTORS.SEARCH_INPUT, { timeout: 30000 }).catch(() => {
        // Если поиск не найден, возможно страница еще загружается
        logger.debug('Search input not found immediately, waiting...');
      });

      // Небольшая задержка для стабилизации
      await this.delay(2000);

      // Ищем поле поиска
      const searchInput = await page.$(TELEGRAM_SELECTORS.SEARCH_INPUT);
      if (!searchInput) {
        throw new Error('Search input not found on Telegram page');
      }

      // Кликаем на поле поиска
      await searchInput.click({ clickCount: 3 });
      await this.delay(500);

      // Вводим номер телефона
      await page.type(TELEGRAM_SELECTORS.SEARCH_INPUT, normalizedPhone, { delay: 100 });
      await this.delay(2000); // Ждем результатов поиска

      // Ищем контакт в результатах поиска
      const searchResults = await page.$$(TELEGRAM_SELECTORS.SEARCH_RESULTS);
      if (searchResults.length === 0) {
        throw new Error(`Contact with phone ${normalizedPhone} not found in Telegram`);
      }

      // Кликаем на первый результат (обычно это нужный контакт)
      await searchResults[0].click();
      await this.delay(2000); // Ждем открытия чата

      // Ждем появления поля ввода сообщения
      await page.waitForSelector(TELEGRAM_SELECTORS.MESSAGE_INPUT, { timeout: 10000 });

      logger.debug('Telegram chat opened', { phone: normalizedPhone });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to open Telegram chat', { phone, error: errorMsg });
      throw new Error(`Failed to open chat: ${errorMsg}`);
    }
  }

  /**
   * Отправка текстового сообщения
   */
  private async sendTextMessage(page: Page, text: string): Promise<void> {
    try {
      // Ждем появления поля ввода сообщения
      await page.waitForSelector(TELEGRAM_SELECTORS.MESSAGE_INPUT, { timeout: 10000 });

      // Очищаем поле ввода (если там что-то есть)
      await page.click(TELEGRAM_SELECTORS.MESSAGE_INPUT, { clickCount: 3 });
      await page.keyboard.press('Backspace');

      // Вводим текст
      await page.type(TELEGRAM_SELECTORS.MESSAGE_INPUT, text, { delay: 50 });

      // Небольшая задержка перед отправкой
      await this.delay(500);

      // Отправляем сообщение (Enter)
      await page.keyboard.press('Enter');

      logger.debug('Telegram text message sent', { textLength: text.length });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to send Telegram text message', { error: errorMsg });
      throw new Error(`Failed to send text message: ${errorMsg}`);
    }
  }

  /**
   * Проверка, что сообщение действительно отправлено
   */
  private async verifyMessageSent(page: Page, text: string): Promise<boolean> {
    try {
      // Ждем появления сообщения в чате
      const maxWaitTime = 5000; // 5 секунд максимум
      const checkInterval = 200; // проверяем каждые 200мс
      const maxChecks = maxWaitTime / checkInterval;

      for (let i = 0; i < maxChecks; i++) {
        // Ищем сообщение по тексту в DOM
        const messageExists = await page.evaluate((searchText) => {
          // Код выполняется в браузерном контексте через Puppeteer, поэтому document доступен
          // @ts-expect-error - document доступен в браузерном контексте Puppeteer
          const allText = document.body.innerText || '';
          return allText.includes(searchText.substring(0, 50));
        }, text);

        if (messageExists) {
          logger.debug('Message verified as sent', { textLength: text.length });
          return true;
        }

        await this.delay(checkInterval);
      }

      logger.warn('Message verification failed - message not found in chat', { textLength: text.length });
      return false;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to verify message sent', { error: errorMsg });
      // В случае ошибки проверки, считаем что сообщение могло быть отправлено
      return false;
    }
  }

  /**
   * Отправка файла/вложений
   */
  private async sendFileMessage(page: Page, attachmentPath: string): Promise<void> {
    try {
      // Ищем кнопку прикрепления файла
      const attachButton = await page.$(TELEGRAM_SELECTORS.ATTACH_BUTTON);
      if (!attachButton) {
        throw new Error('Attach button not found');
      }

      // Используем современный API Puppeteer для загрузки файлов
      const [fileChooser] = await Promise.all([
        page.waitForFileChooser({ timeout: 10000 }),
        attachButton.click(),
      ]);

      await fileChooser.accept([attachmentPath]);
      await this.delay(1000);

      // Отправляем файл (Enter или кнопка отправки)
      await page.keyboard.press('Enter');
      await this.delay(2000);

      logger.debug('Telegram file message sent', { attachmentPath });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to send Telegram file message', { attachmentPath, error: errorMsg });
      throw new Error(`Failed to send file message: ${errorMsg}`);
    }
  }

  /**
   * Проверка, зарегистрирован ли номер в Telegram
   */
  async checkNumberRegistered(profileId: string, phone: string): Promise<boolean> {
    try {
      if (!this.chromeProcessService) {
        return false;
      }

      const page = await this.chromeProcessService.getOrCreateMessengerPage(
        profileId,
        'telegram',
        'https://web.telegram.org/k'
      );

      if (!page) {
        return false;
      }

      // Открываем чат
      try {
        await this.openChat(page, phone);
        // Если чат открылся, значит номер зарегистрирован
        return true;
      } catch (error) {
        // Если не удалось открыть чат, возможно номер не зарегистрирован
        logger.debug('Could not open Telegram chat - number may not be registered', { phone });
        return false;
      }
    } catch (error) {
      logger.error('Failed to check if number is registered', { phone, error });
      return false;
    }
  }

  /**
   * Обработка ошибок и нормализация сообщений
   */
  handleErrors(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    return 'Unknown Telegram error';
  }
}

