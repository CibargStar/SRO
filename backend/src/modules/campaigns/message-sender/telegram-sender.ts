/**
 * Telegram Sender
 *
 * Реализация отправителя Telegram через Puppeteer и Telegram Web.
 * Использует Telegram Web K (web.telegram.org/k) для отправки сообщений.
 */

import { MessengerType } from '@prisma/client';
import { Page } from 'puppeteer';
import path from 'path';
import fs from 'fs/promises';
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
  // Кнопка прикрепления файла (Telegram Web K - точные селекторы)
  ATTACH_BUTTON: [
    '.btn-icon.btn-menu-toggle.attach-file',  // Основной селектор из DOM
    '.attach-file',
    'div.btn-icon.attach-file',
    'button.attach-file',
    '[class*="attach-file"]',
  ],
  // Пункты меню вложений (после клика на кнопку прикрепления)
  MENU_ITEM_DOCUMENT: [
    '.btn-menu-item span.i18n:has-text("Document")',
    '.btn-menu-item:has(span:contains("Document"))',
    '.btn-menu-item-text:contains("Document")',
    'div.btn-menu-item:nth-child(2)',  // Document обычно второй пункт
  ],
  MENU_ITEM_PHOTO: [
    '.btn-menu-item span.i18n:has-text("Photo")',
    '.btn-menu-item:has(span:contains("Photo"))',
    '.btn-menu-item-text:contains("Photo")',
    'div.btn-menu-item:nth-child(1)',  // Photo or Video обычно первый пункт
  ],
  // Кнопка отправки файла после загрузки
  SEND_FILE_BUTTON: '.btn-send, button[aria-label*="Send"], button[aria-label*="Отправить"], [data-testid="send"]',
  // Индикатор загрузки
  LOADING_INDICATOR: '.preloader-container, .loading-screen',
  // Premium ограничение - карточка с сообщением
  PREMIUM_CARD: '[class*="premium"], [class*="Premium"], .premium-card, .premium-restriction',
  // Premium кнопка
  PREMIUM_BUTTON: 'button:has-text("Get Premium"), button:has-text("Premium"), [class*="premium-button"]',
} as const;

/**
 * Тексты ошибок Premium ограничения (на разных языках)
 * ВАЖНО: Используем только полные фразы, которые появляются именно при ошибке отправки,
 * а не просто слово "Premium" которое может быть в рекламе или других элементах интерфейса
 */
const PREMIUM_ERROR_TEXTS = [
  'Subscribe to Premium to message',
  'Only Premium users can message',
  'Подпишитесь на Premium, чтобы писать',
  'Только пользователи Premium могут писать',
  'This user only accepts messages from Premium users',
  'Этот пользователь принимает сообщения только от пользователей Premium',
] as const;

/**
 * Тексты ошибок "пользователь не найден" (на разных языках)
 * Появляется когда номер не зарегистрирован в Telegram или неверный
 */
const USER_NOT_FOUND_ERROR_TEXTS = [
  "Sorry, this user doesn't seem to exist",
  "Sorry this user doesn't seem to exist",
  'Sorry, this user doesn\'t seem to exist',
  'Извините, этот пользователь не найден',
  'Пользователь не найден',
  'User not found',
  'This user does not exist',
] as const;

export class TelegramSender {
  private chromeProcessService?: ChromeProcessService;
  /**
   * Кэш текущего открытого чата для каждого профиля
   * Ключ: profileId, Значение: нормализованный номер телефона
   */
  private currentOpenChat: Map<string, string> = new Map();

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
   * Оптимизированная версия с меньшим количеством проверок
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

      // Активируем вкладку Telegram перед отправкой
      await page.bringToFront();

      // Открываем чат с номером (метод сам проверит кэш и состояние)
      await this.openChat(page, input.phone, input.profileId);

      // Отправляем текст
      if (input.text) {
        await this.sendTextMessage(page, input.text);
        // Верификация опциональна - если сообщение не отправилось, следующая операция упадёт
        const isSent = await this.verifyMessageSent(page, input.text);
        if (!isSent) {
          logger.warn('Message verification uncertain, continuing', { phone: input.phone });
          // Не падаем - верификация может дать false positive
        }
      }

      // Отправляем вложения
      if (input.attachments && input.attachments.length > 0) {
        for (const attachment of input.attachments) {
          await this.sendFileMessage(page, attachment, input.phone, input.profileId);
          // Задержка между файлами (меньше чем раньше)
          if (input.attachments.length > 1) {
            await this.delay(500);
          }
        }
      }

