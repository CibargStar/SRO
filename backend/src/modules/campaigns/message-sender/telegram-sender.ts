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
  // Кнопка прикрепления файла (обновленные селекторы для Telegram Web K)
  ATTACH_BUTTON: 'button[aria-label*="Attach"], button[aria-label*="Прикрепить"], .btn-attach, .attach-button, [data-testid="attach"], button[title*="Attach"], button[title*="Прикрепить"]',
  // Кнопка отправки файла после загрузки
  SEND_FILE_BUTTON: 'button[aria-label*="Send"], button[aria-label*="Отправить"], .btn-send, [data-testid="send"]',
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
      let errorMessage: string;
      
      if (error instanceof Error) {
        // Обрабатываем специальную ошибку "пользователь не найден"
        if (error.message.includes('USER_NOT_FOUND')) {
          errorMessage = 'Пользователь с данным номером не найден в Telegram. Номер может быть неверным или не зарегистрирован в Telegram.';
          logger.warn('Telegram user not found', { 
            phone: input.phone, 
            profileId: input.profileId,
            error: errorMessage 
          });
        }
        // Обрабатываем специальную ошибку Premium ограничения
        else if (error.message.includes('PREMIUM_RESTRICTION')) {
          errorMessage = 'Пользователь настроил ограничение: только Premium пользователи могут писать ему. Требуется подписка Telegram Premium для отправки сообщений.';
          logger.warn('Telegram Premium restriction', { 
            phone: input.phone, 
            profileId: input.profileId,
            error: errorMessage 
          });
        } else {
          errorMessage = error.message;
          logger.error('Telegram send failed', { 
            phone: input.phone, 
            profileId: input.profileId, 
            error: errorMessage 
          });
        }
      } else {
        errorMessage = 'Unknown Telegram error';
        logger.error('Telegram send failed', { 
          phone: input.phone, 
          profileId: input.profileId, 
          error: errorMessage 
        });
      }
      
      return { success: false, messenger: 'TELEGRAM', error: errorMessage };
    }
  }

  /**
   * Проверка наличия ошибки "пользователь не найден"
   * 
   * ВАЖНО: Уведомление об ошибке появляется быстро и может исчезнуть через несколько секунд.
   * Проверяем несколько раз с небольшими интервалами, чтобы поймать уведомление.
   * 
   * Принцип: лучше пропустить реальную ошибку, чем заблокировать нормального пользователя.
   */
  private async checkUserNotFound(page: Page): Promise<boolean> {
    try {
      // Проверяем несколько раз с небольшими интервалами
      // Уведомление может появиться и исчезнуть быстро
      const maxChecks = 5; // Проверяем 5 раз
      const checkInterval = 500; // Каждые 500мс
      
      for (let i = 0; i < maxChecks; i++) {
        // Небольшая задержка перед первой проверкой
        if (i > 0) {
          await this.delay(checkInterval);
        }

        // Проверяем наличие сообщения об ошибке "пользователь не найден"
        const userNotFound = await page.evaluate((errorTexts) => {
          // Ищем уведомления (toast, notification) - они появляются поверх страницы
          // @ts-expect-error
          const notifications = document.querySelectorAll('[class*="toast"], [class*="notification"], [class*="snackbar"], [class*="alert"], [role="alert"]');
          
          // Ищем модальные окна (где обычно показываются ошибки)
          // @ts-expect-error
          const modalDialogs = document.querySelectorAll('[role="dialog"], .modal, .popup, [class*="modal"], [class*="popup"]');
          
          // Ищем специальные контейнеры для ошибок
          // @ts-expect-error
          const errorContainers = document.querySelectorAll('[class*="error"], [class*="not-found"], [class*="empty"], [class*="no-user"]');
          
          // Ищем в центральной области чата (где может появиться сообщение об ошибке)
          // @ts-expect-error
          const chatContent = document.querySelector('[class*="chat-content"], [class*="messages-container"], [class*="empty-state"], [class*="empty-chat"]');
          
          // Ищем в области сообщений об ошибке (Telegram может показывать ошибки в специальных блоках)
          // @ts-expect-error
          const messageBlocks = document.querySelectorAll('[class*="message"], [class*="bubble"], [class*="text"]');
          
          // Объединяем все возможные контейнеры для проверки
          const allContainers = [
            ...Array.from(notifications),
            ...Array.from(modalDialogs),
            ...Array.from(errorContainers),
            ...(chatContent ? [chatContent] : []),
            ...Array.from(messageBlocks)
          ];

          // Проверяем только в этих контейнерах
          for (const container of allContainers) {
            const containerText = (container.textContent || '').toLowerCase();
            
            // Ищем конкретные фразы об ошибке
            for (const errorText of errorTexts) {
              const errorTextLower = errorText.toLowerCase();
              
              // Проверяем, что полная фраза присутствует в контейнере
              if (containerText.includes(errorTextLower)) {
                // Дополнительная проверка: убеждаемся, что это действительно сообщение об ошибке
                // Ищем очень специфичные фразы, которые точно не могут быть в другом контексте
                if (errorTextLower.includes("doesn't seem to exist") || 
                    errorTextLower.includes('does not exist') ||
                    (errorTextLower.includes('sorry') && errorTextLower.includes('user'))) {
                  return true;
                }
                
                // Для русских фраз также проверяем специфичность
                if (errorTextLower.includes('извините') && errorTextLower.includes('не найден')) {
                  return true;
                }
                
                // Если это уведомление (toast/notification) и содержит фразу - точно ошибка
                if (container.matches('[class*="toast"], [class*="notification"], [class*="snackbar"], [role="alert"]')) {
                  return true;
                }
              }
            }
          }

          // Если ничего не найдено в контексте - считаем что ошибки нет
          return false;
        }, USER_NOT_FOUND_ERROR_TEXTS);

        // Если ошибка найдена - возвращаем сразу
        if (userNotFound) {
          logger.debug('User not found error detected on check', { checkNumber: i + 1 });
          return true;
        }
      }

      // Если после всех проверок ошибка не найдена - считаем что её нет
      return false;
    } catch (error) {
      logger.warn('Failed to check user not found error', { error });
      // В случае ошибки проверки, считаем что пользователь найден (не блокируем отправку)
      // Лучше пропустить реальную ошибку, чем заблокировать нормального пользователя
      return false;
    }
  }

  /**
   * Проверка наличия Premium ограничения
   * 
   * ВАЖНО: Проверяем только конкретные полные фразы об ошибке, которые появляются
   * именно при попытке написать Premium пользователю. НЕ ищем просто слово "Premium"
   * на странице, так как оно может быть в рекламе или других элементах интерфейса.
   * 
   * Принцип: лучше пропустить реальное ограничение, чем заблокировать обычного пользователя.
   */
  private async checkPremiumRestriction(page: Page): Promise<boolean> {
    try {
      // Ждем немного для загрузки контента
      await this.delay(1500);

      // Проверяем наличие конкретных сообщений об ошибке Premium ограничения
      const hasPremiumRestriction = await page.evaluate((errorTexts) => {
        // @ts-expect-error - document доступен в браузерном контексте Puppeteer
        const bodyText = document.body.innerText || '';
        const bodyTextLower = bodyText.toLowerCase();

        // Ищем только полные фразы об ошибке из списка
        // Каждая фраза - это конкретное сообщение, которое появляется именно при ошибке Premium
        for (const errorText of errorTexts) {
          const errorTextLower = errorText.toLowerCase();
          
          // Проверяем, что полная фраза присутствует в тексте страницы
          // Это более надежно, чем искать отдельные слова
          if (bodyTextLower.includes(errorTextLower)) {
            // Дополнительная проверка: убеждаемся, что это не просто случайное совпадение
            // Ищем в области чата или модальном окне (где обычно показываются ошибки)
            // @ts-expect-error
            const chatArea = document.querySelector('[class*="chat"], [class*="message"], [class*="bubble"], [class*="composer"]');
            // @ts-expect-error
            const modalDialogs = document.querySelectorAll('[role="dialog"], .modal, .popup');
            
            // Если найдена фраза об ошибке, проверяем контекст
            let foundInContext = false;
            
            // Проверяем в области чата
            if (chatArea) {
              const chatAreaText = (chatArea.textContent || '').toLowerCase();
              if (chatAreaText.includes(errorTextLower)) {
                foundInContext = true;
              }
            }
            
            // Проверяем в модальных окнах
            for (const modal of Array.from(modalDialogs)) {
              const modalText = (modal.textContent || '').toLowerCase();
              if (modalText.includes(errorTextLower)) {
                foundInContext = true;
                break;
              }
            }
            
            // Если фраза найдена в контексте чата или модального окна - это реальная ошибка
            if (foundInContext) {
              return true;
            }
            
            // Если контекст не найден, но фраза очень специфична (содержит "only accepts messages" или "только принимает")
            // то считаем это ошибкой (такие фразы не появляются в рекламе)
            if (errorTextLower.includes('only accepts messages') || 
                errorTextLower.includes('только принимает') ||
                errorTextLower.includes('only premium users can message') ||
                errorTextLower.includes('только пользователи premium могут писать')) {
              return true;
            }
          }
        }

        // Если ничего не найдено - ограничения нет
        return false;
      }, PREMIUM_ERROR_TEXTS);

      return hasPremiumRestriction;
    } catch (error) {
      logger.warn('Failed to check Premium restriction', { error });
      // В случае ошибки проверки, считаем что ограничения нет (не блокируем отправку)
      // Лучше пропустить реальное ограничение, чем заблокировать обычного пользователя
      return false;
    }
  }

  /**
   * Открытие чата по номеру через прямую ссылку
   */
  private async openChat(page: Page, phone: string): Promise<void> {
    try {
      // Нормализуем номер телефона (убираем все кроме цифр)
      const normalizedPhone = phone.replace(/[^\d]/g, '');

      // Убеждаемся, что страница готова (особенно важно для первого контакта)
      // Проверяем, что страница не закрыта и загружена
      if (page.isClosed()) {
        throw new Error('Page is closed');
      }

      // Если страница еще не загружена на базовый URL Telegram, сначала загружаем его
      const currentUrl = page.url();
      if (!currentUrl.includes('web.telegram.org')) {
        logger.debug('Page not on Telegram Web, navigating to base URL first', { currentUrl });
        await page.goto('https://web.telegram.org/k', { waitUntil: 'networkidle2', timeout: 30000 });
        // Даем время для инициализации Telegram Web
        await this.delay(2000);
      }

      // URL для открытия чата в Telegram Web через прямую ссылку
      // Формат: https://web.telegram.org/k/#?tgaddr=tg%3A%2F%2Fresolve%3Fphone%3D{номер}
      // где tg%3A%2F%2Fresolve%3Fphone%3D - это URL-encoded версия tg://resolve?phone=
      const chatUrl = `https://web.telegram.org/k/#?tgaddr=tg%3A%2F%2Fresolve%3Fphone%3D${normalizedPhone}`;

      logger.debug('Navigating to chat URL', { phone: normalizedPhone, chatUrl });

      // Переходим на страницу чата
      // Используем waitForNavigation для гарантии, что навигация завершена
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {
          // Если waitForNavigation не сработал (например, hash-изменение), это нормально
          // Telegram Web может обрабатывать hash-параметры без полной перезагрузки
        }),
        page.goto(chatUrl, { waitUntil: 'networkidle2', timeout: 30000 }),
      ]);

      // Дополнительное ожидание для обработки hash-параметров Telegram Web
      // Telegram Web обрабатывает hash-параметры асинхронно через JavaScript
      // Но не ждем слишком долго - уведомление об ошибке может появиться быстро
      await this.delay(1000);

      // Проверяем, что URL действительно изменился (хотя бы содержит номер)
      const finalUrl = page.url();
      if (!finalUrl.includes(normalizedPhone) && !finalUrl.includes('tgaddr')) {
        logger.warn('URL may not have changed after navigation', { 
          expected: chatUrl, 
          actual: finalUrl,
          phone: normalizedPhone 
        });
        // Не бросаем ошибку, так как Telegram Web может обработать параметр позже
      }

      // Проверяем наличие ошибок сразу после навигации
      // Это важно, так как уведомление об ошибке появляется быстро и может исчезнуть
      // Метод checkUserNotFound проверяет несколько раз с интервалами
      const userNotFound = await this.checkUserNotFound(page);
      if (userNotFound) {
        logger.warn('User not found error detected', { phone: normalizedPhone });
        throw new Error('USER_NOT_FOUND: Sorry, this user doesn\'t seem to exist');
      }

      const hasPremiumRestriction = await this.checkPremiumRestriction(page);
      if (hasPremiumRestriction) {
        logger.warn('Premium restriction detected', { phone: normalizedPhone });
        throw new Error('PREMIUM_RESTRICTION: Only Premium users can message this user');
      }

      // Ждем, пока загрузится интерфейс чата
      // Ждем появления поля ввода сообщения
      // Увеличиваем таймаут для первого контакта, так как Telegram Web может загружаться дольше
      try {
        await page.waitForSelector(TELEGRAM_SELECTORS.MESSAGE_INPUT, { timeout: 20000 });
      } catch (error) {
        // Если поле ввода не найдено, проверяем ошибки еще раз
        // Возможно, ошибка появилась позже
        const userNotFoundRetry = await this.checkUserNotFound(page);
        if (userNotFoundRetry) {
          logger.warn('User not found error detected on retry', { phone: normalizedPhone });
          throw new Error('USER_NOT_FOUND: Sorry, this user doesn\'t seem to exist');
        }

        const hasPremiumRestrictionRetry = await this.checkPremiumRestriction(page);
        if (hasPremiumRestrictionRetry) {
          logger.warn('Premium restriction detected on retry', { phone: normalizedPhone });
          throw new Error('PREMIUM_RESTRICTION: Only Premium users can message this user');
        }

        // Если ошибок нет, но поле ввода все равно не найдено - пробрасываем исходную ошибку
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        logger.error('Message input field not found and no specific errors detected', { 
          phone: normalizedPhone,
          error: errorMsg 
        });
        throw new Error(`Failed to find message input field: ${errorMsg}`);
      }

      // Небольшая задержка для стабилизации интерфейса
      await this.delay(1000);

      logger.debug('Telegram chat opened', { phone: normalizedPhone, finalUrl });
    } catch (error) {
      // Если это уже наши специфичные ошибки - пробрасываем дальше
      if (error instanceof Error && (
        error.message.includes('PREMIUM_RESTRICTION') || 
        error.message.includes('USER_NOT_FOUND')
      )) {
        throw error;
      }

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
   * Отправка файла/вложений
   */
  private async sendFileMessage(page: Page, attachmentPath: string): Promise<void> {
    try {
      // Преобразуем путь в абсолютный
      const absolutePath = this.resolveFilePath(attachmentPath);
      
      // Проверяем существование файла
      const fileExists = await this.checkFileExists(absolutePath);
      if (!fileExists) {
        throw new Error(`File not found: ${absolutePath} (original path: ${attachmentPath})`);
      }

      logger.debug('Sending Telegram file', { 
        originalPath: attachmentPath, 
        absolutePath,
        fileExists 
      });

      // Ждем появления поля ввода (чтобы убедиться, что чат открыт)
      await page.waitForSelector(TELEGRAM_SELECTORS.MESSAGE_INPUT, { timeout: 10000 });
      await this.delay(500);

      // Ищем кнопку прикрепления файла с несколькими попытками
      let attachButton = await page.$(TELEGRAM_SELECTORS.ATTACH_BUTTON);
      
      // Если не найдена, пробуем найти через поиск по aria-label и title
      if (!attachButton) {
        logger.debug('Attach button not found with primary selector, trying alternative methods');
        
        // Пробуем найти через evaluate
        attachButton = await page.evaluateHandle((selector) => {
          // @ts-expect-error
          const buttons = document.querySelectorAll('button');
          for (const btn of buttons) {
            const ariaLabel = btn.getAttribute('aria-label') || '';
            const title = btn.getAttribute('title') || '';
            const className = btn.className || '';
            
            if (
              ariaLabel.toLowerCase().includes('attach') ||
              ariaLabel.toLowerCase().includes('прикрепить') ||
              title.toLowerCase().includes('attach') ||
              title.toLowerCase().includes('прикрепить') ||
              className.toLowerCase().includes('attach')
            ) {
              return btn;
            }
          }
          return null;
        });
      }

      if (!attachButton || attachButton.asElement() === null) {
        throw new Error('Attach button not found. Please check if Telegram Web interface has changed.');
      }

      // Используем современный API Puppeteer для загрузки файлов
      logger.debug('Clicking attach button and waiting for file chooser');
      const [fileChooser] = await Promise.all([
        page.waitForFileChooser({ timeout: 15000 }),
        attachButton.asElement()!.click(),
      ]);

      logger.debug('File chooser opened, accepting file', { absolutePath });
      await fileChooser.accept([absolutePath]);
      
      // Ждем загрузки файла (появление превью или индикатора загрузки)
      await this.delay(2000);
      
      // Проверяем, что файл загрузился (ищем превью или индикатор)
      const fileUploaded = await page.evaluate(() => {
        // @ts-expect-error
        const bodyText = document.body.innerText || '';
        // Проверяем наличие индикаторов загрузки или превью
        // @ts-expect-error
        const previews = document.querySelectorAll('[class*="preview"], [class*="media"], [class*="file"]');
        return previews.length > 0 || bodyText.includes('Uploading') || bodyText.includes('Загрузка');
      });

      if (!fileUploaded) {
        logger.warn('File upload indicator not found, but continuing anyway');
      }

      // Ждем еще немного для завершения загрузки
      await this.delay(1000);

      // Пробуем отправить файл через Enter
      logger.debug('Sending file via Enter key');
      await page.keyboard.press('Enter');
      
      // Альтернативный способ: ищем кнопку отправки и кликаем
      await this.delay(500);
      const sendButton = await page.$(TELEGRAM_SELECTORS.SEND_FILE_BUTTON);
      if (sendButton) {
        logger.debug('Found send button, clicking it');
        await sendButton.click();
      }

      // Ждем подтверждения отправки
      await this.delay(2000);

      logger.debug('Telegram file message sent successfully', { 
        attachmentPath: absolutePath 
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to send Telegram file message', { 
        attachmentPath, 
        error: errorMsg,
        stack: error instanceof Error ? error.stack : undefined
      });
      throw new Error(`Failed to send file message: ${errorMsg}`);
    }
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
        await this.openChat(page, phone);
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

