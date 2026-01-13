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
  // Поле ввода сообщения - приоритет специфичным селекторам
  MESSAGE_INPUT: [
    '.new-message-wrapper[data-offset="commands"] .input-message-input:not(.input-field-input-fake)', // С data-offset="commands"
    '.new-message-wrapper .input-message-container .input-message-input:not(.input-field-input-fake)', // Через input-message-container
    '.new-message-wrapper .input-message-input:not(.input-field-input-fake)', // Основной селектор - реальное поле ввода (не фейковое)
    '.input-message-container .input-message-input:not(.input-field-input-fake)', // Альтернативный путь
    '.input-message-input[contenteditable="true"]:not(.input-field-input-fake)', // По contenteditable, исключая фейковое
    '.input-message-input[data-peer-id]', // С data-peer-id (характерно для реального поля)
    '.input-message-input', // Fallback
    '.composer-input', // Старый формат
    'textarea[placeholder*="Message"]', // Еще более старый формат
  ],
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
  /**
   * Кэш ожидаемого peer-id для каждого профиля
   * Ключ: profileId, Значение: peer-id текущего открытого чата
   */
  private expectedPeerId: Map<string, string> = new Map();

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
      const normalizedPhone = input.phone.replace(/[^\d]/g, '');
      await this.openChat(page, input.phone, input.profileId);

      // Отправляем текст (передаем номер и profileId для проверки правильности чата)
      if (input.text) {
        await this.sendTextMessage(page, input.text, normalizedPhone, input.profileId);
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
   * Улучшенная версия - ищет только в активных уведомлениях и модальных окнах, не в старых сообщениях
   */
  private async checkPremiumRestriction(page: Page): Promise<boolean> {
    try {
      return await page.evaluate((errorTexts) => {
        // ВАЖНО: Ищем только в активных уведомлениях, модальных окнах и toast-сообщениях
        // НЕ ищем в старых сообщениях чата, чтобы избежать ложных срабатываний
        
        // 1. Проверяем toast-уведомления (самый надежный индикатор)
        const toasts = document.querySelectorAll(
          '[class*="toast"], [class*="notification"], [role="alert"]'
        );
        
        for (const toast of Array.from(toasts)) {
          const htmlToast = toast as HTMLElement;
          if (!htmlToast) { continue; }
          
          // Проверяем видимость toast
          const style = window.getComputedStyle(htmlToast);
          const isVisible = htmlToast.offsetParent !== null && 
                           style.display !== 'none' && 
                           style.visibility !== 'hidden' &&
                           style.opacity !== '0';
          
          if (!isVisible) { continue; }
          
          const text = (htmlToast.textContent || '').toLowerCase();
          for (const errorText of errorTexts) {
            if (text.includes(errorText.toLowerCase())) {
              return true;
            }
          }
        }
        
        // 2. Проверяем активные модальные окна (диалоги)
        const dialogs = document.querySelectorAll('[role="dialog"]');
        for (const dialog of Array.from(dialogs)) {
          const htmlDialog = dialog as HTMLElement;
          if (!htmlDialog) { continue; }
          
          // Проверяем видимость диалога
          const style = window.getComputedStyle(htmlDialog);
          const isVisible = htmlDialog.offsetParent !== null && 
                           style.display !== 'none' && 
                           style.visibility !== 'hidden';
          
          if (!isVisible) { continue; }
          
          const text = (htmlDialog.textContent || '').toLowerCase();
          for (const errorText of errorTexts) {
            if (text.includes(errorText.toLowerCase())) {
              return true;
            }
          }
        }
        
        // 3. Проверяем область ввода сообщения (composer) - только если там есть ошибка
        const composer = document.querySelector('[class*="composer"], .input-message-container');
        if (composer) {
          const htmlComposer = composer as HTMLElement;
          const style = window.getComputedStyle(htmlComposer);
          const isVisible = htmlComposer.offsetParent !== null && 
                           style.display !== 'none' && 
                           style.visibility !== 'hidden';
          
          if (isVisible) {
            // Ищем только в видимых элементах внутри composer, не в скрытых сообщениях
            const visibleElements = composer.querySelectorAll('*');
            for (const el of Array.from(visibleElements)) {
              const htmlEl = el as HTMLElement;
              const elStyle = window.getComputedStyle(htmlEl);
              if (htmlEl.offsetParent === null || 
                  elStyle.display === 'none' || 
                  elStyle.visibility === 'hidden') {
                continue;
              }
              
              const text = (htmlEl.textContent || '').toLowerCase();
              for (const errorText of errorTexts) {
                if (text.includes(errorText.toLowerCase())) {
                  return true;
                }
              }
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
          this.expectedPeerId.delete(profileId);
        }
        throw new Error('Page is closed');
      }

      // ВАЖНО: Сбрасываем кэш ПЕРЕД открытием нового чата, чтобы избежать проблем с переключением
      // Проверяем, нужно ли открывать новый чат
      const cachedPhone = profileId ? this.currentOpenChat.get(profileId) : null;
      
      if (cachedPhone === normalizedPhone) {
        // Проверяем, что чат действительно открыт и активен
        // ВАЖНО: Всегда ищем поле заново, не используем кэшированное
        const inputField = await this.findMessageInput(page);
        if (inputField) {
          // Дополнительная проверка: убеждаемся, что поле в активном контейнере
          const isActive = await page.evaluate((el) => {
            const htmlEl = el as HTMLElement;
            if (!htmlEl) { return false; }
            
            // Проверяем видимость
            const style = window.getComputedStyle(htmlEl);
            if (htmlEl.offsetParent === null || 
                style.display === 'none' || 
                style.visibility === 'hidden') {
              return false;
            }
            
            // Проверяем, что поле в активном контейнере
            const wrapper = htmlEl.closest('.new-message-wrapper');
            if (!wrapper) { return false; }
            
            const wrapperStyle = window.getComputedStyle(wrapper as HTMLElement);
            return (wrapper as HTMLElement).offsetParent !== null && 
                   wrapperStyle.display !== 'none' && 
                   wrapperStyle.visibility !== 'hidden';
          }, inputField).catch(() => false);
          
          if (isActive) {
            logger.debug('Chat already open and active, reusing', { phone: normalizedPhone, profileId });
            // Убеждаемся, что страница активна
            await page.bringToFront();
            await this.delay(200);
            return;
          }
        }
        // Чат не активен или поле не найдено - сбрасываем кэш и открываем заново
        logger.debug('Cached chat invalid or inactive, reopening', { phone: normalizedPhone });
        if (profileId) {
          this.currentOpenChat.delete(profileId);
          this.expectedPeerId.delete(profileId);
        }
      } else {
        // Открываем новый чат - сбрасываем кэш старого чата
        if (profileId && cachedPhone) {
          logger.debug('Switching to new chat, clearing old cache', { 
            oldPhone: cachedPhone, 
            newPhone: normalizedPhone 
          });
          this.currentOpenChat.delete(profileId);
          this.expectedPeerId.delete(profileId);
        }
      }

      // КРИТИЧЕСКИ ВАЖНО: Очищаем expectedPeerId при открытии нового контакта
      // expectedPeerId должен быть установлен только после успешного открытия чата
      // и использоваться только для текущего контакта
      if (profileId) {
        this.expectedPeerId.delete(profileId);
      }
      
      // URL для открытия чата напрямую
      const chatUrl = `https://web.telegram.org/k/#?tgaddr=tg%3A%2F%2Fresolve%3Fphone%3D${normalizedPhone}`;
      
      logger.debug('Opening chat', { phone: normalizedPhone, chatUrl, profileId });

      // Убеждаемся, что страница активна перед переходом
      await page.bringToFront();
      await this.delay(100);

      // ВАЖНО: Сохраняем data-peer-id старого поля ввода (если есть) для проверки
      // НО: очищаем его если открываем тот же контакт (чтобы не блокировать поиск)
      const oldPeerIdInfo = await page.evaluate((): { found: boolean; peerId: string | null; isVisible: boolean } => {
        const oldInput = document.querySelector('.input-message-input[contenteditable="true"]:not(.input-field-input-fake)');
        if (oldInput) {
          const htmlEl = oldInput as HTMLElement;
          const peerId = htmlEl.getAttribute('data-peer-id');
          const isVisible = htmlEl.offsetParent !== null;
          // Явно удаляем фокус со старого поля ПЕРЕД переходом
          htmlEl?.blur();
          return { found: true, peerId, isVisible };
        }
        return { found: false, peerId: null, isVisible: false };
      }).catch(() => ({ found: false, peerId: null, isVisible: false }));
      
      // ВАЖНО: Если открываем тот же контакт, не используем oldPeerId для блокировки
      // (peer-id может совпадать, и мы должны использовать существующее поле)
      let oldPeerId: string | null = null;
      if (oldPeerIdInfo.found && oldPeerIdInfo.peerId) {
        // Проверяем, не открываем ли мы тот же контакт
        const isSameContact = cachedPhone === normalizedPhone;
        if (!isSameContact) {
          // Только если это другой контакт, используем oldPeerId для фильтрации
          oldPeerId = oldPeerIdInfo.peerId;
        } else {
          // Если тот же контакт, очищаем oldPeerId - будем использовать существующее поле
          logger.debug('Opening same contact, will reuse existing input field', { phone: normalizedPhone });
        }
      }

      logger.debug('Old chat peer-id before navigation', { oldPeerId, newPhone: normalizedPhone });

      // ВАЖНО: Явно удаляем фокус с активного элемента ПЕРЕД переходом
      await page.evaluate(() => {
        const activeEl = document.activeElement;
        if (activeEl && activeEl instanceof HTMLElement) {
          activeEl.blur();
        }
      }).catch(() => {
        logger.debug('Could not blur active element before navigation');
      });
      
      await this.delay(200);

      // Переходим напрямую на URL чата
      // Используем networkidle для более надежной загрузки
      try {
        await page.goto(chatUrl, { waitUntil: 'networkidle0', timeout: 30000 });
      } catch {
        // Если networkidle не сработал, пробуем domcontentloaded
        logger.debug('networkidle timeout, trying domcontentloaded');
        await page.goto(chatUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
      }
      
      // ВАЖНО: После page.goto() ждем стабилизации URL и появления поля ввода
      // Telegram Web может перенаправлять на другие чаты или не загружать поле сразу
      await this.delay(1000); // Даем время на перенаправление и загрузку
      
      // КРИТИЧЕСКИ ВАЖНО: Проверяем ошибку USER_NOT_FOUND сразу после page.goto()
      // Ошибка может появиться сразу, не нужно ждать окончания ожидания поля ввода
      const userNotFoundEarly = await this.quickCheckUserNotFound(page);
      if (userNotFoundEarly) {
        logger.warn('User not found error detected immediately after page.goto()', { 
          phone: normalizedPhone, 
          profileId 
        });
        if (profileId) {
          this.currentOpenChat.delete(profileId);
          this.expectedPeerId.delete(profileId);
        }
        throw new Error('USER_NOT_FOUND: Sorry, this user doesn\'t seem to exist');
      }
      
      // Проверяем, что URL содержит нужный номер или поле ввода появилось
      // Если URL изменился неправильно, пробуем еще раз
      const urlCheck = await page.evaluate((expectedPhone) => {
        const url = window.location.href;
        // URL должен содержать номер телефона в tgaddr или быть валидным чатом
        const hasPhoneInUrl = url.includes(`phone%3D${expectedPhone}`) || url.includes(`phone=${expectedPhone}`);
        // Или проверяем наличие поля ввода
        const hasInputField = document.querySelector('.input-message-input[contenteditable="true"]:not(.input-field-input-fake)') !== null;
        return { url, hasPhoneInUrl, hasInputField };
      }, normalizedPhone).catch(() => ({ url: 'unknown', hasPhoneInUrl: false, hasInputField: false }));
      
      // Если URL не содержит номер и поле ввода нет, пробуем еще раз с большей задержкой
      if (!urlCheck.hasPhoneInUrl && !urlCheck.hasInputField) {
        logger.warn('URL changed or input field not found after goto, retrying', { 
          url: urlCheck.url, 
          expectedPhone: normalizedPhone 
        });
        
        // Пробуем еще раз перейти на URL, но с ожиданием стабилизации
        try {
          // Очищаем текущее состояние - перезагружаем страницу
          await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
          await this.delay(1000);
          
          // Теперь переходим на нужный чат
          await page.goto(chatUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
          await this.delay(2000); // Увеличенная задержка для стабилизации
          
          // Проверяем еще раз
          const retryCheck = await page.evaluate((expectedPhone) => {
            const url = window.location.href;
            const hasPhoneInUrl = url.includes(`phone%3D${expectedPhone}`) || url.includes(`phone=${expectedPhone}`);
            const hasInputField = document.querySelector('.input-message-input[contenteditable="true"]:not(.input-field-input-fake)') !== null;
            return { url, hasPhoneInUrl, hasInputField };
          }, normalizedPhone).catch(() => ({ url: 'unknown', hasPhoneInUrl: false, hasInputField: false }));
          
          if (!retryCheck.hasInputField) {
            logger.warn('Input field still not found after retry', { url: retryCheck.url });
          }
        } catch (err) {
          logger.debug('Retry goto failed', { error: err instanceof Error ? err.message : 'unknown' });
        }
      }

      // ВАЖНО: После перехода очищаем фокус со старого поля
      // НЕ ждем исчезновения старого поля - новое может появиться быстро, и мы найдем его по wrapper
      if (oldPeerId) {
        logger.debug('Clearing focus from old input field after navigation', { oldPeerId });
        
        // Явно удаляем фокус со старого поля
        await page.evaluate((oldId) => {
          const oldInput = document.querySelector(`.input-message-input[data-peer-id="${oldId}"]`) as HTMLElement;
          if (oldInput) {
            oldInput.blur();
          }
          // Убеждаемся, что активный элемент не старое поле
          const activeEl = document.activeElement;
          if (activeEl && activeEl instanceof HTMLElement && activeEl.getAttribute('data-peer-id') === oldId) {
            activeEl.blur();
          }
        }, oldPeerId).catch(() => {
          logger.debug('Could not blur old input field after navigation (may already be gone)');
        });
        
        // Небольшая задержка для стабилизации DOM
        await this.delay(300);
      }
      
      await this.delay(300);

      // ВАЖНО: Сначала ждем появления контейнера new-message-wrapper ИЛИ поля ввода
      // Это более надежный индикатор того, что чат загрузился
      logger.debug('Waiting for new-message-wrapper container or input field to appear');
      
      // Ждем появления wrapper ИЛИ поля ввода (более надежно)
      // Используем Promise.race чтобы дождаться любого из них
      let wrapperOrInputAppeared: string | null = null;
      try {
        wrapperOrInputAppeared = await Promise.race([
          page.waitForSelector('.new-message-wrapper', { timeout: 10000, visible: true }).then(() => 'wrapper'),
          page.waitForSelector('.input-message-input[contenteditable="true"]:not(.input-field-input-fake)', { timeout: 10000, visible: true }).then(() => 'input'),
        ]);
      } catch {
        // Если оба не появились, продолжаем
        logger.warn('Neither wrapper nor input field appeared after goto, but continuing');
      }
      
      if (wrapperOrInputAppeared) {
        logger.debug('Wrapper or input field appeared', { type: wrapperOrInputAppeared });
      }
      
      await this.delay(500); // Дополнительная задержка для стабилизации
      
      // Ждём появления НОВОГО поля ввода или ошибки
      const maxWaitTime = 20000; // Увеличено с 15 до 20 секунд
      const checkInterval = 300;
      const startTime = Date.now();
      
      let inputFound = false;
      let errorDetected: string | null = null;
      let newPeerId: string | null = null;

      // КРИТИЧЕСКИ ВАЖНО: Не используем expectedPeerId из кэша для нового контакта
      // expectedPeerId должен быть установлен только после успешного открытия чата
      // и использоваться только для проверки правильности активного элемента
      // Для нового контакта мы ищем поле с peer-id, отличным от oldPeerId
      
      while (Date.now() - startTime < maxWaitTime) {
        // Прямой поиск поля ввода через page.evaluate (более надежно, чем findMessageInput)
        const inputInfo = await page.evaluate((oldId): {
          peerId: string | null;
          isOld: boolean;
          isVisible: boolean;
          hasWrapper: boolean;
          wrapperVisible: boolean;
          isFake: boolean;
          isContentEditable: boolean;
          found: boolean;
          allInputsInfo?: Array<{
            peerId: string | null;
            isFake: boolean;
            isVisible: boolean;
            isContentEditable: boolean;
            hasWrapper: boolean;
          }>;
          debugInfo?: { bestPeerId?: string | null; oldId?: string | null; allInputsCount?: number };
        } => {
          // Ищем все поля ввода
          const allInputs = Array.from(document.querySelectorAll('.input-message-input'));
          const allInputsInfo: Array<{
            peerId: string | null;
            isFake: boolean;
            isVisible: boolean;
            isContentEditable: boolean;
            hasWrapper: boolean;
          }> = [];
          
          let bestInput: HTMLElement | null = null;
          let bestPeerId: string | null = null;
          
          for (const input of allInputs) {
            const htmlInput = input as HTMLElement;
            if (!htmlInput) { continue; }
            
            const isFake = htmlInput.classList.contains('input-field-input-fake');
            const isContentEditable = htmlInput.getAttribute('contenteditable') === 'true';
            const style = window.getComputedStyle(htmlInput);
            const isVisible = htmlInput.offsetParent !== null && 
                             style.display !== 'none' && 
                             style.visibility !== 'hidden';
            const peerId = htmlInput.getAttribute('data-peer-id');
            const wrapper = htmlInput.closest('.new-message-wrapper');
            const hasWrapper = !!wrapper;
            
            allInputsInfo.push({
              peerId,
              isFake,
              isVisible,
              isContentEditable,
              hasWrapper,
            });
            
            // Пропускаем фейковые поля
            if (isFake) { continue; }
            
            // Пропускаем не contenteditable поля
            if (!isContentEditable) { continue; }
            
            // Пропускаем невидимые поля
            if (!isVisible) { continue; }
            
            // КРИТИЧЕСКИ ВАЖНО: Проверяем, что поле принадлежит активному видимому контейнеру
            // Старые поля могут остаться в DOM, но их контейнеры скрыты
            let wrapperVisible = true;
            if (hasWrapper) {
              const wrapperStyle = window.getComputedStyle(wrapper as HTMLElement);
              wrapperVisible = (wrapper as HTMLElement).offsetParent !== null && 
                             wrapperStyle.display !== 'none' && 
                             wrapperStyle.visibility !== 'hidden';
              if (!wrapperVisible) {
                continue; // Пропускаем поля в скрытых контейнерах
              }
            }
            
            // Если это старое поле И оно в скрытом контейнере, пропускаем
            // НО: если поле в видимом контейнере, используем его (даже если peer-id совпадает)
            // Это важно для случая, когда открываем тот же контакт
            if (oldId !== null && oldId !== undefined && peerId === oldId) {
              // Если wrapper видим, это может быть тот же контакт - используем поле
              if (wrapperVisible) {
                // Проверяем, что это действительно активное поле (в фокусе или в активном контейнере)
                const isActive = document.activeElement === htmlInput || 
                               (wrapper && document.activeElement?.closest('.new-message-wrapper') === wrapper);
                if (!isActive) {
                  // Старое поле в видимом контейнере, но не активное - пропускаем
                  continue;
                }
                // Если активно - используем (это может быть тот же контакт)
              } else {
                // Старое поле в скрытом контейнере - пропускаем
                continue;
              }
            }
            
          // Нашли подходящее поле
          if (!bestInput) {
            bestInput = htmlInput;
            bestPeerId = peerId;
          } else {
            // Если уже есть поле, выбираем то, которое находится в активном контейнере
            // Активное поле обычно последнее добавленное в DOM (последнее в массиве)
            // Но также проверяем видимость wrapper
            const currentWrapper = htmlInput.closest('.new-message-wrapper');
            const previousWrapper = bestInput.closest('.new-message-wrapper');
            if (currentWrapper && previousWrapper) {
              const currentWrapperStyle = window.getComputedStyle(currentWrapper as HTMLElement);
              const previousWrapperStyle = window.getComputedStyle(previousWrapper as HTMLElement);
              const currentVisible = (currentWrapper as HTMLElement).offsetParent !== null && 
                                   currentWrapperStyle.display !== 'none' && 
                                   currentWrapperStyle.visibility !== 'hidden';
              const previousVisible = (previousWrapper as HTMLElement).offsetParent !== null && 
                                    previousWrapperStyle.display !== 'none' && 
                                    previousWrapperStyle.visibility !== 'hidden';
              
              // Предпочитаем поле в видимом контейнере, или последнее, если оба видимы
              if (currentVisible && !previousVisible) {
                bestInput = htmlInput;
                bestPeerId = peerId;
              } else if (currentVisible && previousVisible) {
                // Если оба видимы, выбираем последнее (обычно это новое поле)
                bestInput = htmlInput;
                bestPeerId = peerId;
              }
            }
          }
        }
        
        if (!bestInput) {
            return {
              peerId: null,
              isOld: false,
              isVisible: false,
              hasWrapper: false,
              wrapperVisible: false,
              isFake: false,
              isContentEditable: false,
              found: false,
              allInputsInfo,
              debugInfo: { allInputsCount: allInputs.length, oldId: oldId ?? null },
            };
        }
        
        // Проверяем видимость и wrapper для найденного поля
        if (!bestInput) {
          return {
            peerId: null,
            isOld: false,
            isVisible: false,
            hasWrapper: false,
            wrapperVisible: false,
            isFake: false,
            isContentEditable: false,
            found: false,
            allInputsInfo,
            debugInfo: { allInputsCount: allInputs.length, oldId: oldId ?? null },
          };
        }
        
        const style = window.getComputedStyle(bestInput);
        const isVisible = bestInput.offsetParent !== null && 
                         style.display !== 'none' && 
                         style.visibility !== 'hidden';
        
        const wrapper = bestInput.closest('.new-message-wrapper');
        const hasWrapper = !!wrapper;
          let wrapperVisible = false;
          
          if (wrapper) {
            const wrapperStyle = window.getComputedStyle(wrapper as HTMLElement);
            wrapperVisible = (wrapper as HTMLElement).offsetParent !== null && 
                            wrapperStyle.display !== 'none' && 
                            wrapperStyle.visibility !== 'hidden';
          }
          
          const isOld = oldId !== null && oldId !== undefined && bestPeerId === oldId;
          
          return {
            peerId: bestPeerId,
            isOld,
            isVisible,
            hasWrapper,
            wrapperVisible,
            isFake: bestInput.classList.contains('input-field-input-fake'),
            isContentEditable: bestInput.getAttribute('contenteditable') === 'true',
            found: true,
            allInputsInfo,
            debugInfo: { bestPeerId, oldId: oldId ?? null, allInputsCount: allInputs.length },
          };
        }, oldPeerId ?? null).catch(() => ({ 
          peerId: null, 
          isOld: false, 
          isVisible: false,
          hasWrapper: false,
          wrapperVisible: false,
          isFake: false,
          isContentEditable: false,
          found: false,
          debugInfo: undefined,
        }));
        
        const elapsed = Date.now() - startTime;
        logger.debug('Input field check result', { 
          inputInfo, 
          oldPeerId, 
          elapsed
        });
        
        // Логируем прогресс поиска
        if (elapsed % 3000 < checkInterval) {
          logger.debug('Still searching for message input field', { 
            elapsed,
            oldPeerId,
            maxWaitTime 
          });
        }

        // Проверяем ошибки (но не каждую итерацию для экономии времени)
        // ВАЖНО: Проверяем Premium только если поле ввода не найдено
        // КРИТИЧЕСКИ ВАЖНО: Проверяем USER_NOT_FOUND раньше и чаще
        // Проверяем каждый раз через 1.5 секунды (не только после 3 секунд)
        if (elapsed > 1000 && elapsed % 1500 < checkInterval) {
          // Быстрая проверка на USER_NOT_FOUND
          const hasUserNotFound = await this.quickCheckUserNotFound(page);
          if (hasUserNotFound) {
            errorDetected = 'USER_NOT_FOUND';
            logger.warn('User not found error detected in waiting loop', { 
              phone: normalizedPhone, 
              profileId,
              elapsed
            });
            break;
          }
          
          // Проверка Premium только если поле ввода еще не найдено
          // Если поле найдено, значит чат открыт и Premium ограничения нет
          if (!inputFound) {
            const hasPremiumRestriction = await this.checkPremiumRestriction(page);
            if (hasPremiumRestriction) {
              errorDetected = 'PREMIUM_RESTRICTION';
              break;
            }
          }
        }
        
        // Если поле не найдено, продолжаем поиск
        if (!inputInfo.found) {
          // Логируем детальную информацию о всех найденных полях
          const allInputsInfo = 'allInputsInfo' in inputInfo ? inputInfo.allInputsInfo : undefined;
          if (allInputsInfo && Array.isArray(allInputsInfo) && allInputsInfo.length > 0) {
            logger.debug('Input fields found but none are valid', { 
              allInputsInfo,
              elapsed
            });
          }
          await this.delay(checkInterval);
          continue;
        }
        
        // ВАЖНО: Если прошло достаточно времени (более 5 секунд) и есть видимое поле,
        // используем его даже если peer-id совпадает (возможно, это тот же контакт)
        const shouldUseExistingField = elapsed > 5000 && inputInfo.isVisible && inputInfo.wrapperVisible;
        
        // Если есть старое поле, проверяем что peer-id изменился
        // НО: если прошло много времени и поле видимо, используем его
        if (inputInfo.isOld && !shouldUseExistingField) {
          logger.debug('Found old input field, waiting for new one', { 
            peerId: inputInfo.peerId,
            elapsed,
            willUseAfterTimeout: true
          });
          await this.delay(checkInterval);
          continue; // Продолжаем искать новое поле
        }
        
        // Проверяем, что поле видимо
        if (!inputInfo.isVisible) {
          logger.debug('Input field found but not visible', { 
            isVisible: inputInfo.isVisible,
            wrapperVisible: inputInfo.wrapperVisible,
            elapsed 
          });
          await this.delay(checkInterval);
          continue;
        }
        
        // Это новое поле ввода (или существующее, если прошло достаточно времени)
        newPeerId = inputInfo.peerId;
        inputFound = true;
        logger.debug('Found message input field', { 
          newPeerId, 
          oldPeerId,
          isOld: inputInfo.isOld,
          elapsed,
          reusedExisting: inputInfo.isOld && shouldUseExistingField
        });
        break;
      }

      // Если нашли ошибку
      if (errorDetected === 'USER_NOT_FOUND') {
        if (profileId) {
          this.currentOpenChat.delete(profileId);
          this.expectedPeerId.delete(profileId);
        }
        throw new Error('USER_NOT_FOUND: Sorry, this user doesn\'t seem to exist');
      }
      
      if (errorDetected === 'PREMIUM_RESTRICTION') {
        if (profileId) {
          this.currentOpenChat.delete(profileId);
          this.expectedPeerId.delete(profileId);
        }
        throw new Error('PREMIUM_RESTRICTION: Only Premium users can message this user');
      }

      // Если не нашли поле ввода
      if (!inputFound) {
        // Диагностика: что есть на странице
        const diagnosticInfo = await page.evaluate(() => {
          const wrappers = Array.from(document.querySelectorAll('.new-message-wrapper'));
          const inputs = Array.from(document.querySelectorAll('.input-message-input'));
          const containers = Array.from(document.querySelectorAll('.input-message-container'));
          
          return {
            wrappersCount: wrappers.length,
            inputsCount: inputs.length,
            containersCount: containers.length,
            visibleWrappers: wrappers.filter(w => {
              const htmlW = w as HTMLElement;
              const style = window.getComputedStyle(htmlW);
              return htmlW.offsetParent !== null && 
                     style.display !== 'none' && 
                     style.visibility !== 'hidden';
            }).length,
            visibleInputs: inputs.filter(i => {
              const htmlI = i as HTMLElement;
              if (htmlI.classList.contains('input-field-input-fake')) { return false; }
              const style = window.getComputedStyle(htmlI);
              return htmlI.offsetParent !== null && 
                     style.display !== 'none' && 
                     style.visibility !== 'hidden';
            }).length,
            url: window.location.href,
          };
        }).catch(() => null);
        
        logger.warn('Message input not found - diagnostic info', { 
          diagnosticInfo,
          oldPeerId,
          elapsed: Date.now() - startTime,
          maxWaitTime 
        });
        
        // Финальная проверка на ошибки (только если поле не найдено)
        // ВАЖНО: Используем quickCheckUserNotFound для более быстрой проверки
        // Проверяем дважды для надежности
        const userNotFound = await this.quickCheckUserNotFound(page) || await this.checkUserNotFound(page);
        if (userNotFound) {
          logger.warn('User not found error detected in final check', { phone: normalizedPhone, profileId });
          if (profileId) {
            this.currentOpenChat.delete(profileId);
            this.expectedPeerId.delete(profileId);
          }
          throw new Error('USER_NOT_FOUND: Sorry, this user doesn\'t seem to exist');
        }

        // Проверка Premium только если поле ввода не найдено
        // Если поле ввода найдено, значит чат открыт успешно и Premium ограничения нет
        const hasPremiumRestriction = await this.checkPremiumRestriction(page);
        if (hasPremiumRestriction) {
          if (profileId) {
            this.currentOpenChat.delete(profileId);
            this.expectedPeerId.delete(profileId);
          }
          throw new Error('PREMIUM_RESTRICTION: Only Premium users can message this user');
        }

        if (profileId) {
          this.currentOpenChat.delete(profileId);
          this.expectedPeerId.delete(profileId);
        }
        throw new Error(
          `Failed to open chat: message input not found after ${maxWaitTime}ms. ` +
          `Diagnostic: ${JSON.stringify(diagnosticInfo)}. ` +
          `Old peer-id: ${oldPeerId ?? 'none'}`
        );
      }
      
      // ВАЖНО: Если поле ввода найдено, НЕ проверяем Premium - это может быть ложное срабатывание
      // Наличие поля ввода означает, что чат открыт и можно отправлять сообщения

      // Дополнительная проверка: убеждаемся, что поле ввода действительно найдено и видимо
      // И что это НОВОЕ поле (не старое)
      // Используем прямой поиск через page.evaluate для надежности
      const inputFieldHandle = await page.evaluateHandle((targetPeerId, oldId) => {
        const allInputs = Array.from(document.querySelectorAll('.input-message-input'));
        
        for (const input of allInputs) {
          const htmlInput = input as HTMLElement;
          if (!htmlInput) { continue; }
          
          // Пропускаем фейковые поля
          if (htmlInput.classList.contains('input-field-input-fake')) { continue; }
          
          // Пропускаем не contenteditable поля
          if (htmlInput.getAttribute('contenteditable') !== 'true') { continue; }
          
          // Проверяем видимость
          const style = window.getComputedStyle(htmlInput);
          if (htmlInput.offsetParent === null || 
              style.display === 'none' || 
              style.visibility === 'hidden') { continue; }
          
          const peerId = htmlInput.getAttribute('data-peer-id');
          
          // Если указан targetPeerId, ищем по нему
          if (targetPeerId && peerId !== targetPeerId) { continue; }
          
          // Пропускаем старое поле ТОЛЬКО если оно в скрытом контейнере
          if (oldId && peerId === oldId) {
            // Проверяем, что это действительно старое поле (в скрытом контейнере)
            const wrapper = htmlInput.closest('.new-message-wrapper');
            if (wrapper) {
              const wrapperStyle = window.getComputedStyle(wrapper as HTMLElement);
              const wrapperVisible = (wrapper as HTMLElement).offsetParent !== null && 
                                   wrapperStyle.display !== 'none' && 
                                   wrapperStyle.visibility !== 'hidden';
              // Если wrapper видим, это может быть тот же контакт - используем поле
              if (wrapperVisible) {
                // Проверяем активность
                const isActive = document.activeElement === htmlInput || 
                               document.activeElement?.closest('.new-message-wrapper') === wrapper;
                if (isActive) {
                  // Активное поле - используем его (возможно, тот же контакт)
                  return htmlInput;
                }
              }
            }
            // Старое поле в скрытом контейнере или неактивное - пропускаем
            continue;
          }
          
          return htmlInput;
        }
        
        return null;
      }, newPeerId, oldPeerId ?? null);
      
      const inputField = inputFieldHandle.asElement() as import('puppeteer').ElementHandle<Element> | null;
      
      if (!inputField) {
        if (profileId) {
          this.currentOpenChat.delete(profileId);
          this.expectedPeerId.delete(profileId);
        }
        throw new Error(`Message input field not found after opening chat for phone ${normalizedPhone}`);
      }

      // Финальная проверка: убеждаемся, что это не старое поле
      // НО: если открываем тот же контакт, peer-id может совпадать - это нормально
      const finalPeerId = await page.evaluate((el) => {
        const htmlEl = el as HTMLElement;
        return htmlEl?.getAttribute('data-peer-id');
      }, inputField).catch(() => null);
      
      // Проверяем, что это не старое поле только если открываем ДРУГОЙ контакт
      const isSameContact = cachedPhone === normalizedPhone;
      if (oldPeerId && finalPeerId === oldPeerId && !isSameContact) {
        // Дополнительная проверка: убеждаемся, что старое поле действительно неактивно
        const isOldFieldActive = await page.evaluate((oldId) => {
          const oldInput = document.querySelector(`.input-message-input[data-peer-id="${oldId}"]`) as HTMLElement;
          if (!oldInput) { return false; }
          const wrapper = oldInput.closest('.new-message-wrapper');
          if (!wrapper) { return true; } // Если нет wrapper, считаем неактивным
          const wrapperStyle = window.getComputedStyle(wrapper as HTMLElement);
          return (wrapper as HTMLElement).offsetParent !== null && 
                 wrapperStyle.display !== 'none' && 
                 wrapperStyle.visibility !== 'hidden';
        }, oldPeerId).catch(() => false);
        
        if (isOldFieldActive) {
          if (profileId) {
            this.currentOpenChat.delete(profileId);
            this.expectedPeerId.delete(profileId);
          }
          throw new Error(`Found old input field after opening new chat. Old peer-id: ${oldPeerId}, new phone: ${normalizedPhone}`);
        } else {
          // Старое поле неактивно, новое поле с тем же peer-id - возможно, это тот же контакт
          logger.debug('Peer-id matches but old field is inactive, using new field', { 
            peerId: finalPeerId, 
            phone: normalizedPhone 
          });
        }
      }

      logger.debug('New chat input field verified', { 
        newPeerId: finalPeerId, 
        oldPeerId, 
        phone: normalizedPhone 
      });
      
      // Сохраняем ожидаемый peer-id для проверки при отправке сообщения
      if (profileId && finalPeerId) {
        this.expectedPeerId.set(profileId, finalPeerId);
      }

      // Небольшая задержка для стабилизации и полной загрузки чата
      await this.delay(500);
      
      // Убеждаемся, что страница активна
      await page.bringToFront();
      await this.delay(200);

      // ВАЖНО: После открытия чата всегда ищем поле ввода, кликаем на него и активируем
      // Это гарантирует, что поле готово к вводу текста
      logger.debug('Activating message input field after opening chat');
      const activationField = await this.findMessageInput(page);
      if (activationField) {
        // Активируем поле ввода через JavaScript (более надежно)
        await page.evaluate((el) => {
          const htmlEl = el as HTMLElement;
          if (!htmlEl) { return false; }
          
          // Прокручиваем в видимую область
          htmlEl.scrollIntoView({ block: 'center', behavior: 'instant' });
          
          // Фокусируемся на элементе
          htmlEl.focus();
          
          // Кликаем для активации
          const clickEvent = new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
            view: window,
          });
          htmlEl.dispatchEvent(clickEvent);
          
          // Также вызываем обычный click
          htmlEl.click();
          
          // Для contenteditable полей может потребоваться активация через события
          const focusEvent = new FocusEvent('focus', {
            bubbles: true,
            cancelable: true,
            view: window,
          });
          htmlEl.dispatchEvent(focusEvent);
          
          return true;
        }, activationField);
        
        await this.delay(300);
        
        // Дополнительно кликаем через Puppeteer для надежности
        await activationField.click().catch(() => {
          logger.warn('Puppeteer click failed, but JavaScript activation should work');
        });
        await this.delay(200);
        
        // Фокусируемся на поле ввода
        await activationField.focus().catch(() => {
          logger.warn('Puppeteer focus failed, but JavaScript activation should work');
        });
        await this.delay(200);
        
        // Проверяем, что поле активно
        let isFocused = await page.evaluate((el) => {
          return document.activeElement === el;
        }, activationField).catch(() => false);
        
        if (!isFocused) {
          logger.warn('Input field may not be focused after activation, retrying');
          // Повторная попытка установки фокуса
          await activationField.focus().catch(() => {
            logger.warn('Puppeteer focus retry failed');
          });
          await this.delay(200);
          
          // Повторная проверка фокуса
          isFocused = await page.evaluate((el) => {
            return document.activeElement === el;
          }, activationField).catch(() => false);
          
          if (!isFocused) {
            logger.warn('Input field still not focused after retry, but continuing');
          } else {
            logger.debug('Input field focused after retry');
          }
        }
        
        logger.debug('Message input field activated', { peerId: finalPeerId, isFocused });
      } else {
        logger.warn('Could not activate input field after opening chat, but continuing');
      }

      // Сохраняем в кэш ТОЛЬКО после успешной проверки
      if (profileId) {
        this.currentOpenChat.set(profileId, normalizedPhone);
        // Ожидаемый peer-id уже сохранен выше
      }

      logger.debug('Telegram chat opened successfully', { phone: normalizedPhone, profileId });
    } catch (error) {
      // Сбрасываем кэш при любой ошибке
      if (profileId) {
        this.currentOpenChat.delete(profileId);
        this.expectedPeerId.delete(profileId);
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
   * Улучшенная версия: проверяет также модальные окна и основной контент страницы
   */
  private async quickCheckUserNotFound(page: Page): Promise<boolean> {
    try {
      return await page.evaluate((errorTexts) => {
        // 1. Проверяем toast-уведомления и нотификации (самый быстрый способ)
        const notifications = document.querySelectorAll('[class*="toast"], [class*="notification"], [role="alert"]');
        for (const notification of Array.from(notifications)) {
          const htmlNotification = notification as HTMLElement;
          if (!htmlNotification) { continue; }
          
          // Проверяем видимость уведомления
          const style = window.getComputedStyle(htmlNotification);
          const isVisible = htmlNotification.offsetParent !== null && 
                           style.display !== 'none' && 
                           style.visibility !== 'hidden' &&
                           style.opacity !== '0';
          
          if (!isVisible) { continue; }
          
          const text = (htmlNotification.textContent || '').toLowerCase();
          for (const errorText of errorTexts) {
            if (text.includes(errorText.toLowerCase())) {
              return true;
            }
          }
        }
        
        // 2. Проверяем модальные окна и диалоги
        const dialogs = document.querySelectorAll('[role="dialog"], .popup, .modal');
        for (const dialog of Array.from(dialogs)) {
          const htmlDialog = dialog as HTMLElement;
          if (!htmlDialog) { continue; }
          
          // Проверяем видимость диалога
          const style = window.getComputedStyle(htmlDialog);
          const isVisible = htmlDialog.offsetParent !== null && 
                           style.display !== 'none' && 
                           style.visibility !== 'hidden';
          
          if (!isVisible) { continue; }
          
          const text = (htmlDialog.textContent || '').toLowerCase();
          for (const errorText of errorTexts) {
            if (text.includes(errorText.toLowerCase())) {
              return true;
            }
          }
        }
        
        // 3. Проверяем основной контент страницы (на случай если ошибка отображается прямо на странице)
        // Ищем большие текстовые блоки с ошибкой
        const bodyText = document.body.textContent?.toLowerCase() || '';
        for (const errorText of errorTexts) {
          if (bodyText.includes(errorText.toLowerCase())) {
            // Дополнительная проверка: ошибка должна быть в видимом элементе
            const errorElements = Array.from(document.querySelectorAll('*')).filter(el => {
              const htmlEl = el as HTMLElement;
              if (!htmlEl) { return false; }
              const style = window.getComputedStyle(htmlEl);
              const isVisible = htmlEl.offsetParent !== null && 
                               style.display !== 'none' && 
                               style.visibility !== 'hidden';
              if (!isVisible) { return false; }
              const text = (htmlEl.textContent || '').toLowerCase();
              return text.includes(errorText.toLowerCase());
            });
            if (errorElements.length > 0) {
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
   * Поиск поля ввода сообщения по списку селекторов
   * Исключает фейковое поле (input-field-input-fake)
   * @param expectedPeerId - если указан, предпочитает поле с этим peer-id (для правильного выбора в мульти-чате)
   */
  private async findMessageInput(page: Page, expectedPeerId?: string): Promise<import('puppeteer').ElementHandle<Element> | null> {
    // Сначала пробуем найти поле с нужным peer-id (если указан)
    if (expectedPeerId) {
      const elementWithExpectedPeerId = await page.evaluateHandle((targetPeerId) => {
        const inputs = Array.from(document.querySelectorAll('.input-message-input'));
        for (const input of inputs) {
          const htmlInput = input as HTMLElement;
          if (htmlInput.classList.contains('input-field-input-fake')) { continue; }
          if (htmlInput.getAttribute('contenteditable') !== 'true') { continue; }
          const style = window.getComputedStyle(htmlInput);
          if (htmlInput.offsetParent === null || 
              style.display === 'none' || 
              style.visibility === 'hidden') { continue; }
          
          // Ищем поле с нужным peer-id
          if (htmlInput.getAttribute('data-peer-id') === targetPeerId) {
            return htmlInput;
          }
        }
        return null;
      }, expectedPeerId);
      
      const elementHandle = elementWithExpectedPeerId.asElement() as import('puppeteer').ElementHandle<Element> | null;
      if (elementHandle) {
        logger.debug('Found message input field with expected peer-id', { expectedPeerId });
        return elementHandle;
      } else {
        logger.debug('Field with expected peer-id not found, searching all fields', { expectedPeerId });
      }
    }
    
    // Если не нашли с нужным peer-id или peer-id не указан, ищем по селекторам
    for (const selector of TELEGRAM_SELECTORS.MESSAGE_INPUT) {
      try {
        const element = await page.$(selector);
        if (element) {
          // Проверяем, что это не фейковое поле и оно видимо
          const validationResult = await page.evaluate((el, targetPeerId): {
            valid: boolean;
            reason?: string;
            hasPeerId?: boolean;
            peerId?: string | null;
          } => {
            const htmlEl = el as HTMLElement;
            if (!htmlEl) { 
              return { valid: false, reason: 'element is null' };
            }
            
            // Проверяем видимость
            const style = window.getComputedStyle(htmlEl);
            const isVisible = htmlEl.offsetParent !== null && 
                             style.display !== 'none' && 
                             style.visibility !== 'hidden';
            
            if (!isVisible) { 
              return { valid: false, reason: 'element is not visible' };
            }
            
            // Проверяем, что это НЕ фейковое поле
            const isFake = htmlEl.classList.contains('input-field-input-fake');
            if (isFake) { 
              return { valid: false, reason: 'element is fake input' };
            }
            
            // Проверяем, что это contenteditable поле (реальное поле ввода)
            const isContentEditable = htmlEl.getAttribute('contenteditable') === 'true';
            if (!isContentEditable) { 
              return { valid: false, reason: 'element is not contenteditable' };
            }
            
            // Если указан targetPeerId, предпочитаем поле с этим peer-id
            const peerId = htmlEl.getAttribute('data-peer-id');
            if (targetPeerId && peerId !== targetPeerId) {
              return { valid: false, reason: `peer-id mismatch: expected ${targetPeerId}, got ${peerId}` };
            }
            
            // Проверяем наличие data-peer-id (опционально, но желательно)
            const hasPeerId = htmlEl.hasAttribute('data-peer-id');
            
            return { 
              valid: true, 
              hasPeerId,
              peerId,
            };
          }, element, expectedPeerId ?? null).catch((err): { valid: false; reason: string } => ({ 
            valid: false, 
            reason: `evaluate error: ${err instanceof Error ? err.message : 'unknown'}` 
          }));
          
          if (validationResult.valid) {
            logger.debug('Found message input field', { 
              selector, 
              hasPeerId: validationResult.hasPeerId ?? false,
              peerId: validationResult.peerId ?? null,
              expectedPeerId,
            });
            return element;
          } else {
            logger.debug('Input field found but validation failed', { 
              selector, 
              reason: validationResult.reason ?? 'unknown',
              expectedPeerId,
            });
          }
        }
      } catch (err) {
        logger.debug('Error checking selector', { 
          selector, 
          error: err instanceof Error ? err.message : 'unknown' 
        });
        continue;
      }
    }
    
    // Fallback: поиск через evaluate (более надежный и с детальным логированием)
    logger.debug('Trying advanced search for message input field', { expectedPeerId });
    const searchResult = await page.evaluate((targetPeerId) => {
      const results: Array<{
        element: HTMLElement;
        reason: string;
        peerId: string | null;
        isFake: boolean;
        isVisible: boolean;
        isContentEditable: boolean;
        hasWrapper: boolean;
      }> = [];
      
      // Сначала ищем контейнер new-message-wrapper
      const wrappers = Array.from(document.querySelectorAll('.new-message-wrapper'));
      
      // Ищем активный wrapper (видимый)
      const activeWrappers: Element[] = [];
      for (const wrapper of wrappers) {
        const htmlWrapper = wrapper as HTMLElement;
        const style = window.getComputedStyle(htmlWrapper);
        if (htmlWrapper.offsetParent !== null && 
            style.display !== 'none' && 
            style.visibility !== 'hidden') {
          activeWrappers.push(wrapper);
        }
      }
      
      // Если нашли активные wrappers, ищем поле ввода внутри них
      for (const activeWrapper of activeWrappers) {
        const inputs = activeWrapper.querySelectorAll('.input-message-input');
        for (const input of Array.from(inputs)) {
          const htmlInput = input as HTMLElement;
          if (!htmlInput) { continue; }
          
          const isFake = htmlInput.classList.contains('input-field-input-fake');
          const isContentEditable = htmlInput.getAttribute('contenteditable') === 'true';
          const style = window.getComputedStyle(htmlInput);
          const isVisible = htmlInput.offsetParent !== null && 
                           style.display !== 'none' && 
                           style.visibility !== 'hidden';
          const peerId = htmlInput.getAttribute('data-peer-id');
          
          results.push({
            element: htmlInput,
            reason: isFake ? 'fake' : !isContentEditable ? 'not contenteditable' : !isVisible ? 'not visible' : 'valid',
            peerId,
            isFake,
            isVisible,
            isContentEditable,
            hasWrapper: true,
          });
        }
      }
      
      // Если не нашли через wrapper, ищем напрямую все поля ввода
      const allInputs = Array.from(document.querySelectorAll('.input-message-input'));
      
      for (const input of allInputs) {
        const htmlInput = input as HTMLElement;
        if (!htmlInput) { continue; }
        
        const isFake = htmlInput.classList.contains('input-field-input-fake');
        const isContentEditable = htmlInput.getAttribute('contenteditable') === 'true';
        const style = window.getComputedStyle(htmlInput);
        const isVisible = htmlInput.offsetParent !== null && 
                         style.display !== 'none' && 
                         style.visibility !== 'hidden';
        const peerId = htmlInput.getAttribute('data-peer-id');
        const wrapper = htmlInput.closest('.new-message-wrapper');
        
        // Пропускаем если уже есть в results
        if (results.some(r => r.element === htmlInput)) {
          continue;
        }
        
        results.push({
          element: htmlInput,
          reason: isFake ? 'fake' : !isContentEditable ? 'not contenteditable' : !isVisible ? 'not visible' : wrapper ? 'valid (no wrapper check)' : 'valid (no wrapper)',
          peerId,
          isFake,
          isVisible,
          isContentEditable,
          hasWrapper: !!wrapper,
        });
      }
      
      // Ищем валидное поле (не фейковое, contenteditable, видимое)
      // Если указан targetPeerId, предпочитаем поле с этим peer-id
      let validResult: typeof results[0] | null = null;
      
      // Сначала ищем с нужным peer-id
      if (targetPeerId) {
        validResult = results.find(r => 
          !r.isFake && r.isContentEditable && r.isVisible && r.peerId === targetPeerId
        ) ?? null;
      }
      
      // Если не нашли с нужным peer-id, берем первое подходящее
      if (!validResult) {
        validResult = results.find(r => 
          !r.isFake && r.isContentEditable && r.isVisible
        ) ?? null;
      }
      
      if (validResult) {
        return {
          element: validResult.element,
          allResults: results.map(r => ({
            reason: r.reason,
            peerId: r.peerId,
            isFake: r.isFake,
            isVisible: r.isVisible,
            isContentEditable: r.isContentEditable,
            hasWrapper: r.hasWrapper,
          })),
        };
      }
      
      return {
        element: null,
        allResults: results.map(r => ({
          reason: r.reason,
          peerId: r.peerId,
          isFake: r.isFake,
          isVisible: r.isVisible,
          isContentEditable: r.isContentEditable,
          hasWrapper: r.hasWrapper,
        })),
      };
    }, expectedPeerId ?? null);
    
    if (searchResult.element) {
      logger.debug('Found message input field via advanced search', { 
        allResults: searchResult.allResults 
      });
      
      // Конвертируем найденный элемент в ElementHandle через поиск по характеристикам
      // Если указан expectedPeerId, предпочитаем поле с этим peer-id
      let validResult = searchResult.allResults.find(r => 
        !r.isFake && r.isContentEditable && r.isVisible && 
        (expectedPeerId ? r.peerId === expectedPeerId : true)
      );
      
      // Если не нашли с нужным peer-id, берем первое подходящее
      if (!validResult) {
        validResult = searchResult.allResults.find(r => 
          !r.isFake && r.isContentEditable && r.isVisible
        );
      }
      
      if (validResult) {
        const foundElement = await page.evaluateHandle((targetPeerId) => {
          const inputs = Array.from(document.querySelectorAll('.input-message-input'));
          for (const input of inputs) {
            const htmlInput = input as HTMLElement;
            if (htmlInput.classList.contains('input-field-input-fake')) { continue; }
            if (htmlInput.getAttribute('contenteditable') !== 'true') { continue; }
            const style = window.getComputedStyle(htmlInput);
            if (htmlInput.offsetParent === null || 
                style.display === 'none' || 
                style.visibility === 'hidden') { continue; }
            
            // Если указан peer-id, ищем по нему, иначе берем первое подходящее
            if (targetPeerId) {
              if (htmlInput.getAttribute('data-peer-id') === targetPeerId) {
                return htmlInput;
              }
            } else {
              return htmlInput;
            }
          }
          return null;
        }, validResult.peerId ?? null);
        
        const elementHandle = foundElement.asElement() as import('puppeteer').ElementHandle<Element> | null;
        if (elementHandle) {
          logger.debug('Message input field converted to ElementHandle via advanced search', {
            peerId: validResult.peerId,
            expectedPeerId,
          });
          return elementHandle;
        }
      } else {
        logger.warn('Advanced search found no valid input field', { 
          allResults: searchResult.allResults,
          expectedPeerId,
        });
      }
    }
    
    return null;
  }

  /**
   * Отправка текстового сообщения
   * Улучшенная версия с проверкой правильности чата и поиском поля ввода
   */
  private async sendTextMessage(page: Page, text: string, expectedPhone?: string, profileId?: string): Promise<void> {
    try {
      // Убеждаемся, что страница активна
      await page.bringToFront();
      await this.delay(200);

      // ВАЖНО: Всегда ищем поле ввода ЗАНОВО перед отправкой, чтобы убедиться что это актуальное поле
      // Не используем кэшированное поле, так как оно может быть из старого чата
      logger.debug('Searching for message input field before sending', { expectedPhone });
      
      // Ждем небольшую задержку, чтобы убедиться что DOM обновился
      await this.delay(200);
      
      // Ищем поле ввода сообщения по списку селекторов
      // ВАЖНО: Передаем expectedPeerId, чтобы найти правильное поле (не старое)
      const expectedPeerIdForSearch = profileId ? this.expectedPeerId.get(profileId) ?? null : null;
      let inputElement = await this.findMessageInput(page, expectedPeerIdForSearch ?? undefined);
      
      if (!inputElement) {
        throw new Error('Message input field not found');
      }

      // ВАЖНО: Проверяем, что это актуальное поле ввода (не старое)
      // Получаем peer-id найденного поля
      // ВАЖНО: ElementHandle может стать недействительным, если DOM изменился
      // Используем try-catch для обработки ошибок
      let currentPeerId: string | null = null;
      try {
        currentPeerId = await page.evaluate((el) => {
          const htmlEl = el as HTMLElement;
          return htmlEl?.getAttribute('data-peer-id');
        }, inputElement);
      } catch (error) {
        // ElementHandle стал недействительным - ищем поле заново
        logger.warn('ElementHandle became invalid, searching for input field again', { 
          error: error instanceof Error ? error.message : 'unknown',
          expectedPhone 
        });
        
        // Ищем поле ввода заново
        const newInputElement = await this.findMessageInput(page);
        if (!newInputElement) {
          throw new Error('Message input field not found after ElementHandle became invalid');
        }
        
        // Обновляем ссылку на элемент
        inputElement = newInputElement;
        
        // Повторно получаем peer-id
        currentPeerId = await page.evaluate((el) => {
          const htmlEl = el as HTMLElement;
          return htmlEl?.getAttribute('data-peer-id');
        }, inputElement).catch(() => null);
      }
      
      logger.debug('Message input field found', { 
        expectedPhone, 
        currentPeerId,
        hasPeerId: !!currentPeerId,
      });
      
      // Дополнительная проверка: убеждаемся, что поле ввода действительно активно
      // Проверяем, что это поле в контейнере new-message-wrapper (актуальный чат)
      const isInActiveWrapper = await page.evaluate((el) => {
        const htmlEl = el as HTMLElement;
        if (!htmlEl) { return false; }
        
        const wrapper = htmlEl.closest('.new-message-wrapper');
        if (!wrapper) { return false; }
        
        // Проверяем, что wrapper видим
        const wrapperStyle = window.getComputedStyle(wrapper as HTMLElement);
        return (wrapper as HTMLElement).offsetParent !== null && 
               wrapperStyle.display !== 'none' && 
               wrapperStyle.visibility !== 'hidden';
      }, inputElement).catch(() => false);
      
      if (!isInActiveWrapper) {
        logger.warn('Input field not in active wrapper, but continuing');
      }

      // Кликаем на поле ввода для активации (улучшенная версия)
      logger.debug('Clicking on message input field to activate it');
      
      // Активируем поле ввода через JavaScript (более надежно для contenteditable)
      await page.evaluate((el) => {
        const htmlEl = el as HTMLElement;
        if (!htmlEl) { return false; }
        
        // Прокручиваем в видимую область
        htmlEl.scrollIntoView({ block: 'center', behavior: 'instant' });
        
        // Фокусируемся на элементе
        htmlEl.focus();
        
        // Кликаем для активации
        const clickEvent = new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
          view: window,
        });
        htmlEl.dispatchEvent(clickEvent);
        
        // Также вызываем обычный click
        htmlEl.click();
        
        // Для contenteditable полей может потребоваться активация через события
        const focusEvent = new FocusEvent('focus', {
          bubbles: true,
          cancelable: true,
          view: window,
        });
        htmlEl.dispatchEvent(focusEvent);
        
        return true;
      }, inputElement);
      
      await this.delay(200);
      
      // Дополнительно кликаем через Puppeteer для надежности
      await inputElement.click().catch(() => {
        logger.warn('Puppeteer click failed, but JavaScript activation should work');
      });
      await this.delay(100);
      
      // Фокусируемся на поле ввода
      await inputElement.focus().catch(() => {
        logger.warn('Puppeteer focus failed, but JavaScript activation should work');
      });
      await this.delay(100);
      
      // Проверяем, что поле активно
      let isFocused = await page.evaluate((el) => {
        return document.activeElement === el;
      }, inputElement).catch(() => false);
      
      if (!isFocused) {
        logger.warn('Input field may not be focused after activation, retrying focus');
        // Повторная попытка установки фокуса
        await inputElement.focus().catch(() => {
          logger.warn('Puppeteer focus retry failed');
        });
        await this.delay(200);
        
        // Повторная проверка фокуса
        isFocused = await page.evaluate((el) => {
          return document.activeElement === el;
        }, inputElement).catch(() => false);
        
        if (!isFocused) {
          logger.warn('Input field still not focused after retry, but continuing');
        }
      }
      
      // ВАЖНО: Проверяем активный элемент и peer-id перед вводом текста
      const expectedPeerId = profileId ? this.expectedPeerId.get(profileId) : null;
      if (expectedPeerId) {
        const activeElementCheck = await page.evaluate((expectedId) => {
          const activeEl = document.activeElement as HTMLElement;
          if (!activeEl) { 
            return { valid: false, reason: 'no active element' }; 
          }
          
          const activePeerId = activeEl.getAttribute('data-peer-id');
          if (activePeerId !== expectedId) {
            return { 
              valid: false, 
              reason: 'wrong peer-id', 
              activePeerId, 
              expectedPeerId: expectedId 
            };
          }
          
          return { valid: true };
        }, expectedPeerId);
        
        if (!activeElementCheck.valid) {
          logger.error('Active element check failed before typing', {
            reason: activeElementCheck.reason,
            activePeerId: 'activePeerId' in activeElementCheck ? activeElementCheck.activePeerId : null,
            expectedPeerId,
          });
          
          // Принудительно устанавливаем фокус на правильное поле
          await inputElement.focus();
          await this.delay(200);
          
          // Повторная проверка
          const isFocusedAfterFix = await page.evaluate((el, expectedId) => {
            const activeEl = document.activeElement as HTMLElement;
            if (activeEl !== el) { return false; }
            const activePeerId = activeEl.getAttribute('data-peer-id');
            return activePeerId === expectedId;
          }, inputElement, expectedPeerId).catch(() => false);
          
          if (!isFocusedAfterFix) {
            throw new Error(
              `Cannot focus on correct input field. ${activeElementCheck.reason}. ` +
              `Active peer-id: ${'activePeerId' in activeElementCheck ? activeElementCheck.activePeerId : 'unknown'}, ` +
              `Expected peer-id: ${expectedPeerId}`
            );
          }
          
          logger.debug('Successfully fixed focus on correct input field');
        }
      }
      
      // Дополнительная проверка: убеждаемся, что peer-id найденного поля совпадает с ожидаемым
      if (expectedPeerId && currentPeerId !== expectedPeerId) {
        throw new Error(
          `Input field peer-id mismatch. Expected: ${expectedPeerId}, Found: ${currentPeerId}. ` +
          `This may indicate that messages are being sent to the wrong chat.`
        );
      }

      // Очищаем поле ввода более тщательно
      // Используем Ctrl+A для выделения всего текста
      await page.keyboard.down('Control');
      await page.keyboard.press('a');
      await page.keyboard.up('Control');
      await this.delay(50);
      
      // Удаляем выделенный текст
      await page.keyboard.press('Backspace');
      await this.delay(100);
      
      // Дополнительная проверка: убеждаемся, что поле пустое
      const isFieldEmpty = await page.evaluate((el) => {
        const htmlEl = el as HTMLElement;
        if (!htmlEl) { return false; }
        return (htmlEl.textContent ?? '').trim() === '';
      }, inputElement).catch(() => true);
      
      if (!isFieldEmpty) {
        // Поле не пустое - пробуем еще раз очистить
        logger.warn('Input field not empty after clearing, retrying');
        await page.keyboard.down('Control');
        await page.keyboard.press('a');
        await page.keyboard.up('Control');
        await page.keyboard.press('Delete');
        await this.delay(100);
      }

      // ВАЖНО: Используем page.keyboard.type() для правильной обработки мульти-шаблонов
      // Прямая установка textContent может привести к неправильной обработке переносов строк
      // Но перед вводом убеждаемся, что фокус на правильном поле
      
      // Проверяем, что активный элемент - это наш inputElement
      const activeCheck = await page.evaluate((el) => {
        return document.activeElement === el;
      }, inputElement).catch(() => false);
      
      if (!activeCheck) {
        // Принудительно устанавливаем фокус
        await inputElement.focus();
        await this.delay(200);
        
        // Повторная проверка
        const isFocused = await page.evaluate((el) => {
          return document.activeElement === el;
        }, inputElement).catch(() => false);
        
        if (!isFocused) {
          throw new Error('Cannot focus on input field before typing');
        }
      }
      
      // Вводим текст через keyboard.type для правильной обработки мульти-шаблонов
      // Это гарантирует, что переносы строк обрабатываются правильно
      await page.keyboard.type(text, { delay: 30 });
      
      // Небольшая задержка для обработки
      await this.delay(200);

      // Проверяем, что текст действительно введен
      const textEntered = await page.evaluate((el, expectedText) => {
        const htmlEl = el as HTMLElement;
        if (!htmlEl) { return false; }
        const currentText = (htmlEl.textContent ?? '').trim();
        return currentText.includes(expectedText.substring(0, 10));
      }, inputElement, text).catch(() => false);
      
      if (!textEntered) {
        logger.warn('Text may not have been entered correctly, but continuing');
      }

      // Небольшая задержка перед отправкой
      await this.delay(500);
      
      // Отправляем сообщение (Enter)
      await page.keyboard.press('Enter');
      await this.delay(300);

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
   * @param inputElement - поле ввода сообщения, в том же wrapper которого должна быть кнопка
   * @param expectedPeerId - ожидаемый peer-id чата (для поиска кнопки в правильном wrapper)
   */
  private async findAttachButton(
    page: Page, 
    inputElement?: import('puppeteer').ElementHandle<Element> | null,
    expectedPeerId?: string | null
  ): Promise<import('puppeteer').ElementHandle<Element> | null> {
    // КРИТИЧЕСКИ ВАЖНО: Если указано поле ввода или expectedPeerId, ищем кнопку в том же wrapper
    // Это гарантирует, что файл будет прикреплен к правильному чату (не к старому)
    if (inputElement || expectedPeerId) {
      const button = await page.evaluateHandle((inputEl, peerId) => {
        // Если передан элемент поля ввода, находим wrapper и кнопку в нем
        if (inputEl) {
          const htmlInput = inputEl as HTMLElement;
          const wrapper = htmlInput.closest('.new-message-wrapper');
          if (wrapper) {
            const attachButton = wrapper.querySelector('.btn-icon.btn-menu-toggle.attach-file, .attach-file, [class*="attach-file"]');
            if (attachButton) {
              return attachButton;
            }
          }
        }
        
        // Если передан peer-id, ищем wrapper с этим peer-id
        if (peerId) {
          const allWrappers = document.querySelectorAll('.new-message-wrapper');
          for (const wrapper of Array.from(allWrappers)) {
            const input = wrapper.querySelector(`.input-message-input[data-peer-id="${peerId}"]`);
            if (input) {
              const attachButton = wrapper.querySelector('.btn-icon.btn-menu-toggle.attach-file, .attach-file, [class*="attach-file"]');
              if (attachButton) {
                return attachButton;
              }
            }
          }
        }
        
        return null;
      }, inputElement || null, expectedPeerId || null);
      
      const element = button.asElement() as import('puppeteer').ElementHandle<Element> | null;
      if (element) {
        logger.debug('Attach button found in same wrapper as input field', { 
          hasInputElement: !!inputElement, 
          expectedPeerId: expectedPeerId || null 
        });
        return element;
      }
    }
    
    // Fallback: Пробуем все селекторы из массива (старый способ, только если не указаны inputElement/expectedPeerId)
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
          const acceptAttr = await fileInput.evaluate((el) => el.getAttribute('accept') ?? '');
          
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
   * @param inputElement - поле ввода сообщения (для поиска кнопки в правильном wrapper)
   * @param expectedPeerId - ожидаемый peer-id чата (для поиска кнопки в правильном wrapper)
   */
  private async sendFileViaFileChooser(
    page: Page, 
    absolutePath: string, 
    fileType: 'image' | 'video' | 'document',
    inputElement?: import('puppeteer').ElementHandle<Element> | null,
    expectedPeerId?: string | null
  ): Promise<void> {
    // КРИТИЧЕСКИ ВАЖНО: Передаем inputElement и expectedPeerId в findAttachButton
    // чтобы найти кнопку в том же wrapper, что и правильное поле ввода (не старое)
    const attachButton = await this.findAttachButton(page, inputElement, expectedPeerId);
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
   * Улучшенная версия с проверкой состояния чата и страницы
   */
  private async sendFileMessage(page: Page, attachmentPath: string, phone?: string, profileId?: string): Promise<void> {
    try {
      // Убеждаемся, что страница активна и не закрыта
      if (page.isClosed()) {
        throw new Error('Page is closed');
      }
      
      await page.bringToFront();
      await this.delay(200);

      // Преобразуем путь в абсолютный
      const absolutePath = this.resolveFilePath(attachmentPath);
      
      // Проверяем существование файла
      const fileExists = await this.checkFileExists(absolutePath);
      if (!fileExists) {
        throw new Error(`File not found: ${absolutePath} (original path: ${attachmentPath})`);
      }

      // Определяем тип файла
      const fileType = this.getFileType(absolutePath);

      logger.debug('Sending Telegram file', { absolutePath, fileType, phone, profileId });

      // ВАЖНО: Всегда ищем поле ввода ЗАНОВО перед отправкой файла
      // Не используем кэшированное поле, так как оно может быть из старого чата
      // КРИТИЧЕСКИ ВАЖНО: Используем expectedPeerId для выбора правильного поля (не старого)
      logger.debug('Searching for message input field before sending file', { phone, profileId });
      
      // Ждем небольшую задержку, чтобы убедиться что DOM обновился
      await this.delay(200);
      
      // Получаем expectedPeerId для правильного выбора поля ввода
      const expectedPeerIdForFile = profileId ? this.expectedPeerId.get(profileId) ?? null : null;
      
      // Проверяем наличие поля ввода - это более надежный индикатор, чем URL
      // ВАЖНО: Передаем expectedPeerId, чтобы выбрать правильное поле (не старое)
      const inputElement = await this.findMessageInput(page, expectedPeerIdForFile ?? undefined);
      if (!inputElement) {
        // Поле ввода не найдено - возможно чат не открыт, пытаемся открыть заново
        const normalizedPhone = phone ? phone.replace(/[^\d]/g, '') : null;
        if (normalizedPhone && phone && profileId) {
          logger.warn('Message input not found when sending file, reopening chat', { phone: normalizedPhone });
          await this.openChat(page, phone, profileId);
          await this.delay(500);
          
          // Проверяем снова после переоткрытия (с ожидаемым peer-id)
          const expectedPeerIdAfterReopen = profileId ? this.expectedPeerId.get(profileId) ?? null : null;
          const retryInputElement = await this.findMessageInput(page, expectedPeerIdAfterReopen ?? undefined);
          if (!retryInputElement) {
            throw new Error(`Cannot send file - message input not found after reopening chat for phone ${normalizedPhone}`);
          }
        } else {
          throw new Error('Message input not found - chat may not be open');
        }
      }
      
      // КРИТИЧЕСКИ ВАЖНО: Проверяем, что найденное поле имеет правильный peer-id
      if (expectedPeerIdForFile) {
        const currentPeerId = await page.evaluate((el) => {
          const htmlEl = el as HTMLElement;
          return htmlEl?.getAttribute('data-peer-id');
        }, inputElement).catch(() => null);
        
        if (currentPeerId !== expectedPeerIdForFile) {
          logger.error('Input field peer-id mismatch when sending file', {
            expectedPeerId: expectedPeerIdForFile,
            currentPeerId,
            phone,
          });
          throw new Error(
            `Cannot send file - input field peer-id mismatch. Expected: ${expectedPeerIdForFile}, Found: ${currentPeerId}. ` +
            `This may indicate that files are being sent to the wrong chat.`
          );
        }
      }
      
      // Дополнительная проверка: убеждаемся, что поле ввода в активном контейнере
      const isInActiveWrapper = await page.evaluate((el) => {
        const htmlEl = el as HTMLElement;
        if (!htmlEl) { return false; }
        
        const wrapper = htmlEl.closest('.new-message-wrapper');
        if (!wrapper) { return false; }
        
        const wrapperStyle = window.getComputedStyle(wrapper as HTMLElement);
        return (wrapper as HTMLElement).offsetParent !== null && 
               wrapperStyle.display !== 'none' && 
               wrapperStyle.visibility !== 'hidden';
      }, inputElement).catch(() => false);
      
      if (!isInActiveWrapper) {
        logger.warn('Input field not in active wrapper when sending file, but continuing');
      }
      
      // Дополнительная проверка видимости поля ввода (уже проверено в findMessageInput, но для надежности)
      const isInputVisible = await page.evaluate((el) => {
        const htmlEl = el as HTMLElement;
        if (!htmlEl) { return false; }
        const style = window.getComputedStyle(htmlEl);
        return htmlEl.offsetParent !== null && 
               style.display !== 'none' && 
               style.visibility !== 'hidden';
      }, inputElement).catch(() => false);
      
      if (!isInputVisible) {
        logger.warn('Message input is not visible, but continuing - may be a false positive');
      }

      // Загружаем файл через FileChooser
      // КРИТИЧЕСКИ ВАЖНО: Передаем inputElement и expectedPeerIdForFile
      // чтобы файл прикреплялся к правильному чату (не к старому)
      await this.sendFileViaFileChooser(page, absolutePath, fileType, inputElement, expectedPeerIdForFile);

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