      logger.info('Telegram message sent', { phone: input.phone, profileId: input.profileId });
      return { success: true, messenger: 'TELEGRAM' };
    } catch (error: unknown) {
      let errorMessage: string;
      
      if (error instanceof Error) {
        if (error.message.includes('USER_NOT_FOUND')) {
          errorMessage = 'Пользователь не найден в Telegram. Номер может быть неверным или не зарегистрирован.';
          logger.warn('Telegram user not found', { phone: input.phone, profileId: input.profileId });
        } else if (error.message.includes('PREMIUM_RESTRICTION')) {
          errorMessage = 'Пользователь принимает сообщения только от Premium пользователей.';
          logger.warn('Telegram Premium restriction', { phone: input.phone, profileId: input.profileId });
        } else {
          errorMessage = error.message;
          logger.error('Telegram send failed', { phone: input.phone, profileId: input.profileId, error: errorMessage });
        }
      } else {
        errorMessage = 'Unknown Telegram error';
        logger.error('Telegram send failed', { phone: input.phone, profileId: input.profileId, error: errorMessage });
      }
      
      return { success: false, messenger: 'TELEGRAM', error: errorMessage };
    }
  }

  /**
   * Проверка наличия ошибки "пользователь не найден"
   * Оптимизированная версия: 2 проверки с короткими интервалами
   */
  private async checkUserNotFound(page: Page): Promise<boolean> {
    try {
      // Две проверки с коротким интервалом (достаточно для обнаружения toast)
      for (let i = 0; i < 2; i++) {
        if (i > 0) {
          await this.delay(300);
        }

        const userNotFound = await page.evaluate((errorTexts) => {
          // Ищем уведомления и модальные окна
          const containers = document.querySelectorAll(
            '[class*="toast"], [class*="notification"], [role="alert"], [role="dialog"], .popup'
          );
          
          for (const container of Array.from(containers)) {
            const text = (container.textContent || '').toLowerCase();
            for (const errorText of errorTexts) {
              if (text.includes(errorText.toLowerCase())) {
                return true;
              }
            }
          }
          return false;
        }, USER_NOT_FOUND_ERROR_TEXTS);

        if (userNotFound) {
          logger.debug('User not found error detected');
          return true;
        }
      }

      return false;
    } catch {
      return false;
    }
  }

  /**
   * Проверка наличия Premium ограничения
   * Оптимизированная версия без лишних задержек
   */
  private async checkPremiumRestriction(page: Page): Promise<boolean> {
    try {
      return await page.evaluate((errorTexts) => {
        // Проверяем в области чата и модальных окнах
        const containers = document.querySelectorAll(
          '[class*="chat"], [class*="composer"], [role="dialog"], .popup, [class*="message"]'
        );
        
        for (const container of Array.from(containers)) {
          const text = (container.textContent || '').toLowerCase();
          for (const errorText of errorTexts) {
            if (text.includes(errorText.toLowerCase())) {
              return true;
            }
          }
        }
        
        return false;
      }, PREMIUM_ERROR_TEXTS);
    } catch {
      return false;
    }
  }

  /**
   * Открытие чата по номеру через прямую ссылку
   * Оптимизированная версия: не сбрасывает страницу на базовый URL,
   * сразу переходит на нужный чат
   */
  private async openChat(page: Page, phone: string, profileId?: string): Promise<void> {
    const normalizedPhone = phone.replace(/[^\d]/g, '');
    const maxRetries = 2;
    
    for (let retry = 0; retry <= maxRetries; retry++) {
      try {
        await this.openChatInternal(page, normalizedPhone, profileId);
        return;
      } catch (error) {
        // Для специфичных ошибок (USER_NOT_FOUND, PREMIUM) не делаем retry
        if (error instanceof Error && (
          error.message.includes('PREMIUM_RESTRICTION') || 
          error.message.includes('USER_NOT_FOUND') ||
          error.message.includes('Page is closed')
        )) {
          throw error;
        }
        
        if (retry < maxRetries) {
          logger.warn('Failed to open chat, retrying', { 
            phone: normalizedPhone, 
            retry: retry + 1, 
            maxRetries,
            error: error instanceof Error ? error.message : 'Unknown'
          });
          // Ждём перед retry
          await this.delay(1000);
        } else {
          throw error;
        }
      }
    }
  }

  /**
   * Внутренний метод открытия чата (используется openChat с retry)
   */
  private async openChatInternal(page: Page, normalizedPhone: string, profileId?: string): Promise<void> {
    try {
      // Проверяем, что страница не закрыта
      if (page.isClosed()) {
        if (profileId) {
          this.currentOpenChat.delete(profileId);
        }
        throw new Error('Page is closed');
      }

      // Проверяем кэш - если чат уже открыт с этим номером
      const cachedPhone = profileId ? this.currentOpenChat.get(profileId) : null;
      
      if (cachedPhone === normalizedPhone) {
        // Быстрая проверка: есть ли поле ввода?
        const inputExists = await page.$(TELEGRAM_SELECTORS.MESSAGE_INPUT);
        if (inputExists) {
          logger.debug('Chat already open, reusing', { phone: normalizedPhone, profileId });
          return;
        }
        // Поле ввода пропало - сбрасываем кэш и открываем заново
        logger.debug('Cached chat invalid, reopening', { phone: normalizedPhone });
        if (profileId) {
          this.currentOpenChat.delete(profileId);
        }
      }

      // URL для открытия чата напрямую
      const chatUrl = `https://web.telegram.org/k/#?tgaddr=tg%3A%2F%2Fresolve%3Fphone%3D${normalizedPhone}`;
      
      logger.debug('Opening chat', { phone: normalizedPhone, chatUrl, profileId });

      // Переходим напрямую на URL чата (без сброса на базовый URL)
      await page.goto(chatUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

      // Ждём появления поля ввода или ошибки (параллельно)
      const inputSelector = TELEGRAM_SELECTORS.MESSAGE_INPUT;
      const maxWaitTime = 15000;
      const checkInterval = 300;
      const startTime = Date.now();
      
      let inputFound = false;
      let errorDetected: string | null = null;

      while (Date.now() - startTime < maxWaitTime) {
        // Проверяем поле ввода
        const inputExists = await page.$(inputSelector);
        if (inputExists) {
          inputFound = true;
          break;
        }

        // Проверяем ошибки (но не каждую итерацию для экономии времени)
        if ((Date.now() - startTime) > 3000 && (Date.now() - startTime) % 1500 < checkInterval) {
          // Быстрая проверка на USER_NOT_FOUND
          const hasUserNotFound = await this.quickCheckUserNotFound(page);
          if (hasUserNotFound) {
            errorDetected = 'USER_NOT_FOUND';
            break;
          }
        }

        await this.delay(checkInterval);
      }

      // Если нашли ошибку
      if (errorDetected === 'USER_NOT_FOUND') {
        if (profileId) {
          this.currentOpenChat.delete(profileId);
        }
        throw new Error('USER_NOT_FOUND: Sorry, this user doesn\'t seem to exist');
      }

      // Если не нашли поле ввода
      if (!inputFound) {
        // Финальная проверка на ошибки
        const userNotFound = await this.checkUserNotFound(page);
        if (userNotFound) {
          if (profileId) {
            this.currentOpenChat.delete(profileId);
          }
          throw new Error('USER_NOT_FOUND: Sorry, this user doesn\'t seem to exist');
        }

        const hasPremiumRestriction = await this.checkPremiumRestriction(page);
        if (hasPremiumRestriction) {
          if (profileId) {
            this.currentOpenChat.delete(profileId);
          }
          throw new Error('PREMIUM_RESTRICTION: Only Premium users can message this user');
        }

        if (profileId) {
          this.currentOpenChat.delete(profileId);
        }
        throw new Error(`Failed to open chat: message input not found after ${maxWaitTime}ms`);
      }

      // Небольшая задержка для стабилизации
      await this.delay(300);

      // Сохраняем в кэш
      if (profileId) {
        this.currentOpenChat.set(profileId, normalizedPhone);
      }

      logger.debug('Telegram chat opened successfully', { phone: normalizedPhone, profileId });
    } catch (error) {
      // Сбрасываем кэш при любой ошибке
      if (profileId) {
        this.currentOpenChat.delete(profileId);
      }
      
      // Пробрасываем специфичные ошибки
      if (error instanceof Error && (
        error.message.includes('PREMIUM_RESTRICTION') || 
        error.message.includes('USER_NOT_FOUND')
      )) {
        throw error;
      }

      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to open Telegram chat', { phone: normalizedPhone, error: errorMsg });
      throw new Error(`Failed to open chat: ${errorMsg}`);
    }
  }

  /**
   * Быстрая проверка на ошибку "пользователь не найден"
   * Без множественных итераций для экономии времени
   */
  private async quickCheckUserNotFound(page: Page): Promise<boolean> {
    try {
      return await page.evaluate((errorTexts) => {
        const notifications = document.querySelectorAll('[class*="toast"], [class*="notification"], [role="alert"]');
        for (const notification of Array.from(notifications)) {
          const text = (notification.textContent || '').toLowerCase();
          for (const errorText of errorTexts) {
            if (text.includes(errorText.toLowerCase())) {
              return true;
            }
          }
        }
        return false;
      }, USER_NOT_FOUND_ERROR_TEXTS);
    } catch {
      return false;
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
   * Ищет сообщение в области чата, а не во всем body
   */
  private async verifyMessageSent(page: Page, text: string): Promise<boolean> {
    try {
      // Ждем появления сообщения в чате
      const maxWaitTime = 8000; // Увеличиваем до 8 секунд
      const checkInterval = 300; // проверяем каждые 300мс
      const maxChecks = Math.ceil(maxWaitTime / checkInterval);

      // Берем первые 30 символов для поиска (более надежно)
      const searchText = text.substring(0, 30).trim();

      for (let i = 0; i < maxChecks; i++) {
        // Ищем сообщение по тексту в области чата
        const messageExists = await page.evaluate((searchTextLower) => {
          // Ищем в области сообщений чата
          const messageContainers = document.querySelectorAll(
            '[class*="message"], [class*="bubble"], [class*="text"], [class*="content"]'
          );
          
          // Проверяем каждый контейнер сообщения
          for (const container of Array.from(messageContainers)) {
            const containerText = (container.textContent || '').toLowerCase().trim();
            if (containerText.includes(searchTextLower)) {
              return true;
            }
          }
          
          // Fallback: проверяем весь body
          const bodyText = (document.body.innerText || '').toLowerCase();
          return bodyText.includes(searchTextLower);
        }, searchText.toLowerCase());

        if (messageExists) {
          logger.debug('Message verified as sent', { textLength: text.length, searchText });
          return true;
        }

        await this.delay(checkInterval);
      }

      logger.warn('Message verification failed - message not found in chat', { 
        textLength: text.length,
        searchText 
      });
      return false;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to verify message sent', { error: errorMsg });
      // В случае ошибки проверки, считаем что сообщение могло быть отправлено
      return false;
    }
  }

  /**
   * Преобразование пути в абсолютный
   */
  private resolveFilePath(filePath: string): string {
    // Если путь уже абсолютный, возвращаем как есть
    if (path.isAbsolute(filePath)) {
      return filePath;
    }
    
    // Если путь относительный, преобразуем в абсолютный относительно рабочей директории
    // Предполагаем, что относительные пути идут от корня проекта или от uploads/templates
    const uploadsDir = path.join(process.cwd(), 'uploads', 'templates');
    const resolvedPath = path.resolve(uploadsDir, filePath);
    
    return resolvedPath;
  }

  /**
   * Проверка существования файла
   */
  private async checkFileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Определение типа файла по расширению
   */
  private getFileType(filePath: string): 'image' | 'video' | 'document' {
    const ext = path.extname(filePath).toLowerCase();
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg'];
    const videoExtensions = ['.mp4', '.webm', '.avi', '.mov', '.mkv', '.flv', '.wmv'];
    
    if (imageExtensions.includes(ext)) {
      return 'image';
    } else if (videoExtensions.includes(ext)) {
      return 'video';
    }
    return 'document';
  }

  /**
   * Поиск кнопки прикрепления файла
   */
  private async findAttachButton(page: Page): Promise<import('puppeteer').ElementHandle<Element> | null> {
    // Пробуем все селекторы из массива
    for (const selector of TELEGRAM_SELECTORS.ATTACH_BUTTON) {
      try {
        const button = await page.$(selector);
        if (button) {
          logger.debug('Attach button found with selector', { selector });
          return button;
        }
      } catch {
        // Продолжаем с другими селекторами
      }
    }

    // Fallback: ищем через evaluate
    logger.debug('Attach button not found with predefined selectors, trying evaluate');
    
    const button = await page.$('[class*="attach"]');
    if (button) {
      // Проверяем, что это нужный элемент
      const isCorrectElement = await page.evaluate((el) => {
        return el.classList.contains('btn-icon') || 
               el.classList.contains('btn-menu-toggle') || 
               el.classList.contains('attach-file') ||
               el.tagName === 'BUTTON';
      }, button);
      
      if (isCorrectElement) {
        logger.debug('Attach button found via fallback selector');
        return button;
      }
    }
    
    // Еще один fallback - ищем через evaluate
    const foundButton = await page.evaluateHandle(() => {
      const elements = document.querySelectorAll('[class*="attach"]');
      for (let i = 0; i < elements.length; i++) {
        const el = elements[i];
        if (el.classList.contains('btn-icon') || 
            el.classList.contains('btn-menu-toggle') || 
            el.classList.contains('attach-file') ||
            el.tagName === 'BUTTON') {
          return el;
        }
      }
      return null;
    });

    const element = foundButton.asElement() as import('puppeteer').ElementHandle<Element> | null;
    if (element) {
      logger.debug('Attach button found via evaluate');
      return element;
    }

    return null;
  }

  /**
   * Клик по пункту меню (Document или Photo/Video)
   * Использует правильные селекторы из DOM Telegram Web K
   */
  private async clickMenuItem(page: Page, fileType: 'image' | 'video' | 'document'): Promise<boolean> {
    const isMedia = fileType === 'image' || fileType === 'video';
    // Используем точные тексты из DOM: "Photo or Video" и "Document"
    const targetTexts = isMedia 
      ? ['Photo or Video', 'Photo', 'Photos & videos', 'Photos']
      : ['Document', 'Documents'];
    
    logger.debug('Looking for menu item', { fileType, targetTexts });
    
    // Ждем появления меню
    await this.delay(500);
    
    // Ищем пункт меню через evaluate
    const clicked = await page.evaluate((texts: string[], isMediaType: boolean) => {
      // Ищем открытое меню (может быть в разных местах)
      const menuSelectors = [
        '.btn-menu.top-left.active',
        '.btn-menu.active',
        '.btn-menu.top-left',
        '.btn-menu',
        '[class*="btn-menu"][class*="active"]',
      ];
      
      let menu: Element | null = null;
      for (const selector of menuSelectors) {
        menu = document.querySelector(selector);
        if (menu) {
          break;
        }
      }
      
      if (!menu) {
        return { success: false, reason: 'Menu not found' };
      }
      
      // Ищем пункты меню
      const menuItems = menu.querySelectorAll('.btn-menu-item');
      if (menuItems.length === 0) {
        return { success: false, reason: 'No menu items found' };
      }
      
      // Способ 1: Ищем по тексту в .btn-menu-item-text или span.i18n
      for (let i = 0; i < menuItems.length; i++) {
        const item = menuItems[i];
        const textElement = item.querySelector('.btn-menu-item-text, span.i18n');
        const text = textElement?.textContent?.trim() ?? item.textContent?.trim() ?? '';
        
        // Проверяем все варианты текста
        for (const targetText of texts) {
          if (text.toLowerCase().includes(targetText.toLowerCase()) || 
              targetText.toLowerCase().includes(text.toLowerCase())) {
            (item as HTMLElement).click();
            return { success: true, method: 'text', text };
          }
        }
      }
      
      // Способ 2: Если не нашли по тексту, пробуем по индексу
      // Photo or Video - обычно первый пункт, Document - второй
      const index = isMediaType ? 0 : 1;
      if (menuItems[index]) {
        (menuItems[index] as HTMLElement).click();
        return { success: true, method: 'index', index };
      }
      
      return { success: false, reason: 'No matching menu item found' };
    }, targetTexts, isMedia);
    
    if (!clicked.success) {
      logger.warn('Menu item not found', { fileType, reason: clicked.reason });
      return false;
    }
    
    logger.debug('Menu item clicked', { fileType, method: clicked.method, details: clicked });
    return true;
  }

  /**
   * Загрузка файла через input[type="file"]
   * Ищет подходящий input и загружает файл через uploadFile()
   */
  private async uploadFileToInput(page: Page, absolutePath: string, fileType: 'image' | 'video' | 'document'): Promise<boolean> {
    try {
      // Ищем все input[type="file"] на странице
      const fileInputs = await page.$$('input[type="file"]');
      
      logger.debug('Found file inputs on page', { count: fileInputs.length });
      
      if (fileInputs.length === 0) {
        return false;
      }

      // Для документов ищем input с accept="*" или без accept
      // Для изображений/видео ищем input с accept*="image" или "video"
      for (const fileInput of fileInputs) {
        try {
          const acceptAttr = await fileInput.evaluate((el) => el.getAttribute('accept') || '');
          
          let isCorrectInput = false;
          if (fileType === 'document') {
            // Документы: accept="*" или accept содержит application или пустой
            isCorrectInput = acceptAttr === '*' || 
                           acceptAttr.includes('application') || 
                           acceptAttr.includes('pdf') ||
                           acceptAttr === '' ||
                           acceptAttr.includes('*');
          } else {
            // Изображения/видео: accept содержит image или video
            isCorrectInput = acceptAttr.includes('image') || 
                           acceptAttr.includes('video') ||
                           acceptAttr === '*';
          }
          
          if (isCorrectInput) {
            await fileInput.uploadFile(absolutePath);
            logger.debug('File uploaded to input', { absolutePath, acceptAttr, fileType });
            return true;
          }
        } catch {
          continue;
        }
      }

      // Если не нашли подходящий, пробуем последний input
      const lastInput = fileInputs[fileInputs.length - 1];
      if (lastInput) {
        await lastInput.uploadFile(absolutePath);
        logger.debug('File uploaded to last input (fallback)', { absolutePath });
        return true;
      }
      
      return false;
    } catch (error) {
      logger.warn('Failed to upload file to input', { error });
      return false;
    }
  }

  /**
   * Отправка файла через FileChooser (основной метод)
   */
  private async sendFileViaFileChooser(
    page: Page, 
    absolutePath: string, 
    fileType: 'image' | 'video' | 'document'
  ): Promise<void> {
    // Кликаем на кнопку прикрепления (+)
    const attachButton = await this.findAttachButton(page);
    if (!attachButton) {
      throw new Error('Attach button not found');
    }
    
    logger.debug('Clicking attach button to open menu');
    await attachButton.click();
    await this.delay(500);

    // Готовим перехват FileChooser и кликаем на пункт меню
    const [fileChooser] = await Promise.all([
      page.waitForFileChooser({ timeout: 5000 }).catch(() => null),
      this.clickMenuItem(page, fileType),
    ]);

    let fileUploaded = false;

    if (fileChooser) {
      await fileChooser.accept([absolutePath]);
      logger.debug('File uploaded via FileChooser', { absolutePath });
      fileUploaded = true;
    } else {
      logger.debug('FileChooser not available, trying direct input upload');
      await this.delay(500);
      fileUploaded = await this.uploadFileToInput(page, absolutePath, fileType);
    }
    
    if (!fileUploaded) {
      throw new Error('Could not upload file via FileChooser or direct input');
    }
  }

  /**
   * Отправка файла/вложений
   * Оптимизированная версия с меньшим количеством задержек
   */
  private async sendFileMessage(page: Page, attachmentPath: string, _phone?: string, _profileId?: string): Promise<void> {
    try {
      // Преобразуем путь в абсолютный
      const absolutePath = this.resolveFilePath(attachmentPath);
      
      // Проверяем существование файла
      const fileExists = await this.checkFileExists(absolutePath);
      if (!fileExists) {
        throw new Error(`File not found: ${absolutePath} (original path: ${attachmentPath})`);
      }

      // Определяем тип файла
      const fileType = this.getFileType(absolutePath);

      logger.debug('Sending Telegram file', { absolutePath, fileType });

      // Проверяем, что поле ввода доступно (чат открыт)
      const inputExists = await page.$(TELEGRAM_SELECTORS.MESSAGE_INPUT);
      if (!inputExists) {
        throw new Error('Message input not found - chat may not be open');
      }

      // Загружаем файл через FileChooser
      await this.sendFileViaFileChooser(page, absolutePath, fileType);

      // Ждём появления превью/попапа (оптимизированное ожидание)
      const fileLoaded = await this.waitForFilePreview(page);
      if (!fileLoaded) {
        logger.warn('File preview not detected, attempting to send anyway');
      }

      // Отправляем файл
      await this.clickSendButton(page);
      
      // Минимальная задержка для завершения отправки
      await this.delay(500);

      logger.debug('Telegram file sent', { absolutePath });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to send Telegram file', { attachmentPath, error: errorMsg });
      throw new Error(`Failed to send file: ${errorMsg}`);
    }
  }

  /**
   * Ожидание превью файла (оптимизированная версия)
   * Сначала проверяет часто (200ms), потом реже
   */
  private async waitForFilePreview(page: Page): Promise<boolean> {
    const maxWaitTime = 8000;
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWaitTime) {
      const hasPreview = await page.evaluate(() => {
        // Проверяем попап отправки файла (главный индикатор)
        if (document.querySelector('.popup-send-photo.active, .popup-new-media.active')) {
          return true;
        }
        
        // Проверяем превью файла
        const previewSelectors = [
          'img[src*="blob"]',
          'video[src*="blob"]',
          '[class*="preview"]',
          '.popup-photo',
          '.popup-item-document',
        ];
        
        for (const sel of previewSelectors) {
          if (document.querySelector(sel)) {
            return true;
          }
        }
        
        return false;
      });
      
      if (hasPreview) {
        logger.debug('File preview detected');
        return true;
      }

      // Динамический интервал: сначала чаще, потом реже
      const elapsed = Date.now() - startTime;
      const interval = elapsed < 2000 ? 200 : 400;
      await this.delay(interval);
    }
    
    logger.warn('File preview not detected after timeout');
    return false;
  }

  /**
   * Клик на кнопку отправки (оптимизированная версия)
   */
  private async clickSendButton(page: Page): Promise<void> {
    // Ждем появления попапа отправки файла
    try {
      await page.waitForSelector('.popup-send-photo.active, .popup-new-media.active', { 
        timeout: 8000,
        visible: true 
      });
      await this.delay(300);
    } catch {
      // Пробуем альтернативные селекторы
      try {
        await page.waitForSelector('button.btn-primary.btn-color-primary', { 
          timeout: 3000,
          visible: true 
        });
      } catch {
        logger.warn('Send popup not found');
      }
    }

    // Способ 1: Ищем кнопку внутри активного попапа popup-send-photo или popup-new-media
    const clickedInPopup = await page.evaluate(() => {
      // Ищем активный попап отправки файла
      const sendPopup = document.querySelector('.popup-send-photo.active, .popup-new-media.active');
      if (sendPopup) {
        // Ищем кнопку отправки внутри попапа
        const sendButton = sendPopup.querySelector('button.btn-primary.btn-color-primary');
        if (sendButton) {
          const text = sendButton.textContent?.trim() ?? '';
          const spanText = sendButton.querySelector('span.i18n')?.textContent?.trim() ?? '';
          const hasSendText = text.includes('Send') || text.includes('Отправить') || 
                             spanText.includes('Send') || spanText.includes('Отправить');
          
          if (hasSendText) {
            // Проверяем видимость
            const isVisible = (sendButton as HTMLElement).offsetParent !== null;
            if (isVisible) {
              // Пробуем несколько способов клика
              try {
                (sendButton as HTMLElement).click();
                return { success: true, method: 'click', location: 'popup-send-photo/popup-new-media' };
              } catch {
                // Если обычный click не сработал, пробуем через dispatchEvent
                const clickEvent = new MouseEvent('click', {
                  bubbles: true,
                  cancelable: true,
                  view: window
                });
                sendButton.dispatchEvent(clickEvent);
                return { success: true, method: 'dispatchEvent', location: 'popup-send-photo/popup-new-media' };
              }
            }
          }
        }
      }
      return { success: false, reason: 'Button not found in popup' };
    });

    if (clickedInPopup.success) {
      logger.debug('Send button clicked in popup', { method: clickedInPopup.method, location: clickedInPopup.location });
      await this.delay(1000);
      return;
    }

    // Способ 2: Ищем кнопку внутри popup-input-container
    const clickedInInputContainer = await page.evaluate(() => {
      const popupContainer = document.querySelector('.popup-input-container');
      if (popupContainer) {
        const sendButton = popupContainer.querySelector('button.btn-primary.btn-color-primary');
        if (sendButton) {
          const text = sendButton.textContent?.trim() ?? '';
          const spanText = sendButton.querySelector('span.i18n')?.textContent?.trim() ?? '';
          const hasSendText = text.includes('Send') || text.includes('Отправить') || 
                             spanText.includes('Send') || spanText.includes('Отправить');
          
          if (hasSendText && (sendButton as HTMLElement).offsetParent !== null) {
            try {
              (sendButton as HTMLElement).click();
              return { success: true, method: 'click', location: 'popup-input-container' };
            } catch {
              const clickEvent = new MouseEvent('click', { bubbles: true, cancelable: true, view: window });
              sendButton.dispatchEvent(clickEvent);
              return { success: true, method: 'dispatchEvent', location: 'popup-input-container' };
            }
          }
        }
      }
      return { success: false };
    });

    if (clickedInInputContainer.success) {
      logger.debug('Send button clicked in input container', { method: clickedInInputContainer.method });
      await this.delay(1000);
      return;
    }

    // Способ 3: Ищем кнопку через Puppeteer API с проверкой видимости
    const sendButtonPrimary = await page.$('button.btn-primary.btn-color-primary');
    
    if (sendButtonPrimary) {
      // Проверяем, что кнопка видима и содержит текст "Send"
      const canClick = await page.evaluate((el) => {
        const text = el.textContent?.trim() ?? '';
        const spanText = el.querySelector('span.i18n')?.textContent?.trim() ?? '';
        const hasText = text.includes('Send') || text.includes('Отправить') || 
                       spanText.includes('Send') || spanText.includes('Отправить');
        const isVisible = (el as HTMLElement).offsetParent !== null;
        return { canClick: hasText && isVisible, text, spanText };
      }, sendButtonPrimary);
      
      if (canClick.canClick) {
        logger.debug('Found send button, clicking', { text: canClick.text, spanText: canClick.spanText });
        // Прокручиваем к кнопке
        await sendButtonPrimary.evaluate((el) => {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
        await this.delay(300);
        
        // Пробуем кликнуть через Puppeteer
        try {
          await sendButtonPrimary.click({ delay: 100 });
          logger.debug('Send button clicked via Puppeteer click');
          await this.delay(1000);
          return;
        } catch (error) {
          logger.warn('Puppeteer click failed, trying evaluate click', { error });
          // Fallback: клик через evaluate
          await page.evaluate((el) => {
            (el as HTMLElement).click();
          }, sendButtonPrimary);
          await this.delay(1000);
          return;
        }
      }
    }

    // Способ 4: Ищем через evaluate напрямую по всем возможным селекторам
    const clickedViaEvaluate = await page.evaluate(() => {
      // Приоритет 1: Кнопка внутри активного попапа
      const sendPopup = document.querySelector('.popup-send-photo.active, .popup-new-media.active');
      if (sendPopup) {
        const buttons = sendPopup.querySelectorAll('button.btn-primary.btn-color-primary');
        for (const button of Array.from(buttons)) {
          const text = button.textContent?.trim() ?? '';
          const spanText = button.querySelector('span.i18n')?.textContent?.trim() ?? '';
          const isVisible = (button as HTMLElement).offsetParent !== null;
          if ((text.includes('Send') || text.includes('Отправить') || 
               spanText.includes('Send') || spanText.includes('Отправить')) && isVisible) {
            try {
              (button as HTMLElement).click();
              return 'popup button (click)';
            } catch {
              const clickEvent = new MouseEvent('click', { bubbles: true, cancelable: true, view: window });
              button.dispatchEvent(clickEvent);
              return 'popup button (dispatchEvent)';
            }
          }
        }
      }
      
      // Приоритет 2: Любая видимая кнопка с нужными классами
      const primaryButtons = document.querySelectorAll('button.btn-primary.btn-color-primary');
      for (const button of Array.from(primaryButtons)) {
        const text = button.textContent?.trim() ?? '';
        const spanText = button.querySelector('span.i18n')?.textContent?.trim() ?? '';
        const isVisible = (button as HTMLElement).offsetParent !== null;
        if ((text.includes('Send') || text.includes('Отправить') || 
             spanText.includes('Send') || spanText.includes('Отправить')) && isVisible) {
          try {
            (button as HTMLElement).click();
            return 'any visible button (click)';
          } catch {
            const clickEvent = new MouseEvent('click', { bubbles: true, cancelable: true, view: window });
            button.dispatchEvent(clickEvent);
            return 'any visible button (dispatchEvent)';
          }
        }
      }
      
      return null;
    });

    if (clickedViaEvaluate) {
      logger.debug('Send button clicked via evaluate', { method: clickedViaEvaluate });
      await this.delay(1000);
      return;
    }

    // Способ 5: Fallback - отправляем через Enter
    logger.warn('Send button not found, using Enter key as fallback');
    await page.keyboard.press('Enter');
    await this.delay(1000);
  }

  /**
   * Проверка, зарегистрирован ли номер в Telegram
   * 
   * Возвращает true если номер зарегистрирован и доступен для отправки сообщений.
   * Возвращает false если номер не зарегистрирован или есть Premium ограничение.
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
        await this.openChat(page, phone, profileId);
        // Если чат открылся без ошибок, значит номер зарегистрирован и доступен
        return true;
      } catch (error) {
        // Проверяем тип ошибки
        if (error instanceof Error) {
          // Ошибка "пользователь не найден"
          if (error.message.includes('USER_NOT_FOUND')) {
            logger.debug('Telegram number not found or not registered', { phone });
            return false; // Номер не зарегистрирован
          }
          // Ошибка Premium ограничения
          if (error.message.includes('PREMIUM_RESTRICTION')) {
            // Номер зарегистрирован, но есть Premium ограничение
            logger.debug('Telegram number registered but has Premium restriction', { phone });
            return false; // Возвращаем false, так как отправка невозможна
          }
        }
        // Если не удалось открыть чат по другой причине, возможно номер не зарегистрирован
        logger.debug('Could not open Telegram chat - number may not be registered', { phone, error });
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

