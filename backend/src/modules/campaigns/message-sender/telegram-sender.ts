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

      // ВАЖНО: Активируем вкладку Telegram перед отправкой
      // Это гарантирует, что мы работаем именно с этой вкладкой,
      // даже если мониторинг статуса переключил фокус
      await page.bringToFront();
      await this.delay(100);

      // Открываем чат с номером (передаём profileId для кэширования)
      await this.openChat(page, input.phone, input.profileId);

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
          await this.sendFileMessage(page, attachment, input.phone, input.profileId);
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
   * Проверяет, не открыт ли уже чат с этим номером - если да, не перезагружает страницу
   */
  private async openChat(page: Page, phone: string, profileId?: string): Promise<void> {
    try {
      // Нормализуем номер телефона (убираем все кроме цифр)
      const normalizedPhone = phone.replace(/[^\d]/g, '');

      // Убеждаемся, что страница готова (особенно важно для первого контакта)
      // Проверяем, что страница не закрыта и загружена
      if (page.isClosed()) {
        // Сбрасываем кэш для этого профиля если страница закрыта
        if (profileId) {
          this.currentOpenChat.delete(profileId);
        }
        throw new Error('Page is closed');
      }

      // Проверяем, не открыт ли уже чат с этим номером
      // ВАЖНО: После ошибки на предыдущем контакте кэш уже сброшен, 
      // поэтому для нового контакта чат будет переоткрыт
      const cachedPhone = profileId ? this.currentOpenChat.get(profileId) : null;
      
      if (cachedPhone === normalizedPhone) {
        // Чат уже открыт с этим номером - проверяем что поле ввода доступно
        logger.debug('Chat already open for this phone, checking input field', { phone: normalizedPhone, profileId });
        
        try {
          // Проверяем что поле ввода есть
          const inputExists = await page.$(TELEGRAM_SELECTORS.MESSAGE_INPUT);
          if (inputExists) {
            // Проверяем, что мы действительно в чате (нет ошибок на странице)
            const hasErrors = await this.checkUserNotFound(page);
            if (!hasErrors) {
              logger.debug('Chat verified, using existing session', { phone: normalizedPhone });
              await this.delay(200);
              return;
            }
          }
          // Поле ввода не найдено или есть ошибки - нужно переоткрыть чат
          logger.debug('Chat verification failed, reopening', { phone: normalizedPhone });
          // Сбрасываем кэш
          if (profileId) {
            this.currentOpenChat.delete(profileId);
          }
        } catch {
          // Ошибка проверки - переоткроем чат
          logger.debug('Chat check error, reopening', { phone: normalizedPhone });
          // Сбрасываем кэш
          if (profileId) {
            this.currentOpenChat.delete(profileId);
          }
        }
      }

      // Проверяем текущее состояние страницы
      const currentUrl = page.url();
      
      // Если страница не на Telegram Web или содержит tgaddr (предыдущий запрос на чат),
      // сначала загружаем базовый URL для "чистого" состояния
      if (!currentUrl.includes('web.telegram.org') || currentUrl.includes('tgaddr')) {
        logger.debug('Resetting page to base Telegram URL', { currentUrl });
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
        // ВАЖНО: Сбрасываем кэш, чтобы следующий контакт гарантированно переоткрыл чат
        if (profileId) {
          this.currentOpenChat.delete(profileId);
        }
        throw new Error('USER_NOT_FOUND: Sorry, this user doesn\'t seem to exist');
      }

      const hasPremiumRestriction = await this.checkPremiumRestriction(page);
      if (hasPremiumRestriction) {
        logger.warn('Premium restriction detected', { phone: normalizedPhone });
        // ВАЖНО: Сбрасываем кэш, чтобы следующий контакт гарантированно переоткрыл чат
        if (profileId) {
          this.currentOpenChat.delete(profileId);
        }
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
          // ВАЖНО: Сбрасываем кэш
          if (profileId) {
            this.currentOpenChat.delete(profileId);
          }
          throw new Error('USER_NOT_FOUND: Sorry, this user doesn\'t seem to exist');
        }

        const hasPremiumRestrictionRetry = await this.checkPremiumRestriction(page);
        if (hasPremiumRestrictionRetry) {
          logger.warn('Premium restriction detected on retry', { phone: normalizedPhone });
          // ВАЖНО: Сбрасываем кэш
          if (profileId) {
            this.currentOpenChat.delete(profileId);
          }
          throw new Error('PREMIUM_RESTRICTION: Only Premium users can message this user');
        }

        // Если ошибок нет, но поле ввода все равно не найдено - пробрасываем исходную ошибку
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        logger.error('Message input field not found and no specific errors detected', { 
          phone: normalizedPhone,
          error: errorMsg 
        });
        // Сбрасываем кэш при ошибке
        if (profileId) {
          this.currentOpenChat.delete(profileId);
        }
        throw new Error(`Failed to find message input field: ${errorMsg}`);
      }

      // Небольшая задержка для стабилизации интерфейса
      await this.delay(1000);

      // Сохраняем в кэш
      if (profileId) {
        this.currentOpenChat.set(profileId, normalizedPhone);
      }

      logger.debug('Telegram chat opened', { phone: normalizedPhone, finalUrl, profileId });
    } catch (error) {
      // ВСЕГДА сбрасываем кэш при любой ошибке
      if (profileId) {
        this.currentOpenChat.delete(profileId);
      }
      
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
   */
  private async sendFileMessage(page: Page, attachmentPath: string, phone?: string, profileId?: string): Promise<void> {
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

      logger.debug('Sending Telegram file', { 
        originalPath: attachmentPath, 
        absolutePath,
        fileType,
        fileExists 
      });

      // Проверяем что мы в правильном чате (без переоткрытия - чат уже открыт в sendMessage)
      if (phone) {
        const normalizedPhone = phone.replace(/[^\d]/g, '');
        const cachedPhone = profileId ? this.currentOpenChat.get(profileId) : null;
        if (cachedPhone !== normalizedPhone) {
          logger.warn('Chat may have changed, but continuing with file send', { phone: normalizedPhone, cachedPhone });
        }
      }

      // Ждем появления поля ввода (чтобы убедиться, что чат открыт)
      await page.waitForSelector(TELEGRAM_SELECTORS.MESSAGE_INPUT, { timeout: 10000 });
      await this.delay(500);

      // Используем FileChooser метод с fallback на прямой upload
      await this.sendFileViaFileChooser(page, absolutePath, fileType);

      // Ждем загрузки файла и появления превью
      await this.delay(2000);

      // Проверяем, что файл загружен (появление превью или попапа)
      const fileLoaded = await this.waitForFilePreview(page);
      if (!fileLoaded) {
        logger.warn('File preview not detected, but continuing');
      }

      // Дополнительная задержка для полной загрузки файла и появления попапа
      await this.delay(2000);

      // Отправляем файл (clickSendButton сам будет ждать появления попапа)
      await this.clickSendButton(page);
      
      // Ждем подтверждения отправки
      await this.delay(2000);

      logger.debug('Telegram file message sent successfully', { 
        attachmentPath: absolutePath,
        phone,
        profileId
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to send Telegram file message', { 
        attachmentPath, 
        phone,
        profileId,
        error: errorMsg,
        stack: error instanceof Error ? error.stack : undefined
      });
      throw new Error(`Failed to send file message: ${errorMsg}`);
    }
  }

  /**
   * Ожидание превью файла
   * Проверяет, что файл загрузился (появление превью, попапа или индикаторов загрузки)
   */
  private async waitForFilePreview(page: Page): Promise<boolean> {
    const maxChecks = 15; // Увеличиваем количество проверок
    const checkInterval = 500;
    
    for (let i = 0; i < maxChecks; i++) {
      await this.delay(checkInterval);
      
      const hasPreview = await page.evaluate(() => {
        // Проверяем разные индикаторы загрузки файла
        
        // 1. Проверяем попап отправки файла (самый надежный индикатор)
        const sendPopup = document.querySelector('.popup-send-photo.active, .popup-new-media.active');
        if (sendPopup) {
          return true;
        }
        
        // 2. Проверяем превью файла
        const previewSelectors = [
          'img[src*="blob"]',
          'video[src*="blob"]',
          '[data-testid*="media"]',
          '[class*="preview"]',
          '[class*="attachment"]',
          '[class*="media-container"]',
          '[class*="document"]',
          '.popup-photo',
          '.popup-item-document',
        ];
        
        for (const sel of previewSelectors) {
          if (document.querySelector(sel)) {
            return true;
          }
        }
        
        // 3. Проверяем текст "Uploading" или "Загрузка" (файл еще загружается)
        const bodyText = document.body.innerText ?? '';
        if (bodyText.includes('Uploading') || bodyText.includes('Загрузка')) {
          return true; // Файл загружается, но это тоже индикатор
        }
        
        return false;
      });
      
      if (hasPreview) {
        logger.debug('File preview/popup detected', { checkNumber: i + 1 });
        return true;
      }
    }
    
    logger.warn('File preview/popup not detected after all checks');
    return false;
  }

  /**
   * Клик на кнопку отправки
   * Ищет кнопку в попапе отправки файла (popup-send-photo или popup-new-media)
   */
  private async clickSendButton(page: Page): Promise<void> {
    // Ждем появления попапа отправки файла
    logger.debug('Waiting for send popup to appear');
    try {
      // Ждем появления активного попапа отправки файла (увеличиваем таймаут)
      await page.waitForSelector('.popup-send-photo.active, .popup-new-media.active', { 
        timeout: 15000, // Увеличиваем таймаут до 15 секунд
        visible: true 
      });
      await this.delay(1000);
      logger.debug('Send popup appeared');
    } catch (error) {
      logger.warn('Send popup not found, trying alternative selectors', { error });
      // Пробуем альтернативные селекторы
      try {
        await page.waitForSelector('.popup-input-container, button.btn-primary.btn-color-primary', { 
          timeout: 5000,
          visible: true 
        });
        await this.delay(500);
        logger.debug('Alternative selector found');
      } catch {
        logger.warn('Alternative selectors also not found');
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

