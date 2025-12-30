/**
 * WhatsApp Sender
 *
 * Реализация отправителя WhatsApp через Puppeteer и WhatsApp Web.
 */

import { MessengerType } from '@prisma/client';
import { Page } from 'puppeteer';
import path from 'path';
import fs from 'fs/promises';
import logger from '../../../config/logger';
import { validatePhone } from './utils';
import type { ChromeProcessService } from '../../profiles/chrome-process/chrome-process.service';

// MIME типы для расширений файлов
const MIME_TYPES: Record<string, string> = {
  // Изображения
  'jpg': 'image/jpeg',
  'jpeg': 'image/jpeg',
  'png': 'image/png',
  'gif': 'image/gif',
  'webp': 'image/webp',
  'bmp': 'image/bmp',
  'svg': 'image/svg+xml',
  // Видео
  'mp4': 'video/mp4',
  'avi': 'video/x-msvideo',
  'mov': 'video/quicktime',
  'webm': 'video/webm',
  'mkv': 'video/x-matroska',
  '3gp': 'video/3gpp',
  // Аудио
  'mp3': 'audio/mpeg',
  'wav': 'audio/wav',
  'ogg': 'audio/ogg',
  'aac': 'audio/aac',
  'm4a': 'audio/mp4',
  // Документы
  'pdf': 'application/pdf',
  'doc': 'application/msword',
  'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'xls': 'application/vnd.ms-excel',
  'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'ppt': 'application/vnd.ms-powerpoint',
  'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'txt': 'text/plain',
  'csv': 'text/csv',
  'zip': 'application/zip',
  'rar': 'application/x-rar-compressed',
  '7z': 'application/x-7z-compressed',
};

export interface SenderInput {
  phone: string;
  text?: string;
  attachments?: string[];
  profileId?: string;
}

export interface SenderResult {
  success: boolean;
  messenger: MessengerType;
  error?: string;
}

// Селекторы WhatsApp Web
const SELECTORS = {
  messageInput: 'div[contenteditable="true"][data-tab="10"]',
  attachButton: [
    'span[data-icon="plus"]',
    'span[data-icon="plus-rounded"]',
    'span[data-icon="attach"]',
    'button[aria-label="Прикрепить"]',
    'button[aria-label="Attach"]',
  ],
  // Пункты меню вложений (после клика на +)
  menuItemDocument: [
    'div[aria-label="Документ"]',
    'div[aria-label="Document"]',
    '[role="menuitem"][aria-label="Документ"]',
    '[role="menuitem"][aria-label="Document"]',
  ],
  menuItemPhoto: [
    'div[aria-label="Фото и видео"]',
    'div[aria-label="Photos & videos"]',
    '[role="menuitem"][aria-label="Фото и видео"]',
    '[role="menuitem"][aria-label="Photos & videos"]',
  ],
  sendButton: [
    'span[data-icon="wds-ic-send-filled"]',  // Новый селектор WhatsApp
    'span[data-icon="send"]',
    '[aria-label="Отправить"]',
    '[aria-label*="Send"]',
    'button[aria-label*="Send"]',
    '[data-testid="send"]',
  ],
  sentIndicators: 'span[data-icon="msg-dblcheck"], span[data-icon="msg-check"]',
  msgContainer: 'div[data-testid="msg-container"]',
};

