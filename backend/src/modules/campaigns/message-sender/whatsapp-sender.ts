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
      validatePhone(input.phone);

      if (!input.profileId) {
        throw new Error('Profile ID is required for WhatsApp sending');
      }

      if (!this.chromeProcessService) {
        throw new Error('ChromeProcessService is not available');
      }

      const page = await this.chromeProcessService.getOrCreateMessengerPage(
        input.profileId,
        'whatsapp',
        'https://web.whatsapp.com'
      );

      if (!page) {
        throw new Error('Failed to get WhatsApp page for profile');
      }

      // ВАЖНО: Активируем вкладку WhatsApp перед отправкой
      // Это гарантирует, что мы работаем именно с этой вкладкой,
      // даже если мониторинг статуса переключил фокус
      await page.bringToFront();
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
    // Ищем кнопку через селекторы
    for (const selector of SELECTORS.attachButton) {
      try {
        const element = await page.$(selector);
        if (element) {
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
   * Клик на пункт меню вложений (Документ или Фото)
   */
  private async clickMenuItem(page: Page, fileType: 'image' | 'video' | 'document'): Promise<boolean> {
    // Определяем aria-label в зависимости от типа файла
    const ariaLabels = fileType === 'document' 
      ? ['Документ', 'Document']
      : ['Фото и видео', 'Photos & videos', 'Photos'];

    logger.debug('Looking for menu item', { fileType, ariaLabels });

    // Способ 1: Ищем через селекторы
    const menuSelectors = fileType === 'document' 
      ? SELECTORS.menuItemDocument 
      : SELECTORS.menuItemPhoto;

    for (const selector of menuSelectors) {
      try {
        const element = await page.$(selector);
        if (element) {
          await element.click();
          logger.debug('Clicked menu item via selector', { selector, fileType });
          return true;
        }
      } catch {
        continue;
      }
    }

    // Способ 2: Ищем через evaluate по aria-label
    const clicked = await page.evaluate((labels: string[]) => {
      // Ищем по aria-label
      for (const label of labels) {
        const el = document.querySelector(`[aria-label="${label}"]`);
        if (el) {
          (el as HTMLElement).click();
          return label;
        }
      }
      
      // Fallback: ищем menuitem с нужным текстом
      const menuItems = Array.from(document.querySelectorAll('[role="menuitem"]'));
      for (const item of menuItems) {
        const ariaLabel = item.getAttribute('aria-label') ?? '';
        for (const label of labels) {
          if (ariaLabel.includes(label) || ariaLabel === label) {
            (item as HTMLElement).click();
            return ariaLabel;
          }
        }
      }
      
      return null;
    }, ariaLabels);

    if (clicked) {
      logger.debug('Clicked menu item via evaluate', { clicked, fileType });
      return true;
    }

    logger.warn('Could not find menu item', { fileType, ariaLabels });
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
   * Отправка файла с гарантированным MIME-типом
   * Стратегия: загружаем файл НАПРЯМУЮ в input без клика на пункт меню
   * Это предотвращает открытие диалога выбора файла во всех браузерах
   */
  private async sendFileViaFileChooser(
    page: Page, 
    absolutePath: string, 
    fileType: 'image' | 'video' | 'document'
  ): Promise<void> {
    // Читаем файл и готовим данные с правильным MIME-типом ЗАРАНЕЕ
    const mimeType = this.getMimeType(absolutePath);
    const fileName = path.basename(absolutePath);
    const fileBuffer = await fs.readFile(absolutePath);
    const base64Data = fileBuffer.toString('base64');

    logger.info('Starting file upload', { absolutePath, fileName, mimeType, fileType });

    // Кликаем на кнопку прикрепления (+) - это откроет меню с input элементами
    const attachClicked = await this.clickAttachButton(page);
    if (!attachClicked) {
      throw new Error('Could not click attach button');
    }
    await this.delay(500);

    // СТРАТЕГИЯ 1: Загружаем файл НАПРЯМУЮ через input БЕЗ клика на пункт меню
    // Это предотвращает открытие диалога выбора файла
    // Находим нужный input и устанавливаем файл через DataTransfer
    const directUploadSuccess = await this.uploadFileDirectlyToInput(page, base64Data, fileName, mimeType, fileType);
    
    if (directUploadSuccess) {
      logger.info('File uploaded directly to input (no dialog)', { fileName, mimeType });
      return;
    }

    logger.debug('Direct input upload failed, trying with menu click', { fileName });

    // СТРАТЕГИЯ 2: Если прямая загрузка не сработала - кликаем на пункт меню
    // но перехватываем FileChooser чтобы предотвратить открытие проводника
    const fileChooserPromise = page.waitForFileChooser({ timeout: 5000 }).catch(() => null);
    
    await this.clickMenuItem(page, fileType);
    
    const fileChooser = await fileChooserPromise;

    if (fileChooser) {
      // FileChooser перехвачен - используем его accept() с путем к файлу
      // Это единственный надежный способ "закрыть" FileChooser
      logger.debug('FileChooser intercepted, using accept()', { absolutePath });
      try {
        await fileChooser.accept([absolutePath]);
        logger.info('File uploaded via FileChooser.accept()', { absolutePath, fileName });
        return;
      } catch (error) {
        logger.warn('FileChooser.accept() failed', { 
          error: error instanceof Error ? error.message : String(error) 
        });
      }
    }

    // СТРАТЕГИЯ 3: Fallback - пробуем загрузить через input после клика на меню
    await this.delay(500);
    const fallbackSuccess = await this.uploadFileWithMimeType(page, base64Data, fileName, mimeType, fileType);
    
    if (fallbackSuccess) {
      logger.info('File uploaded via fallback MIME type method', { fileName, mimeType });
      return;
    }

    throw new Error(
      `Could not upload file. File: ${absolutePath}, Type: ${fileType}. ` +
      `All upload strategies failed. FileChooser: ${fileChooser ? 'intercepted' : 'not available'}.`
    );
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
