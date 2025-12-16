/**
 * WhatsApp Sender
 *
 * Реализация отправителя WhatsApp через Puppeteer и WhatsApp Web.
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

export class WhatsAppSender {
  private chromeProcessService?: ChromeProcessService;

  constructor(chromeProcessService?: ChromeProcessService) {
    this.chromeProcessService = chromeProcessService;
  }

  /**
   * Вспомогательная функция для задержки (замена page.waitForTimeout)
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
        throw new Error('Profile ID is required for WhatsApp sending');
      }

      if (!this.chromeProcessService) {
        throw new Error('ChromeProcessService is not available');
      }

      // Получаем или создаем страницу WhatsApp Web
      const page = await this.chromeProcessService.getOrCreateMessengerPage(
        input.profileId,
        'whatsapp',
        'https://web.whatsapp.com'
      );

      if (!page) {
        throw new Error('Failed to get WhatsApp page for profile');
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

      logger.info('WhatsApp message sent successfully', { phone: input.phone, profileId: input.profileId });
      return { success: true, messenger: 'WHATSAPP' };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Unknown WhatsApp error';
      logger.error('WhatsApp send failed', { phone: input.phone, profileId: input.profileId, error: msg });
      return { success: false, messenger: 'WHATSAPP', error: msg };
    }
  }

  /**
   * Открытие чата по номеру
   */
  private async openChat(page: Page, phone: string): Promise<void> {
    try {
      // Нормализуем номер телефона (убираем все кроме цифр)
      const normalizedPhone = phone.replace(/[^\d]/g, '');

      // URL для открытия чата в WhatsApp Web
      const chatUrl = `https://web.whatsapp.com/send?phone=${normalizedPhone}`;

      // Переходим на страницу чата
      await page.goto(chatUrl, { waitUntil: 'networkidle2', timeout: 30000 });

      // Ждем, пока загрузится интерфейс чата
      // Селектор для поля ввода сообщения
      const messageInputSelector = 'div[contenteditable="true"][data-tab="10"]';
      await page.waitForSelector(messageInputSelector, { timeout: 15000 });

      // Небольшая задержка для стабилизации интерфейса
      await this.delay(1000);

      logger.debug('WhatsApp chat opened', { phone: normalizedPhone });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to open WhatsApp chat', { phone, error: errorMsg });
      throw new Error(`Failed to open chat: ${errorMsg}`);
    }
  }

  /**
   * Отправка текстового сообщения
   */
  private async sendTextMessage(page: Page, text: string): Promise<void> {
    try {
      // Селектор для поля ввода сообщения
      const messageInputSelector = 'div[contenteditable="true"][data-tab="10"]';

      // Ждем появления поля ввода
      await page.waitForSelector(messageInputSelector, { timeout: 10000 });

      // Очищаем поле ввода (если там что-то есть)
      await page.click(messageInputSelector, { clickCount: 3 });
      await page.keyboard.press('Backspace');

      // Вводим текст
      await page.type(messageInputSelector, text, { delay: 50 });

      // Небольшая задержка перед отправкой
      await this.delay(500);

      // Отправляем сообщение (Enter)
      await page.keyboard.press('Enter');

      logger.debug('WhatsApp text message sent', { textLength: text.length });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to send WhatsApp text message', { error: errorMsg });
      throw new Error(`Failed to send text message: ${errorMsg}`);
    }
  }

  /**
   * Проверка, что сообщение действительно отправлено
   */
  private async verifyMessageSent(page: Page, text: string): Promise<boolean> {
    try {
      // Ждем появления сообщения в чате (селектор для отправленных сообщений)
      // WhatsApp показывает отправленные сообщения с атрибутом data-id или в определенной структуре
      const maxWaitTime = 5000; // 5 секунд максимум
      const checkInterval = 200; // проверяем каждые 200мс
      const maxChecks = maxWaitTime / checkInterval;

      for (let i = 0; i < maxChecks; i++) {
        // Ищем последнее отправленное сообщение в чате
        // Селектор для отправленных сообщений: span[data-icon="msg-dblcheck"] или span[data-icon="msg-check"]
        const sentIndicator = await page.$('span[data-icon="msg-dblcheck"], span[data-icon="msg-check"]');
        
        if (sentIndicator) {
          // Проверяем, что текст сообщения присутствует в последних сообщениях
          const messageText = await page.evaluate(() => {
            // Ищем последнее сообщение в чате
            // Код выполняется в браузерном контексте через Puppeteer, поэтому document доступен
            // @ts-expect-error - document доступен в браузерном контексте Puppeteer
            const messages = document.querySelectorAll('div[data-testid="msg-container"]');
            if (messages.length === 0) return null;
            const lastMessage = messages[messages.length - 1];
            return lastMessage.textContent || null;
          });

          if (messageText && messageText.includes(text.substring(0, 50))) {
            logger.debug('Message verified as sent', { textLength: text.length });
            return true;
          }
        }

        await this.delay(checkInterval);
      }

      // Альтернативная проверка: ищем сообщение по тексту в DOM
      const messageExists = await page.evaluate((searchText) => {
        // Код выполняется в браузерном контексте через Puppeteer, поэтому document доступен
        // @ts-expect-error - document доступен в браузерном контексте Puppeteer
        const allText = document.body.innerText || '';
        return allText.includes(searchText.substring(0, 50));
      }, text);

      if (messageExists) {
        logger.debug('Message found in chat (alternative verification)', { textLength: text.length });
        return true;
      }

      logger.warn('Message verification failed - message not found in chat', { textLength: text.length });
      return false;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to verify message sent', { error: errorMsg });
      // В случае ошибки проверки, считаем что сообщение могло быть отправлено
      // но логируем предупреждение
      return false;
    }
  }

  /**
   * Отправка файла/вложений
   */
  private async sendFileMessage(page: Page, attachmentPath: string): Promise<void> {
    try {
      // Селектор для кнопки прикрепления файла
      const attachButtonSelector = 'span[data-icon="attach"]';
      
      // Ждем появления кнопки прикрепления
      await page.waitForSelector(attachButtonSelector, { timeout: 10000 });
      
      // Используем современный API Puppeteer для загрузки файлов
      const [fileChooser] = await Promise.all([
        page.waitForFileChooser({ timeout: 10000 }),
        page.click(attachButtonSelector),
      ]);
      
      await fileChooser.accept([attachmentPath]);
      await this.delay(1000);

      // Селектор для кнопки отправки файла
      const sendButtonSelector = 'span[data-icon="send"]';
      
      // Ждем появления кнопки отправки
      await page.waitForSelector(sendButtonSelector, { timeout: 10000 });
      
      // Отправляем файл
      await page.click(sendButtonSelector);
      await this.delay(2000);

      logger.debug('WhatsApp file message sent', { attachmentPath });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to send WhatsApp file message', { attachmentPath, error: errorMsg });
      throw new Error(`Failed to send file message: ${errorMsg}`);
    }
  }

  /**
   * Проверка, зарегистрирован ли номер в WhatsApp
   */
  async checkNumberRegistered(profileId: string, phone: string): Promise<boolean> {
    try {
      if (!this.chromeProcessService) {
        return false;
      }

      const page = await this.chromeProcessService.getOrCreateMessengerPage(
        profileId,
        'whatsapp',
        'https://web.whatsapp.com'
      );

      if (!page) {
        return false;
      }

      // Открываем чат
      await this.openChat(page, phone);

      // Проверяем наличие предупреждения о неверном номере
      // Если номер не зарегистрирован, WhatsApp покажет предупреждение
      const invalidNumberSelector = 'div[role="alert"]';
      const alertExists = await page.$(invalidNumberSelector).then(el => el !== null).catch(() => false);

      return !alertExists;
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
    return 'Unknown WhatsApp error';
  }
}