export class WhatsAppSender {
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
   * Задержка
   */
  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Основной метод отправки
   */
  async sendMessage(input: SenderInput): Promise<SenderResult> {
    try {
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/4ab3c79e-9b19-4d80-b2e9-121229227ee9',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'whatsapp-sender.ts:123',message:'sendMessage START',data:{profileId:input.profileId,phone:input.phone,hasText:!!input.text,attachmentsCount:input.attachments?.length||0},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A,B,C,D'})}).catch(()=>{});
      // #endregion
      
      validatePhone(input.phone);

      if (!input.profileId) {
        throw new Error('Profile ID is required for WhatsApp sending');
      }

      if (!this.chromeProcessService) {
        throw new Error('ChromeProcessService is not available');
      }

      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/4ab3c79e-9b19-4d80-b2e9-121229227ee9',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'whatsapp-sender.ts:135',message:'Before getOrCreateMessengerPage',data:{profileId:input.profileId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      const page = await this.chromeProcessService.getOrCreateMessengerPage(
        input.profileId,
        'whatsapp',
        'https://web.whatsapp.com'
      );
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/4ab3c79e-9b19-4d80-b2e9-121229227ee9',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'whatsapp-sender.ts:140',message:'After getOrCreateMessengerPage',data:{profileId:input.profileId,pageExists:!!page,pageClosed:page?.isClosed()||false},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion

      if (!page) {
        throw new Error('Failed to get WhatsApp page for profile');
      }

      // ВАЖНО: Активируем вкладку WhatsApp перед отправкой
      // Это гарантирует, что мы работаем именно с этой вкладкой,
      // даже если мониторинг статуса переключил фокус
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/4ab3c79e-9b19-4d80-b2e9-121229227ee9',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'whatsapp-sender.ts:148',message:'Before bringToFront',data:{profileId:input.profileId,phone:input.phone,pageClosed:page.isClosed()},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      await page.bringToFront();
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/4ab3c79e-9b19-4d80-b2e9-121229227ee9',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'whatsapp-sender.ts:150',message:'After bringToFront',data:{profileId:input.profileId,phone:input.phone,pageClosed:page.isClosed()},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A'})}).catch(()=>{});
      // #endregion
      await this.delay(100);

      // Открываем чат с номером (передаём profileId для кэширования)
      await this.openChat(page, input.phone, input.profileId);

      // Отправляем сообщение
      if (input.text) {
        await this.sendTextMessage(page, input.text);
        // Проверяем отправку текста, но не блокируем отправку файлов при неудаче
        const isSent = await this.verifyMessageSent(page, input.text);
        if (!isSent) {
          logger.warn('Text message verification failed, but continuing with file attachments if any', {
            phone: input.phone,
            hasAttachments: !!(input.attachments && input.attachments.length > 0)
          });
          // НЕ бросаем ошибку здесь - продолжаем отправку файлов
        }
      }

      // Отправляем вложения
      if (input.attachments && input.attachments.length > 0) {
        logger.info('Starting file attachments send', { 
          attachmentsCount: input.attachments.length,
          attachments: input.attachments,
          phone: input.phone,
          profileId: input.profileId
        });
        
        for (const attachment of input.attachments) {
          logger.info('Sending file attachment', { attachment, phone: input.phone });
          await this.sendFileMessage(page, attachment, input.phone, input.profileId);
          await this.delay(1000);
        }
        
        logger.info('All file attachments sent', { 
          attachmentsCount: input.attachments.length,
          phone: input.phone 
        });
      } else {
        logger.debug('No attachments to send', { phone: input.phone });
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
   * Проверяет, не открыт ли уже чат с этим номером - если да, не перезагружает страницу
   */
  private async openChat(page: Page, phone: string, profileId?: string): Promise<void> {
    try {
      const normalizedPhone = phone.replace(/[^\d]/g, '');

      if (page.isClosed()) {
        // Сбрасываем кэш для этого профиля если страница закрыта
        if (profileId) {
          this.currentOpenChat.delete(profileId);
        }
        throw new Error('Page is closed');
      }

      // Проверяем, не открыт ли уже чат с этим номером
      const cachedPhone = profileId ? this.currentOpenChat.get(profileId) : null;
      
      if (cachedPhone === normalizedPhone) {
        // Чат уже открыт с этим номером - проверяем что поле ввода доступно
        logger.debug('Chat already open for this phone, checking input field', { phone: normalizedPhone, profileId });
        
        try {
          // Проверяем что поле ввода есть и мы всё ещё в правильном чате
          const inputExists = await page.$(SELECTORS.messageInput);
          if (inputExists) {
            // Дополнительно проверяем URL чтобы убедиться что мы в правильном чате
            const currentUrl = page.url();
            if (currentUrl.includes(normalizedPhone) || currentUrl.includes('web.whatsapp.com')) {
              logger.debug('Chat verified, using existing session', { phone: normalizedPhone });
              await this.delay(200);
              return;
            }
          }
          // Поле ввода не найдено или URL изменился - нужно переоткрыть чат
          logger.debug('Chat verification failed, reopening', { phone: normalizedPhone });
        } catch {
          // Ошибка проверки - переоткроем чат
          logger.debug('Chat check error, reopening', { phone: normalizedPhone });
        }
      }

      const chatUrl = `https://web.whatsapp.com/send?phone=${normalizedPhone}`;
      logger.debug('Opening chat URL', { chatUrl, wasOpen: cachedPhone === normalizedPhone });

      // Переходим в чат
      await page.goto(chatUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

      // Ждем поле ввода
      await page.waitForSelector(SELECTORS.messageInput, { timeout: 20000 });
      await this.delay(300);

      // Сохраняем в кэш
      if (profileId) {
        this.currentOpenChat.set(profileId, normalizedPhone);
      }

      logger.debug('WhatsApp chat opened', { phone: normalizedPhone, profileId });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to open WhatsApp chat', { phone, error: errorMsg });
      // Сбрасываем кэш при ошибке
      if (profileId) {
        this.currentOpenChat.delete(profileId);
      }
      throw new Error(`Failed to open chat: ${errorMsg}`);
    }
  }

  /**
   * Отправка текстового сообщения
   * Использует ручной набор через keyboard.type для надежности
   */
  private async sendTextMessage(page: Page, text: string): Promise<void> {
    try {
      await page.waitForSelector(SELECTORS.messageInput, { timeout: 10000 });
      
      // Кликаем на поле ввода
      await page.click(SELECTORS.messageInput);
      await this.delay(200);

      // Очищаем поле если там что-то есть
      await page.keyboard.down('Control');
      await page.keyboard.press('a');
      await page.keyboard.up('Control');
      await page.keyboard.press('Backspace');
      await this.delay(100);

      // Вводим текст через keyboard.type (надежный "ручной" набор)
      await page.keyboard.type(text, { delay: 30 });
      await this.delay(300);

      // Отправляем через Enter
      await page.keyboard.press('Enter');
      await this.delay(500);

      logger.debug('WhatsApp text message sent', { textLength: text.length });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to send WhatsApp text message', { error: errorMsg });
      throw new Error(`Failed to send text message: ${errorMsg}`);
    }
  }

  /**
   * Проверка отправки сообщения
   */
  private async verifyMessageSent(page: Page, text: string): Promise<boolean> {
    try {
      const maxChecks = 25;
      const checkInterval = 200;

      for (let i = 0; i < maxChecks; i++) {
        const verification = await page.evaluate((searchText: string, msgInputSel: string, sentIndSel: string, msgContSel: string) => {
          const allText = document.body.innerText ?? '';
          const textFound = allText.includes(searchText.substring(0, 50));

          const inputField = document.querySelector(msgInputSel) as HTMLElement | null;
          const inputIsEmpty = !inputField || !inputField.textContent || inputField.textContent.trim() === '';

          const sentIndicators = document.querySelectorAll(sentIndSel);
          const hasIndicators = sentIndicators.length > 0;

          const messages = document.querySelectorAll(msgContSel);
          let foundInMessages = false;
          if (messages.length > 0) {
            const lastMessage = messages[messages.length - 1] as HTMLElement;
            foundInMessages = (lastMessage.textContent ?? '').includes(searchText.substring(0, 50));
          }

          return { textFound, inputIsEmpty, hasIndicators, foundInMessages };
        }, text, SELECTORS.messageInput, SELECTORS.sentIndicators, SELECTORS.msgContainer);

        if ((verification.textFound && verification.inputIsEmpty) ||
            (verification.foundInMessages && verification.hasIndicators)) {
          logger.debug('Message verified as sent', verification);
          return true;
        }

        await this.delay(checkInterval);
      }

      logger.warn('Message verification failed');
      return false;
    } catch (error) {
      logger.error('Failed to verify message sent', { error });
      return false;
    }
  }

  /**
   * Преобразование пути в абсолютный
   * Нормализует пути для кроссплатформенной совместимости
   */
  private resolveFilePath(filePath: string): string {
    // Нормализуем путь (заменяем все слеши на системные)
    const normalizedPath = filePath.replace(/[\\/]/g, path.sep);
    
    if (path.isAbsolute(normalizedPath)) {
      logger.debug('File path is already absolute', { 
        originalPath: filePath,
        normalizedPath 
      });
      return normalizedPath;
    }
    
    // Пробуем несколько вариантов базовой директории
    const possibleBaseDirs = [
      path.join(process.cwd(), 'uploads', 'templates'),
      path.join(process.cwd(), 'backend', 'uploads', 'templates'),
      path.resolve(process.cwd(), 'uploads', 'templates'),
    ];
    
    // Используем первую директорию для разрешения пути
    const uploadsDir = possibleBaseDirs[0];
    const resolvedPath = path.resolve(uploadsDir, normalizedPath);
    
    logger.debug('Resolved file path', {
      originalPath: filePath,
      normalizedPath,
      processCwd: process.cwd(),
      uploadsDir,
      resolvedPath,
      pathHasSpaces: resolvedPath.includes(' '),
      pathSeparator: path.sep,
    });
    
    return resolvedPath;
  }

  /**
   * Проверка существования файла
   */
  private async checkFileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      logger.debug('File exists', { filePath });
      return true;
    } catch (error) {
      // Детальное логирование для диагностики
      const stats = await fs.stat(path.dirname(filePath)).catch(() => null);
      logger.warn('File not found', {
        filePath,
        dirExists: stats !== null,
        dirPath: path.dirname(filePath),
        fileName: path.basename(filePath),
        error: error instanceof Error ? error.message : 'Unknown error',
        processCwd: process.cwd(),
      });
      return false;
    }
  }

  /**
   * Проверка что мы всё ещё в правильном чате
   * Важно вызывать перед отправкой файла, чтобы он не улетел в неправильный чат
   */
  private async ensureCorrectChat(page: Page, phone: string, _profileId?: string): Promise<boolean> {
    const normalizedPhone = phone.replace(/[^\d]/g, '');
    
    try {
      // Проверяем URL страницы
      const currentUrl = page.url();
      
      // Если URL содержит номер телефона - мы в правильном чате
      if (currentUrl.includes(`phone=${normalizedPhone}`)) {
        logger.debug('Correct chat verified via URL', { phone: normalizedPhone });
        return true;
      }
      
      // Проверяем заголовок чата (имя или номер контакта)
      const chatHeader = await page.evaluate(() => {
        // Ищем заголовок чата с номером или именем контакта
        const headerSelectors = [
          'header span[title]',
          '[data-testid="conversation-info-header"] span',
          '#main header span[dir="auto"]',
        ];
        
        for (const sel of headerSelectors) {
          const el = document.querySelector(sel);
          if (el) {
            return (el as HTMLElement).textContent ?? '';
          }
        }
        return '';
      });
      
      // Проверяем содержит ли заголовок номер телефона
      if (chatHeader && chatHeader.replace(/[^\d]/g, '').includes(normalizedPhone.slice(-7))) {
        logger.debug('Correct chat verified via header', { phone: normalizedPhone, header: chatHeader });
        return true;
      }
      
      // Если не можем подтвердить чат - логируем, но НЕ сбрасываем кэш
      // Переоткрытие чата может привести к отправке файла в неправильный чат
      logger.warn('Could not verify chat via URL or header', { phone: normalizedPhone, currentUrl });
      
      // Возвращаем true, потому что мы доверяем кэшу - чат был открыт в начале sendMessage
      return true;
    } catch (error) {
      logger.error('Error verifying chat', { phone: normalizedPhone, error });
      return false;
    }
  }

  /**
   * Определение типа файла
   */
  private getFileType(filePath: string): 'image' | 'video' | 'document' {
    const ext = filePath.split('.').pop()?.toLowerCase() ?? '';
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) {
      return 'image';
    }
    if (['mp4', 'avi', 'mov', 'webm', 'mkv'].includes(ext)) {
      return 'video';
    }
    return 'document';
  }

  /**
   * Получение MIME-типа файла по расширению
   */
  private getMimeType(filePath: string): string {
    const ext = filePath.split('.').pop()?.toLowerCase() ?? '';
    return MIME_TYPES[ext] ?? 'application/octet-stream';
  }

  /**
   * Поиск элемента по списку селекторов
   */
  private async findElement(page: Page, selectors: string[]) {
    for (const selector of selectors) {
      const element = await page.$(selector);
      if (element) {
        return element;
      }
    }
    return null;
  }

  /**
   * Клик на кнопку прикрепления
   */
  private async clickAttachButton(page: Page): Promise<boolean> {
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/4ab3c79e-9b19-4d80-b2e9-121229227ee9',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'whatsapp-sender.ts:505',message:'clickAttachButton START',data:{pageClosed:page.isClosed(),pageUrl:page.url()},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A,C'})}).catch(()=>{});
    // #endregion
    
    // Ищем кнопку через селекторы
    for (const selector of SELECTORS.attachButton) {
      try {
        const element = await page.$(selector);
        if (element) {
          // #region agent log
          fetch('http://127.0.0.1:7243/ingest/4ab3c79e-9b19-4d80-b2e9-121229227ee9',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'whatsapp-sender.ts:512',message:'Found attach button element',data:{selector,pageClosed:page.isClosed()},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A,C'})}).catch(()=>{});
          // #endregion
          // Если это span, ищем родительскую кнопку
          if (selector.startsWith('span')) {
            const button = await page.evaluateHandle((el) => {
              let current = el as HTMLElement;
              while (current && current.tagName !== 'BUTTON') {
                if (!current.parentElement || current.tagName === 'BODY') {
                  break;
                }
                current = current.parentElement;
              }
              return current.tagName === 'BUTTON' ? current : el;
            }, element);
            
            const buttonEl = button.asElement();
            if (buttonEl) {
              await (buttonEl as unknown as { click(): Promise<void> }).click();
              logger.debug('Clicked attach button via span parent', { selector });
              return true;
            }
          } else {
            await element.click();
            logger.debug('Clicked attach button', { selector });
            return true;
          }
        }
      } catch {
        continue;
      }
    }

    // Fallback: ищем через evaluate
    const clicked = await page.evaluate(() => {
      const icons = ['plus', 'plus-rounded', 'attach'];
      for (const iconName of icons) {
        const span = document.querySelector(`span[data-icon="${iconName}"]`);
        if (span) {
          let element: HTMLElement | null = span as HTMLElement;
          while (element && element.tagName !== 'BUTTON') {
            element = element.parentElement;
            if (!element || element.tagName === 'BODY') {
              break;
            }
          }
          if (element) {
            element.click();
            return true;
          }
        }
      }
      return false;
    });

    return clicked;
  }


  /**
   * Ожидание появления меню вложений после клика на кнопку "+"
   */
  private async waitForAttachmentMenu(page: Page, timeout: number = 5000): Promise<boolean> {
    const startTime = Date.now();
    const checkInterval = 200;
    
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/4ab3c79e-9b19-4d80-b2e9-121229227ee9',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'whatsapp-sender.ts:570',message:'waitForAttachmentMenu START',data:{timeout,pageClosed:page.isClosed(),pageUrl:page.url()},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
    
    while (Date.now() - startTime < timeout) {
      // Проверяем, что страница не закрыта
      if (page.isClosed()) {
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/4ab3c79e-9b19-4d80-b2e9-121229227ee9',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'whatsapp-sender.ts:577',message:'Page closed in waitForAttachmentMenu',data:{elapsed:Date.now()-startTime},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
        // #endregion
        logger.warn('Page closed while waiting for menu', { elapsed: Date.now() - startTime });
        return false;
      }

      const menuInfo = await page.evaluate(() => {
        // Проверяем наличие меню через различные селекторы
        const menuSelectors = [
          '[role="menu"]',
          '[role="menuitem"]',
          'div[aria-label="Документ"]',
          'div[aria-label="Document"]',
          'div[aria-label="Фото и видео"]',
          'div[aria-label="Photos & videos"]',
        ];
        
        const foundElements: Array<{ selector: string; visible: boolean; ariaLabel: string | null }> = [];
        
        for (const selector of menuSelectors) {
          const element = document.querySelector(selector);
          if (element) {
            const isVisible = (element as HTMLElement).offsetParent !== null;
            const ariaLabel = element.getAttribute('aria-label');
            foundElements.push({ selector, visible: isVisible, ariaLabel });
            if (isVisible) {
              return { found: true, elements: foundElements };
            }
          }
        }
        
        // Проверяем наличие любого видимого menuitem
        const menuItems = Array.from(document.querySelectorAll('[role="menuitem"]'));
        const visibleItems: Array<{ ariaLabel: string; visible: boolean }> = [];
        
        for (const item of menuItems) {
          const isVisible = (item as HTMLElement).offsetParent !== null;
          const ariaLabel = item.getAttribute('aria-label') ?? '';
          visibleItems.push({ ariaLabel, visible: isVisible });
          if (isVisible) {
            return { found: true, elements: foundElements, visibleItems };
          }
        }
        
        // Также проверяем все элементы с aria-label, которые могут быть меню
        const allAriaLabels = Array.from(document.querySelectorAll('[aria-label]'));
        const ariaLabelItems: string[] = [];
        for (const el of allAriaLabels) {
          const label = el.getAttribute('aria-label');
          if (label && (label.includes('Документ') || label.includes('Document') || 
              label.includes('Фото') || label.includes('Photo'))) {
            const isVisible = (el as HTMLElement).offsetParent !== null;
            if (isVisible) {
              ariaLabelItems.push(label);
            }
          }
        }
        
        return { 
          found: false, 
          elements: foundElements, 
          visibleItems,
          ariaLabelItems,
          menuItemsCount: menuItems.length,
          allAriaLabelsCount: allAriaLabels.length
        };
      }).catch((err) => {
        logger.debug('Error checking menu visibility', { error: err instanceof Error ? err.message : String(err) });
        return { found: false, error: String(err) };
      });
      
      if (menuInfo.found) {
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/4ab3c79e-9b19-4d80-b2e9-121229227ee9',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'whatsapp-sender.ts:608',message:'Menu found in waitForAttachmentMenu',data:{elapsed:Date.now()-startTime,elementsCount:menuInfo.elements?.length||0,pageClosed:page.isClosed()},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
        // #endregion
        logger.debug('Attachment menu appeared', { 
          elapsed: Date.now() - startTime,
          elements: menuInfo.elements?.length || 0
        });
        return true;
      }
      
      // Логируем детали, если меню не найдено (только каждые 1 секунду, чтобы не спамить)
      if ((Date.now() - startTime) % 1000 < checkInterval) {
        logger.debug('Menu not found yet', { 
          elapsed: Date.now() - startTime,
          menuInfo: menuInfo.error ? { error: menuInfo.error } : {
            elementsFound: menuInfo.elements?.length || 0,
            visibleItems: menuInfo.visibleItems?.length || 0,
            ariaLabelItems: menuInfo.ariaLabelItems?.length || 0,
            menuItemsCount: menuInfo.menuItemsCount || 0
          }
        });
      }
      
      await this.delay(checkInterval);
    }
    
    logger.warn('Attachment menu did not appear within timeout', { timeout });
    return false;
  }

  /**
   * Клик на пункт меню вложений (Документ или Фото)
   * Добавлено ожидание появления меню и retry логика
   */
  private async clickMenuItem(page: Page, fileType: 'image' | 'video' | 'document'): Promise<boolean> {
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/4ab3c79e-9b19-4d80-b2e9-121229227ee9',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'whatsapp-sender.ts:623',message:'clickMenuItem START',data:{fileType,pageClosed:page.isClosed(),pageUrl:page.url()},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A,C'})}).catch(()=>{});
    // #endregion
    
    // Определяем aria-label в зависимости от типа файла
    const ariaLabels = fileType === 'document' 
      ? ['Документ', 'Document']
      : ['Фото и видео', 'Photos & videos', 'Photos'];

    logger.debug('Looking for menu item', { fileType, ariaLabels, url: page.url() });

    // Ожидаем появления меню перед попыткой найти пункт
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/4ab3c79e-9b19-4d80-b2e9-121229227ee9',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'whatsapp-sender.ts:632',message:'Before waitForAttachmentMenu',data:{fileType,pageClosed:page.isClosed()},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
    const menuAppeared = await this.waitForAttachmentMenu(page, 5000);
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/4ab3c79e-9b19-4d80-b2e9-121229227ee9',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'whatsapp-sender.ts:635',message:'After waitForAttachmentMenu',data:{fileType,menuAppeared,pageClosed:page.isClosed()},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'C'})}).catch(()=>{});
    // #endregion
    if (!menuAppeared) {
      logger.warn('Menu did not appear in waitForAttachmentMenu, but continuing with search', { fileType });
      // Даем еще немного времени - возможно меню появляется с задержкой
      await this.delay(500);
    }

    // Способ 1: Ищем через селекторы с retry
    const menuSelectors = fileType === 'document' 
      ? SELECTORS.menuItemDocument 
      : SELECTORS.menuItemPhoto;

    const maxRetries = 5; // Увеличиваем количество попыток
    for (let retry = 0; retry < maxRetries; retry++) {
      if (retry > 0) {
        logger.debug(`Retry ${retry} of ${maxRetries - 1} for finding menu item`, { fileType });
        await this.delay(400); // Увеличиваем задержку между попытками
      }

      // Проверяем, что страница не закрыта
      if (page.isClosed()) {
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/4ab3c79e-9b19-4d80-b2e9-121229227ee9',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'whatsapp-sender.ts:647',message:'Page closed during search',data:{fileType,retry},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
        // #endregion
        logger.error('Page closed during menu item search', { fileType, retry });
        throw new Error('Page closed during menu item search');
      }
      
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/4ab3c79e-9b19-4d80-b2e9-121229227ee9',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'whatsapp-sender.ts:650',message:'Before selectors search',data:{fileType,retry,pageClosed:page.isClosed()},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A,C'})}).catch(()=>{});
      // #endregion

      logger.debug('Trying selectors method', { selectors: menuSelectors, fileType, retry });
      for (const selector of menuSelectors) {
        try {
          // Используем waitForSelector с более длинным timeout
          const element = await page.waitForSelector(selector, { 
            timeout: 2000, // Увеличиваем timeout
            visible: true 
          }).catch(() => null);
          
          if (element) {
            // Проверяем видимость несколькими способами
            const [isIntersecting, offsetParent, display] = await Promise.all([
              element.isIntersectingViewport().catch(() => false),
              page.evaluate((el) => (el as HTMLElement).offsetParent !== null, element).catch(() => false),
              page.evaluate((el) => {
                const style = window.getComputedStyle(el as HTMLElement);
                return style.display !== 'none' && style.visibility !== 'hidden';
              }, element).catch(() => false)
            ]);
            
            const isVisible = isIntersecting || offsetParent || display;
            logger.debug('Found element via selector', { 
              selector, 
              fileType, 
              isVisible, 
              isIntersecting,
              offsetParent,
              display,
              retry 
            });
            
            if (isVisible) {
              // Прокручиваем элемент в видимую область, если нужно
              try {
                await element.scrollIntoViewIfNeeded?.().catch(() => {});
              } catch {
                // Игнорируем ошибки прокрутки
              }
              
              // #region agent log
              fetch('http://127.0.0.1:7243/ingest/4ab3c79e-9b19-4d80-b2e9-121229227ee9',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'whatsapp-sender.ts:663',message:'Before clicking menu item element',data:{fileType,retry,selector,pageClosed:page.isClosed()},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A,C'})}).catch(()=>{});
              // #endregion
              await this.delay(100); // Небольшая задержка перед кликом
              await element.click();
              // #region agent log
              fetch('http://127.0.0.1:7243/ingest/4ab3c79e-9b19-4d80-b2e9-121229227ee9',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'whatsapp-sender.ts:666',message:'After clicking menu item element',data:{fileType,retry,selector,pageClosed:page.isClosed()},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A,C'})}).catch(()=>{});
              // #endregion
              logger.info('Clicked menu item via selector', { selector, fileType, retry });
              await this.delay(200); // Небольшая задержка после клика
              return true;
            }
          }
        } catch (error) {
          logger.debug('Selector click failed', { 
            selector, 
            error: error instanceof Error ? error.message : String(error),
            retry
          });
          continue;
        }
      }

      // Способ 2: Ищем через evaluate по aria-label (с retry)
      logger.debug('Trying evaluate method', { ariaLabels, fileType, retry });
      const evaluateResult = await page.evaluate((labels: string[]) => {
        try {
          // Сначала собираем все возможные элементы с aria-label
          const allElements = Array.from(document.querySelectorAll('[aria-label]'));
          const candidates: Array<{ element: HTMLElement; ariaLabel: string; visible: boolean; methods: string[] }> = [];
          
          for (const el of allElements) {
            const ariaLabel = el.getAttribute('aria-label') ?? '';
            if (!ariaLabel) continue;
            
            const htmlEl = el as HTMLElement;
            const offsetParentVisible = htmlEl.offsetParent !== null;
            const computedStyle = window.getComputedStyle(htmlEl);
            const styleVisible = computedStyle.display !== 'none' && computedStyle.visibility !== 'hidden';
            const isVisible = offsetParentVisible || styleVisible;
            
            const methods: string[] = [];
            if (offsetParentVisible) methods.push('offsetParent');
            if (styleVisible) methods.push('computedStyle');
            
            // Проверяем, подходит ли элемент по aria-label
            for (const label of labels) {
              if (ariaLabel === label || ariaLabel.includes(label) || label.includes(ariaLabel)) {
                candidates.push({ element: htmlEl, ariaLabel, visible: isVisible, methods });
                if (isVisible) {
                  // Пробуем кликнуть сразу, если видимый
                  try {
                    htmlEl.scrollIntoView({ block: 'center', behavior: 'instant' });
                    htmlEl.click();
                    return { success: true, method: 'aria-label-exact', label: ariaLabel, visibilityMethods: methods };
                  } catch (err) {
                    // Продолжаем поиск, если клик не удался
                  }
                }
              }
            }
          }
          
          // Если не нашли точное совпадение, ищем menuitem
          const menuItems = Array.from(document.querySelectorAll('[role="menuitem"]'));
          const foundItems: Array<{ ariaLabel: string; visible: boolean; methods: string[] }> = [];
          
          for (const item of menuItems) {
            const ariaLabel = item.getAttribute('aria-label') ?? '';
            const htmlItem = item as HTMLElement;
            const offsetParentVisible = htmlItem.offsetParent !== null;
            const computedStyle = window.getComputedStyle(htmlItem);
            const styleVisible = computedStyle.display !== 'none' && computedStyle.visibility !== 'hidden';
            const isVisible = offsetParentVisible || styleVisible;
            
            const methods: string[] = [];
            if (offsetParentVisible) methods.push('offsetParent');
            if (styleVisible) methods.push('computedStyle');
            
            foundItems.push({ ariaLabel, visible: isVisible, methods });
            
            if (isVisible && ariaLabel) {
              for (const label of labels) {
                if (ariaLabel.includes(label) || ariaLabel === label || label.includes(ariaLabel)) {
                  try {
                    htmlItem.scrollIntoView({ block: 'center', behavior: 'instant' });
                    htmlItem.click();
                    return { success: true, method: 'menuitem', label: ariaLabel, visibilityMethods: methods };
                  } catch (err) {
                    // Продолжаем поиск
                  }
                }
              }
            }
          }
          
          // Также ищем по тексту содержимого
          for (const label of labels) {
            const textElements = Array.from(document.querySelectorAll('*')).filter(el => {
              const text = el.textContent?.trim() ?? '';
              return text === label || text.includes(label);
            });
            
            for (const textEl of textElements) {
              const htmlEl = textEl as HTMLElement;
              const offsetParentVisible = htmlEl.offsetParent !== null;
              const computedStyle = window.getComputedStyle(htmlEl);
              const styleVisible = computedStyle.display !== 'none' && computedStyle.visibility !== 'hidden';
              const isVisible = offsetParentVisible || styleVisible;
              
              if (isVisible) {
                try {
                  htmlEl.scrollIntoView({ block: 'center', behavior: 'instant' });
                  htmlEl.click();
                  return { success: true, method: 'text-content', label };
                } catch (err) {
                  // Продолжаем
                }
              }
            }
          }
          
          return { 
            success: false, 
            error: 'No matching menu item found', 
            candidates: candidates.map(c => ({ ariaLabel: c.ariaLabel, visible: c.visible, methods: c.methods })),
            foundItems: foundItems.map(f => ({ ariaLabel: f.ariaLabel, visible: f.visible, methods: f.methods })),
            labels,
            allElementsCount: allElements.length,
            menuItemsCount: menuItems.length
          };
        } catch (err) {
          return { success: false, error: String(err) };
        }
      }, ariaLabels);

      if (evaluateResult.success) {
        logger.info('Clicked menu item via evaluate', { 
          clicked: evaluateResult.label, 
          method: evaluateResult.method,
          fileType,
          retry,
          visibilityMethods: evaluateResult.visibilityMethods
        });
        await this.delay(200); // Небольшая задержка после клика
        return true;
      }

      // Если не нашли на этой попытке, логируем для диагностики
      if (retry < maxRetries - 1) {
        logger.debug('Menu item not found on retry, will retry', { 
          fileType, 
          retry,
          error: evaluateResult.error,
          candidatesCount: evaluateResult.candidates?.length || 0,
          foundItemsCount: evaluateResult.foundItems?.length || 0,
          allElementsCount: evaluateResult.allElementsCount || 0,
          menuItemsCount: evaluateResult.menuItemsCount || 0
        });
        
        // Логируем найденные элементы для диагностики (только на первой попытке)
        if (retry === 0 && evaluateResult.candidates && evaluateResult.candidates.length > 0) {
          logger.debug('Found candidates (first 5)', { 
            candidates: evaluateResult.candidates.slice(0, 5)
          });
        }
        if (retry === 0 && evaluateResult.foundItems && evaluateResult.foundItems.length > 0) {
          logger.debug('Found menu items (first 5)', { 
            foundItems: evaluateResult.foundItems.slice(0, 5)
          });
        }
      }
    }

    // Все попытки исчерпаны - логируем детальную информацию
    const finalEvaluateResult = await page.evaluate((labels: string[]) => {
      const allElements = Array.from(document.querySelectorAll('[aria-label]'));
      const menuItems = Array.from(document.querySelectorAll('[role="menuitem"]'));
      return {
        allAriaLabels: allElements.map(el => ({
          label: el.getAttribute('aria-label'),
          visible: (el as HTMLElement).offsetParent !== null
        })),
        menuItems: menuItems.map(item => ({
          label: item.getAttribute('aria-label'),
          visible: (item as HTMLElement).offsetParent !== null,
          text: item.textContent?.trim()
        }))
      };
    }, ariaLabels).catch(() => ({ error: 'Page closed or error' }));

    logger.error('Could not find menu item after all retries', { 
      fileType, 
      ariaLabels,
      maxRetries,
      url: page.url(),
      finalState: finalEvaluateResult
    });
    return false;
  }

  /**
   * Загрузка файла через input[type="file"] с правильным MIME-типом
   * Использует метод с установкой MIME-типа для предотвращения ошибок "файл не поддерживается"
   */
  private async uploadFileToInput(page: Page, absolutePath: string, fileType: 'image' | 'video' | 'document'): Promise<boolean> {
    try {
      // Получаем MIME-тип файла
      const mimeType = this.getMimeType(absolutePath);
      const fileName = path.basename(absolutePath);
      
      logger.debug('Uploading file with MIME type', { 
        absolutePath, 
        fileName, 
        mimeType, 
        fileType 
      });

      // Читаем файл в base64
      const fileBuffer = await fs.readFile(absolutePath);
      const base64Data = fileBuffer.toString('base64');

      // Используем метод с правильным MIME-типом
      // Это гарантирует, что WhatsApp получит файл с корректным типом
      const result = await this.uploadFileWithMimeType(
        page,
        base64Data,
        fileName,
        mimeType,
        fileType
      );

      if (result) {
        logger.debug('File uploaded successfully with MIME type', { 
          absolutePath, 
          fileName, 
          mimeType 
        });
        return true;
      }

      // Fallback: пробуем стандартный метод (на случай если метод с MIME-типом не сработал)
      logger.debug('MIME type method failed, trying standard uploadFile', { absolutePath });
      
      const fileInputs = await page.$$('input[type="file"]');
      
      if (fileInputs.length === 0) {
        logger.warn('No file inputs found for fallback', { absolutePath });
        return false;
      }

      // Для документов ищем input с accept="*" или без accept
      // Для изображений ищем input с accept*="image"
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
            logger.debug('File uploaded to input (fallback)', { absolutePath, acceptAttr, fileType });
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
      logger.warn('Failed to upload file to input', { 
        error: error instanceof Error ? error.message : String(error),
        absolutePath 
      });
      return false;
    }
  }

  /**
   * Отправка файла через несколько методов
   * Пробуем разные подходы для надёжности:
   * 1. Метод с правильным MIME-типом через DataTransfer
   * 2. Drag-and-drop симуляция
   * 3. FileChooser (fallback)
   */
  private async sendFileMessage(page: Page, attachmentPath: string, phone?: string, profileId?: string): Promise<void> {
    try {
      logger.info('Starting file send', {
        attachmentPath,
        phone,
        profileId,
        processCwd: process.cwd(),
      });

      const absolutePath = this.resolveFilePath(attachmentPath);

      let finalPath = absolutePath;
      
      if (!await this.checkFileExists(absolutePath)) {
        // Нормализуем исходный путь для поиска альтернатив
        const normalizedAttachmentPath = attachmentPath.replace(/[\\/]/g, path.sep);
        
        // Проверяем альтернативные пути (на случай если process.cwd() указывает не туда)
        const alternativePaths = [
          path.join(process.cwd(), 'backend', 'uploads', 'templates', normalizedAttachmentPath),
          path.resolve(process.cwd(), 'uploads', 'templates', normalizedAttachmentPath),
          path.join(process.cwd(), 'uploads', 'templates', normalizedAttachmentPath),
          // Пробуем также с исходным путем (на случай если он уже нормализован)
          path.join(process.cwd(), 'backend', 'uploads', 'templates', attachmentPath),
          path.resolve(process.cwd(), 'uploads', 'templates', attachmentPath),
        ];
        
        // Убираем дубликаты
        const uniquePaths = Array.from(new Set([absolutePath, ...alternativePaths]));
        
        logger.debug('File not found at primary path, checking alternatives', {
          primaryPath: absolutePath,
          alternatives: uniquePaths,
          attachmentPath,
          normalizedAttachmentPath,
        });
        
        let foundPath: string | null = null;
        for (const altPath of uniquePaths) {
          try {
            await fs.access(altPath);
            foundPath = altPath;
            logger.info('File found at alternative path', { 
              original: absolutePath, 
              found: altPath,
              attachmentPath 
            });
            break;
          } catch (error) {
            logger.debug('Alternative path check failed', { 
              path: altPath, 
              error: error instanceof Error ? error.message : 'Unknown' 
            });
            continue;
          }
        }
        
        if (!foundPath) {
          // Проверяем существование директорий для диагностики
          const baseDirs = [
            path.join(process.cwd(), 'uploads', 'templates'),
            path.join(process.cwd(), 'backend', 'uploads', 'templates'),
          ];
          
          const dirChecks = await Promise.all(
            baseDirs.map(async (dir) => {
              try {
                const stats = await fs.stat(dir);
                return { dir, exists: stats.isDirectory(), files: await fs.readdir(dir).catch(() => []) };
              } catch {
                return { dir, exists: false, files: [] };
              }
            })
          );
          
          logger.error('File not found in any checked path', {
            attachmentPath,
            normalizedAttachmentPath,
            checkedPaths: uniquePaths,
            directoryChecks: dirChecks,
            processCwd: process.cwd(),
          });
          
          throw new Error(
            `File not found: ${attachmentPath}. ` +
            `Checked paths: ${uniquePaths.join(', ')}. ` +
            `Make sure files are uploaded to uploads/templates/ directory. ` +
            `Process CWD: ${process.cwd()}`
          );
        }
        
        finalPath = foundPath;
      }

      const fileType = this.getFileType(finalPath);
      
      logger.debug('Sending WhatsApp file', { absolutePath: finalPath, fileType, phone, profileId });

      // Проверяем что мы в правильном чате (без переоткрытия - чат уже открыт в sendMessage)
      if (phone) {
        const isCorrectChat = await this.ensureCorrectChat(page, phone, profileId);
        if (!isCorrectChat) {
          logger.warn('Chat verification warning before file send', { phone, profileId });
        }
      }

      // Убеждаемся, что поле ввода доступно
      await page.waitForSelector(SELECTORS.messageInput, { timeout: 10000 });
      await this.delay(300);
      
      // Используем FileChooser метод - он перехватывает диалог ДО его открытия
      // page.waitForFileChooser() запускается ПЕРЕД кликом, что предотвращает появление проводника
      await this.sendFileViaFileChooser(page, finalPath, fileType);

      // Ждем загрузки превью
      await this.delay(2000);

      // Проверяем, что файл загружен
      const fileLoaded = await this.waitForFilePreview(page);
      if (!fileLoaded) {
        logger.warn('File preview not detected, but continuing');
      }

      // Кликаем отправить
      await this.clickSendButton(page);
      await this.delay(2000);

      logger.debug('WhatsApp file sent successfully', { absolutePath, phone, profileId });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to send WhatsApp file', { attachmentPath, phone, profileId, error: errorMsg });
      throw new Error(`Failed to send file: ${errorMsg}`);
    }
  }

  /**
   * Симуляция drag-and-drop файла на страницу
   * Создаёт File объект с правильным MIME-типом и диспатчит drop event
   */
  private async simulateFileDrop(
    page: Page, 
    base64Data: string, 
    fileName: string, 
    mimeType: string
  ): Promise<boolean> {
    try {
      const result = await page.evaluate(
        async (b64: string, name: string, mime: string) => {
          try {
            // Конвертируем base64 в ArrayBuffer
            const binaryString = atob(b64);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
              bytes[i] = binaryString.charCodeAt(i);
            }
            
            // Создаём File объект с правильным MIME-типом
            const file = new File([bytes.buffer], name, { type: mime });
            
            // Создаём DataTransfer с файлом
            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(file);
            
            // Находим элемент для drop (контейнер чата или body)
            const dropTarget = document.querySelector('#main') ?? 
                              document.querySelector('[data-testid="conversation-panel-wrapper"]') ??
                              document.body;
            
            if (!dropTarget) {
              return { success: false, error: 'Drop target not found' };
            }

            // Создаём и диспатчим события drag
            const dragEnterEvent = new DragEvent('dragenter', {
              bubbles: true,
              cancelable: true,
              dataTransfer,
            });
            
            const dragOverEvent = new DragEvent('dragover', {
              bubbles: true,
              cancelable: true,
              dataTransfer,
            });
            
            const dropEvent = new DragEvent('drop', {
              bubbles: true,
              cancelable: true,
              dataTransfer,
            });

            // Диспатчим события последовательно
            dropTarget.dispatchEvent(dragEnterEvent);
            await new Promise(r => setTimeout(r, 100));
            dropTarget.dispatchEvent(dragOverEvent);
            await new Promise(r => setTimeout(r, 100));
            dropTarget.dispatchEvent(dropEvent);
            
            return { success: true };
          } catch (err) {
            return { success: false, error: String(err) };
          }
        },
        base64Data,
        fileName,
        mimeType
      );

      if (result.success) {
        logger.debug('File dropped via drag-and-drop simulation', { fileName, mimeType });
        return true;
      } else {
        logger.debug('Drag-and-drop simulation failed', { error: result.error });
        return false;
      }
    } catch (error) {
      logger.debug('Error in simulateFileDrop', { error });
      return false;
    }
  }

  /**
   * Загрузка файла через FileInput с правильным MIME-типом
   * БЕЗ кликов на UI элементы (не открывает проводник)
   * Ищет существующие input[type="file"] на странице и устанавливает файл напрямую
   */
  private async uploadFileWithMimeType(
    page: Page,
    base64Data: string,
    fileName: string,
    mimeType: string,
    _fileType: 'image' | 'video' | 'document'
  ): Promise<boolean> {
    try {
      // НЕ кликаем на UI - ищем существующие input[type="file"] на странице
      // и устанавливаем файл напрямую через JavaScript
      const result = await page.evaluate(
        (b64: string, name: string, mime: string) => {
          try {
            // Ищем все file inputs на странице
            const fileInputs = document.querySelectorAll('input[type="file"]');
            if (fileInputs.length === 0) {
              return { success: false, error: 'No file inputs found on page' };
            }

            // Конвертируем base64 в ArrayBuffer
            const binaryString = atob(b64);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
              bytes[i] = binaryString.charCodeAt(i);
            }

            // Создаём File объект с правильным MIME-типом
            const file = new File([bytes.buffer], name, { type: mime });

            // Создаём DataTransfer и добавляем файл
            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(file);

            // Пробуем установить файлы во все найденные inputs
            let success = false;
            for (let i = fileInputs.length - 1; i >= 0; i--) {
              try {
                const input = fileInputs[i] as HTMLInputElement;
                input.files = dataTransfer.files;
                input.dispatchEvent(new Event('change', { bubbles: true }));
                input.dispatchEvent(new Event('input', { bubbles: true }));
                success = true;
                break;
              } catch {
                continue;
              }
            }

            return { success, error: success ? undefined : 'Could not set files to any input' };
          } catch (err) {
            return { success: false, error: String(err) };
          }
        },
        base64Data,
        fileName,
        mimeType
      );

      if (result.success) {
        logger.debug('File uploaded via direct input method', { fileName, mimeType });
        return true;
      } else {
        logger.debug('Direct input upload failed', { error: result.error });
        return false;
      }
    } catch (error) {
      logger.debug('Error in uploadFileWithMimeType', { error });
      return false;
    }
  }

  /**
   * Отправка файла через FileChooser.accept() - ЕДИНСТВЕННЫЙ надежный способ
   * 
   * ВАЖНО: DataTransfer метод НЕ работает для отправки в WhatsApp!
   * WhatsApp проверяет метаданные файла при отправке, и DataTransfer их не устанавливает правильно.
   * Файл загружается (есть предпросмотр), но при отправке - ошибка "файл не поддерживается".
   * 
   * FileChooser.accept() - это единственный способ, который правильно устанавливает все метаданные.
   * Чтобы предотвратить открытие диалога выбора файла - перехватываем FileChooser ДО клика.
   */
  private async sendFileViaFileChooser(
    page: Page, 
    absolutePath: string, 
    fileType: 'image' | 'video' | 'document'
  ): Promise<void> {
    const fileName = path.basename(absolutePath);
    const mimeType = this.getMimeType(absolutePath);

    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/4ab3c79e-9b19-4d80-b2e9-121229227ee9',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'whatsapp-sender.ts:1359',message:'sendFileViaFileChooser START',data:{fileType,fileName,pageClosed:page.isClosed(),pageUrl:page.url()},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A,B,C'})}).catch(()=>{});
    // #endregion

    logger.info('Starting file upload via FileChooser', { 
      absolutePath, 
      fileName, 
      mimeType, 
      fileType,
      profileId: page.url().includes('profileId') ? 'present' : 'not in URL'
    });

    // Проверяем состояние страницы перед началом
    if (page.isClosed()) {
      const errorMsg = 'Page is closed before file upload';
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/4ab3c79e-9b19-4d80-b2e9-121229227ee9',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'whatsapp-sender.ts:1375',message:'Page closed before upload',data:{fileType,error:errorMsg},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'E'})}).catch(()=>{});
      // #endregion
      throw new Error(errorMsg);
    }

    // Кликаем на кнопку прикрепления (+)
    logger.debug('Step 1: Clicking attach button', { fileType });
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/4ab3c79e-9b19-4d80-b2e9-121229227ee9',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'whatsapp-sender.ts:1380',message:'Before clickAttachButton',data:{fileType,pageClosed:page.isClosed(),pageUrl:page.url()},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A,B,C'})}).catch(()=>{});
    // #endregion
    const attachClicked = await this.clickAttachButton(page);
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/4ab3c79e-9b19-4d80-b2e9-121229227ee9',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'whatsapp-sender.ts:1383',message:'After clickAttachButton',data:{fileType,attachClicked,pageClosed:page.isClosed()},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A,B,C'})}).catch(()=>{});
    // #endregion
    if (!attachClicked) {
      const errorMsg = 'Could not click attach button - menu may not be available';
      logger.error(errorMsg, { fileType, url: page.url() });
      throw new Error(errorMsg);
    }
    logger.debug('Attach button clicked successfully', { fileType });
    
    // Увеличиваем задержку для стабильности при параллельной работе нескольких браузеров
    // Меню может появляться с задержкой, особенно при нагрузке
    await this.delay(800);
    
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/4ab3c79e-9b19-4d80-b2e9-121229227ee9',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'whatsapp-sender.ts:1390',message:'After delay before FileChooser',data:{fileType,pageClosed:page.isClosed(),pageUrl:page.url()},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A,B,C'})}).catch(()=>{});
    // #endregion

    // КРИТИЧНО: Запускаем waitForFileChooser СТРОГО ДО клика на пункт меню!
    // Это перехватывает диалог выбора файла и предотвращает открытие проводника Windows.
    logger.debug('Step 2: Setting up FileChooser interception', { fileType });
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/4ab3c79e-9b19-4d80-b2e9-121229227ee9',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'whatsapp-sender.ts:1395',message:'Before waitForFileChooser',data:{fileType,pageClosed:page.isClosed()},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
    // #endregion
    const fileChooserPromise = page.waitForFileChooser({ timeout: 10000 });
    
    // КРИТИЧНО: Кликаем на пункт меню и СРАЗУ проверяем результат
    // Если клик не прошел - FileChooser не появится, и мы не должны ждать его
    // clickMenuItem теперь сам ждет появления меню и делает retry
    logger.debug('Step 3: Clicking menu item with FileChooser interception', { fileType });
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/4ab3c79e-9b19-4d80-b2e9-121229227ee9',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'whatsapp-sender.ts:1403',message:'Before clickMenuItem',data:{fileType,pageClosed:page.isClosed()},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A,C'})}).catch(()=>{});
    // #endregion
    
    // Запускаем клик и перехват "одновременно", но проверяем результат клика
    const menuClickPromise = this.clickMenuItem(page, fileType);
    
    // Ждем оба Promise, но проверяем результат клика ПЕРВЫМ
    const [menuClickResult, fileChooserResult] = await Promise.allSettled([
      menuClickPromise,
      fileChooserPromise.catch((err) => {
        logger.warn('FileChooser promise rejected', { 
          error: err instanceof Error ? err.message : String(err) 
        });
        // #region agent log
        fetch('http://127.0.0.1:7243/ingest/4ab3c79e-9b19-4d80-b2e9-121229227ee9',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'whatsapp-sender.ts:1408',message:'FileChooser promise rejected',data:{fileType,error:err instanceof Error ? err.message : String(err),pageClosed:page.isClosed()},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B'})}).catch(()=>{});
        // #endregion
        return null;
      }),
    ]);

    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/4ab3c79e-9b19-4d80-b2e9-121229227ee9',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'whatsapp-sender.ts:1415',message:'After Promise.allSettled',data:{fileType,menuClickStatus:menuClickResult.status,fileChooserStatus:fileChooserResult.status,pageClosed:page.isClosed()},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A,B,C'})}).catch(()=>{});
    // #endregion

    // КРИТИЧЕСКАЯ ПРОВЕРКА: Если клик на пункт меню не прошел - FileChooser не появится
    const menuClickSuccess = menuClickResult.status === 'fulfilled' && menuClickResult.value === true;
    if (!menuClickSuccess) {
      const menuClickError = menuClickResult.status === 'rejected' 
        ? (menuClickResult.reason instanceof Error ? menuClickResult.reason.message : String(menuClickResult.reason))
        : 'Menu click returned false';
      const errorMsg = `Menu item click failed. Status: ${menuClickResult.status}, ` +
        `Error: ${menuClickError}. ` +
        `FileChooser will not appear. File: ${absolutePath}`;
      logger.error(errorMsg, { 
        fileType, 
        menuClickStatus: menuClickResult.status,
        menuClickValue: menuClickResult.status === 'fulfilled' ? menuClickResult.value : undefined,
        url: page.url()
      });
      throw new Error(errorMsg);
    }

    logger.debug('Menu item clicked successfully', { 
      fileType, 
      fileChooserStatus: fileChooserResult.status === 'fulfilled' ? 'fulfilled' : 'rejected'
    });

    // Проверяем FileChooser
    const fileChooser = fileChooserResult.status === 'fulfilled' ? fileChooserResult.value : null;
    if (fileChooser) {
      // FileChooser успешно перехвачен - используем accept() с путем к файлу
      logger.debug('Step 4: FileChooser intercepted successfully, accepting file', { absolutePath });
      try {
        await fileChooser.accept([absolutePath]);
        logger.info('File uploaded successfully via FileChooser.accept()', { fileName, mimeType });
        return;
      } catch (error) {
        const errorMsg = `FileChooser.accept() failed: ${error instanceof Error ? error.message : String(error)}`;
        logger.error(errorMsg, { 
          absolutePath,
          fileName,
          mimeType
        });
        throw new Error(errorMsg);
      }
    }

    // FileChooser не появился - это критическая ошибка
    // Без FileChooser мы не можем надежно загрузить файл в WhatsApp
    const fileChooserError = fileChooserResult.status === 'rejected'
      ? (fileChooserResult.reason instanceof Error ? fileChooserResult.reason.message : String(fileChooserResult.reason))
      : 'FileChooser returned null';
    const errorMsg = `FileChooser was not intercepted. ` +
      `Menu click: success, ` +
      `FileChooser: ${fileChooserResult.status === 'fulfilled' ? 'null' : 'rejected'} (${fileChooserError}). ` +
      `File: ${absolutePath}. ` +
      `This is required for reliable file upload in WhatsApp. ` +
      `Make sure the attach menu opened correctly.`;
    logger.error(errorMsg, { 
      fileType,
      menuClickSuccess: true,
      fileChooserStatus: fileChooserResult.status,
      fileChooserError,
      url: page.url()
    });
    throw new Error(errorMsg);
  }

  /**
   * Загрузка файла напрямую в input БЕЗ клика на пункт меню
   * Находит правильный input по атрибуту accept и устанавливает файл
   */
  private async uploadFileDirectlyToInput(
    page: Page,
    base64Data: string,
    fileName: string,
    mimeType: string,
    fileType: 'image' | 'video' | 'document'
  ): Promise<boolean> {
    try {
      const result = await page.evaluate(
        (b64: string, name: string, mime: string, fType: string) => {
          try {
            // Ищем все file inputs на странице
            const fileInputs = Array.from(document.querySelectorAll('input[type="file"]'));
            
            if (fileInputs.length === 0) {
              return { success: false, error: 'No file inputs found', inputCount: 0 };
            }

            // Находим подходящий input по атрибуту accept
            let targetInput: HTMLInputElement | null = null;
            
            for (const input of fileInputs) {
              const htmlInput = input as HTMLInputElement;
              const accept = htmlInput.getAttribute('accept') || '';
              
              // Для документов ищем input с accept="*" или application/*
              // Для изображений/видео ищем input с accept="image/*" или "video/*"
              if (fType === 'document') {
                if (accept === '*' || accept.includes('*') || accept.includes('application') || accept === '') {
                  targetInput = htmlInput;
                  break;
                }
              } else {
                if (accept.includes('image') || accept.includes('video') || accept === '*') {
                  targetInput = htmlInput;
                  break;
                }
              }
            }

            // Если не нашли по accept - берем последний input
            if (!targetInput) {
              targetInput = fileInputs[fileInputs.length - 1] as HTMLInputElement;
            }

            // Конвертируем base64 в ArrayBuffer
            const binaryString = atob(b64);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
              bytes[i] = binaryString.charCodeAt(i);
            }

            // Создаём File объект с правильным MIME-типом
            const file = new File([bytes.buffer], name, { type: mime });

            // Создаём DataTransfer и добавляем файл
            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(file);

            // Устанавливаем файлы в input
            targetInput.files = dataTransfer.files;
            
            // Диспатчим события
            targetInput.dispatchEvent(new Event('change', { bubbles: true }));
            targetInput.dispatchEvent(new Event('input', { bubbles: true }));

            return { 
              success: true, 
              inputCount: fileInputs.length,
              acceptAttr: targetInput.getAttribute('accept') || 'none'
            };
          } catch (err) {
            return { success: false, error: String(err), inputCount: 0 };
          }
        },
        base64Data,
        fileName,
        mimeType,
        fileType
      );

      if (result.success) {
        logger.debug('Direct input upload succeeded', { 
          fileName, 
          mimeType, 
          inputCount: result.inputCount,
          acceptAttr: result.acceptAttr 
        });
        return true;
      } else {
        logger.debug('Direct input upload failed', { 
          error: result.error, 
          inputCount: result.inputCount 
        });
        return false;
      }
    } catch (error) {
      logger.debug('Error in uploadFileDirectlyToInput', { 
        error: error instanceof Error ? error.message : String(error) 
      });
      return false;
    }
  }

  /**
   * Ожидание превью файла
   */
  private async waitForFilePreview(page: Page): Promise<boolean> {
    const maxChecks = 10;
    
    for (let i = 0; i < maxChecks; i++) {
      await this.delay(500);
      
      const hasPreview = await page.evaluate(() => {
        // Проверяем разные индикаторы загрузки файла
        const selectors = [
          'img[src*="blob"]',
          'video[src*="blob"]',
          '[data-testid*="media"]',
          '[class*="preview"]',
          '[class*="attachment"]',
        ];
        
        for (const sel of selectors) {
          if (document.querySelector(sel)) {
            return true;
          }
        }
        
        // Проверяем текст "Uploading" или "Загрузка"
        const bodyText = document.body.innerText ?? '';
        if (bodyText.includes('Uploading') || bodyText.includes('Загрузка')) {
          return true;
        }
        
        return false;
      });
      
      if (hasPreview) {
        logger.debug('File preview detected');
        return true;
      }
    }
    
    return false;
  }

  /**
   * Клик на кнопку отправки
   */
  private async clickSendButton(page: Page): Promise<void> {
    // Способ 1: Ищем через селекторы
    const sendButton = await this.findElement(page, SELECTORS.sendButton);
    
    if (sendButton) {
      // Если это span, ищем родительский кликабельный элемент
      const clicked = await page.evaluate((el) => {
        let current = el as HTMLElement;
        // Поднимаемся до кнопки или div с role="button"
        for (let i = 0; i < 10; i++) {
          if (current.tagName === 'BUTTON' || current.getAttribute('role') === 'button') {
            current.click();
            return 'parent';
          }
          if (!current.parentElement || current.tagName === 'BODY') {
            break;
          }
          current = current.parentElement;
        }
        // Если не нашли родителя, кликаем на сам элемент
        (el as HTMLElement).click();
        return 'self';
      }, sendButton);
      
      logger.debug('Send button clicked via selector', { method: clicked });
      return;
    }

    // Способ 2: Ищем через evaluate напрямую по всем возможным селекторам
    const clickedViaEvaluate = await page.evaluate(() => {
      // Ищем кнопку отправки для файла (окно превью)
      const selectors = [
        '[aria-label="Отправить"]',
        '[aria-label="Send"]',
        'span[data-icon="wds-ic-send-filled"]',
        'span[data-icon="send"]',
        '[data-testid="send"]',
      ];
      
      for (const sel of selectors) {
        const el = document.querySelector(sel);
        if (el) {
          // Находим кликабельный родитель
          let current = el as HTMLElement;
          for (let i = 0; i < 10; i++) {
            if (current.getAttribute('role') === 'button' || current.tagName === 'BUTTON') {
              current.click();
              return sel + ' (parent)';
            }
            if (!current.parentElement) break;
            current = current.parentElement;
          }
          // Кликаем на сам элемент
          (el as HTMLElement).click();
          return sel + ' (self)';
        }
      }
      return null;
    });

    if (clickedViaEvaluate) {
      logger.debug('Send button clicked via evaluate', { selector: clickedViaEvaluate });
      return;
    }

    // Способ 3: Fallback - отправляем через Enter
    logger.debug('Send button not found, using Enter key');
    await page.keyboard.press('Enter');
  }

  /**
   * Проверка регистрации номера в WhatsApp
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

      await this.openChat(page, phone);

      const alertExists = await page.$('div[role="alert"]').then(el => el !== null).catch(() => false);
      return !alertExists;
    } catch (error) {
      logger.error('Failed to check if number is registered', { phone, error });
      return false;
    }
  }

  /**
   * Обработка ошибок
   */
  handleErrors(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    return 'Unknown WhatsApp error';
  }
}
