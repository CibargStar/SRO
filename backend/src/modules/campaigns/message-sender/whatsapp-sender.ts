/**
 * WhatsApp Sender
 *
 * Реализация отправителя WhatsApp через Puppeteer и WhatsApp Web.
 * 
 * ВАЖНО: Для загрузки файлов используется ТОЛЬКО метод FileChooser.accept().
 * Другие методы (DataTransfer, drag-and-drop) НЕ работают с WhatsApp,
 * так как WhatsApp проверяет метаданные файла при отправке.
 */

import { MessengerType } from '@prisma/client';
import { Page, ElementHandle } from 'puppeteer';
import path from 'path';
import fs from 'fs/promises';
import logger from '../../../config/logger';
import { validatePhone } from './utils';
import type { ChromeProcessService } from '../../profiles/chrome-process/chrome-process.service';

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

      // Активируем вкладку WhatsApp перед отправкой
      await page.bringToFront();
      await this.delay(100);

      // Открываем чат с номером (передаём profileId для кэширования)
      await this.openChat(page, input.phone, input.profileId);

      // Отправляем текстовое сообщение
      if (input.text) {
        await this.sendTextMessage(page, input.text);
        const isSent = await this.verifyMessageSent(page, input.text);
        if (!isSent) {
          logger.warn('Text message verification failed, continuing with attachments', {
            phone: input.phone,
            hasAttachments: !!(input.attachments && input.attachments.length > 0)
          });
        }
      }

      // Отправляем вложения
      if (input.attachments && input.attachments.length > 0) {
        logger.info('Starting file attachments send', { 
          attachmentsCount: input.attachments.length,
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

          const inputField = document.querySelector(msgInputSel);
          const inputIsEmpty = !inputField?.textContent?.trim();

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
      if (chatHeader?.replace(/[^\d]/g, '').includes(normalizedPhone.slice(-7))) {
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
   * Поиск элемента по списку селекторов
   */
  private async findElement(page: Page, selectors: string[]): Promise<ElementHandle<Element> | null> {
    for (const selector of selectors) {
      const element = await page.$(selector);
      if (element) {
        return element;
      }
    }
    return null;
  }

  /**
   * Клик на кнопку прикрепления (+)
   * @returns true если клик успешен
   */
  private async clickAttachButton(page: Page): Promise<boolean> {
    if (page.isClosed()) {
      logger.warn('Page is closed in clickAttachButton');
      return false;
    }
    
    // Ищем кнопку через селекторы
    for (const selector of SELECTORS.attachButton) {
      try {
        const element = await page.$(selector);
        if (element) {
          // Если это span, ищем родительскую кнопку для надёжного клика
          if (selector.startsWith('span')) {
            const button = await page.evaluateHandle((el) => {
              let current = el as HTMLElement;
              while (current && current.tagName !== 'BUTTON') {
                if (!current.parentElement || current.tagName === 'BODY') { break; }
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
            if (!element || element.tagName === 'BODY') { break; }
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
   * Находит элемент пункта меню (Документ или Фото/видео)
   * НЕ кликает на него - только возвращает ElementHandle для последующего клика
   * 
   * @param fileType - тип файла для определения нужного пункта меню
   * @param timeout - таймаут поиска элемента (по умолчанию 10 секунд)
   * @returns ElementHandle элемента меню или null если не найден
   */
  private async findMenuItemElement(
    page: Page, 
    fileType: 'image' | 'video' | 'document',
    timeout: number = 10000
  ): Promise<ElementHandle<Element> | null> {
    const startTime = Date.now();
    const checkInterval = 150;
    
    // Селекторы для поиска
    const menuSelectors = fileType === 'document' 
      ? SELECTORS.menuItemDocument 
      : SELECTORS.menuItemPhoto;
    
    // Расширенный список языков для поиска (разные браузеры могут иметь разные языки)
    const ariaLabels = fileType === 'document' 
      ? ['Документ', 'Document', 'Documento', 'Dokument', 'Dokumentum', 'Dokumentas', 'Dokumenti']
      : ['Фото и видео', 'Photos & videos', 'Photos', 'Photo & video', 'Foto e video', 'Fotos y videos'];

    // Ключевые слова для поиска по тексту
    const textKeywords = fileType === 'document'
      ? ['document', 'документ', 'dokument', 'documento']
      : ['photo', 'video', 'фото', 'видео', 'foto', 'video'];

    logger.debug('Searching for menu item element', { fileType, ariaLabels, textKeywords });

    let lastDiagnosticTime = 0;
    const diagnosticInterval = 2000; // Диагностика каждые 2 секунды

    while (Date.now() - startTime < timeout) {
      if (page.isClosed()) {
        logger.warn('Page closed during menu item search');
        return null;
      }

      // Диагностика: логируем все элементы меню для отладки
      const now = Date.now();
      if (now - lastDiagnosticTime >= diagnosticInterval) {
        lastDiagnosticTime = now;
        try {
          const diagnosticInfo = await page.evaluate(() => {
            const menuItems = Array.from(document.querySelectorAll('[role="menuitem"], div[role="button"], button'));
            return menuItems.map(item => {
              const htmlItem = item as HTMLElement;
              return {
                tagName: htmlItem.tagName,
                ariaLabel: htmlItem.getAttribute('aria-label') ?? '',
                textContent: (htmlItem.textContent ?? '').trim().substring(0, 50),
                isVisible: htmlItem.offsetParent !== null,
                dataIcon: htmlItem.getAttribute('data-icon') ?? '',
                role: htmlItem.getAttribute('role') ?? '',
              };
            }).filter(item => item.isVisible);
          });
          logger.debug('Menu items diagnostic', { 
            fileType, 
            foundItems: diagnosticInfo.length,
            items: diagnosticInfo 
          });
        } catch (error) {
          logger.debug('Diagnostic failed', { error: error instanceof Error ? error.message : 'Unknown' });
        }
      }

      // Способ 1: Поиск через селекторы
      for (const selector of menuSelectors) {
        try {
          const element = await page.$(selector);
          if (element) {
            // Проверяем видимость
            const isVisible = await page.evaluate((el) => {
              const htmlEl = el as HTMLElement;
              if (!htmlEl) { return false; }
              const style = window.getComputedStyle(htmlEl);
              return htmlEl.offsetParent !== null && 
                     style.display !== 'none' && 
                     style.visibility !== 'hidden';
            }, element).catch(() => false);
            
            if (isVisible) {
              logger.debug('Found menu item via selector', { selector, fileType });
              return element;
            }
          }
        } catch {
          continue;
        }
      }

      // Способ 2: Поиск через aria-label (точное совпадение)
      for (const label of ariaLabels) {
        try {
          const element = await page.$(`[aria-label="${label}"]`);
          if (element) {
            const isVisible = await page.evaluate((el) => {
              const htmlEl = el as HTMLElement;
              if (!htmlEl) { return false; }
              const style = window.getComputedStyle(htmlEl);
              return htmlEl.offsetParent !== null && 
                     style.display !== 'none' && 
                     style.visibility !== 'hidden';
            }, element).catch(() => false);
            
            if (isVisible) {
              logger.debug('Found menu item via aria-label (exact)', { label, fileType });
              return element;
            }
          }
        } catch {
          continue;
        }
      }

      // Способ 3: Поиск через aria-label (частичное совпадение)
      for (const label of ariaLabels) {
        try {
          const element = await page.$(`[aria-label*="${label}"]`);
          if (element) {
            const isVisible = await page.evaluate((el) => {
              const htmlEl = el as HTMLElement;
              if (!htmlEl) { return false; }
              const style = window.getComputedStyle(htmlEl);
              return htmlEl.offsetParent !== null && 
                     style.display !== 'none' && 
                     style.visibility !== 'hidden';
            }, element).catch(() => false);
            
            if (isVisible) {
              logger.debug('Found menu item via aria-label (partial)', { label, fileType });
              return element;
            }
          }
        } catch {
          continue;
        }
      }

      // Способ 4: Поиск menuitem с подходящим aria-label
      const menuItemElement = await page.evaluateHandle((labels: string[]) => {
        const menuItems = Array.from(document.querySelectorAll('[role="menuitem"]'));
        for (const item of menuItems) {
          const ariaLabel = item.getAttribute('aria-label') ?? '';
          const htmlItem = item as HTMLElement;
          const isVisible = htmlItem.offsetParent !== null;
          
          if (isVisible) {
            for (const label of labels) {
              if (ariaLabel === label || ariaLabel.includes(label)) {
                return item;
              }
            }
          }
        }
        return null;
      }, ariaLabels);

      const menuItem = menuItemElement.asElement() as ElementHandle<Element> | null;
      if (menuItem) {
        logger.debug('Found menu item via menuitem role', { fileType });
        return menuItem;
      }

      // Способ 5: Поиск по тексту внутри элементов (для случаев, когда aria-label отсутствует)
      const textSearchElement = await page.evaluateHandle((keywords: string[]) => {
        // Ищем все видимые кликабельные элементы в меню
        const allElements = Array.from(document.querySelectorAll('[role="menuitem"], div[role="button"], button, div'));
        for (const el of allElements) {
          const htmlEl = el as HTMLElement;
          if (htmlEl.offsetParent === null) {
            continue; // Пропускаем невидимые
          }
          
          const text = (htmlEl.textContent ?? '').toLowerCase();
          const ariaLabel = (htmlEl.getAttribute('aria-label') ?? '').toLowerCase();
          const combinedText = `${text} ${ariaLabel}`;
          
          for (const keyword of keywords) {
            if (combinedText.includes(keyword.toLowerCase())) {
              // Проверяем, что это действительно элемент меню (не кнопка закрытия и т.д.)
              const parent = htmlEl.closest('[role="menu"], [role="listbox"], div[role="dialog"]');
              if (parent) {
                return el;
              }
            }
          }
        }
        return null;
      }, textKeywords);

      const textElement = textSearchElement.asElement() as ElementHandle<Element> | null;
      if (textElement) {
        logger.debug('Found menu item via text search', { fileType, textKeywords });
        return textElement;
      }

      await this.delay(checkInterval);
    }

    // Финальная диагностика перед возвратом null
    try {
      const finalDiagnostic = await page.evaluate(() => {
        const menuItems = Array.from(document.querySelectorAll('[role="menuitem"], div[role="button"], button'));
        return menuItems.map(item => {
          const htmlItem = item as HTMLElement;
          return {
            tagName: htmlItem.tagName,
            ariaLabel: htmlItem.getAttribute('aria-label') ?? '',
            textContent: (htmlItem.textContent ?? '').trim().substring(0, 50),
            isVisible: htmlItem.offsetParent !== null,
          };
        }).filter(item => item.isVisible);
      });
      logger.warn('Menu item element not found within timeout - final diagnostic', { 
        fileType, 
        timeout,
        foundItems: finalDiagnostic.length,
        items: finalDiagnostic 
      });
    } catch {
      logger.warn('Menu item element not found within timeout', { fileType, timeout });
    }

    return null;
  }

  /**
   * Отправка файла с вложением
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
   * Отправка файла через FileChooser.accept() - ЕДИНСТВЕННЫЙ надежный способ
   * 
   * ВАЖНО: FileChooser.accept() - единственный способ загрузки файлов в WhatsApp.
   * DataTransfer и другие методы НЕ работают - WhatsApp проверяет метаданные файла.
   * 
   * ИСПРАВЛЕНО: Race condition между waitForFileChooser и поиском элемента меню.
   * Теперь последовательность:
   * 1. Клик на кнопку прикрепления (+)
   * 2. Ожидание и поиск элемента меню (без клика)
   * 3. Запуск waitForFileChooser
   * 4. Клик на найденный элемент
   * 5. Получение FileChooser и accept файла
   */
  private async sendFileViaFileChooser(
    page: Page, 
    absolutePath: string, 
    fileType: 'image' | 'video' | 'document'
  ): Promise<void> {
    const fileName = path.basename(absolutePath);

    logger.info('Starting file upload via FileChooser', { 
      absolutePath, 
      fileName, 
      fileType
    });

    if (page.isClosed()) {
      throw new Error('Page is closed before file upload');
    }

    // ШАГ 1: Клик на кнопку прикрепления (+)
    logger.debug('Step 1: Clicking attach button');
    const attachClicked = await this.clickAttachButton(page);
    if (!attachClicked) {
      throw new Error('Could not click attach button');
    }
    
    // Небольшая задержка для появления меню
    await this.delay(500);

    // ШАГ 2: Найти элемент меню (БЕЗ клика)
    // Это критично - мы должны найти элемент ДО запуска waitForFileChooser
    logger.debug('Step 2: Finding menu item element', { fileType });
    const menuElement = await this.findMenuItemElement(page, fileType, 10000);
    
    if (!menuElement) {
      // Если элемент не найден, пробуем закрыть меню и попробовать снова
      logger.warn('Menu item not found on first attempt, retrying...', { fileType });
      
      // Нажимаем Escape чтобы закрыть меню
      await page.keyboard.press('Escape').catch(() => {});
      await this.delay(300);
      
      // Повторяем клик на кнопку прикрепления
      const retryAttachClicked = await this.clickAttachButton(page);
      if (!retryAttachClicked) {
        throw new Error('Could not click attach button on retry');
      }
      await this.delay(800);
      
      // Повторяем поиск элемента
      const retryMenuElement = await this.findMenuItemElement(page, fileType, 10000);
      if (!retryMenuElement) {
        throw new Error(`Menu item for ${fileType} not found after retry`);
      }
      
      // Используем найденный элемент на повторной попытке
      return this.clickMenuElementAndUpload(page, retryMenuElement, absolutePath, fileName, fileType);
    }

    // ШАГ 3-5: Клик на элемент и загрузка файла
    await this.clickMenuElementAndUpload(page, menuElement, absolutePath, fileName, fileType);
  }

  /**
   * Кликает на найденный элемент меню и загружает файл через FileChooser
   * Вспомогательный метод для sendFileViaFileChooser
   */
  private async clickMenuElementAndUpload(
    page: Page,
    menuElement: ElementHandle<Element>,
    absolutePath: string,
    fileName: string,
    fileType: 'image' | 'video' | 'document'
  ): Promise<void> {
    // ШАГ 3: Запуск waitForFileChooser ПЕРЕД кликом
    // Таймаут 15 секунд - достаточно для медленных систем
    logger.debug('Step 3: Setting up FileChooser interception');
    const fileChooserPromise = page.waitForFileChooser({ timeout: 15000 });
    
    // ШАГ 4: Клик на найденный элемент меню
    // Делаем это СРАЗУ после запуска waitForFileChooser
    logger.debug('Step 4: Clicking menu element');
    
    try {
      // Прокручиваем элемент в видимую область если нужно
      await page.evaluate((el) => {
        (el as HTMLElement).scrollIntoView({ block: 'center', behavior: 'instant' });
      }, menuElement).catch(() => {});
      await this.delay(50);
      
      // Кликаем на элемент
      await menuElement.click();
      logger.debug('Menu element clicked');
    } catch (clickError) {
      const errorMsg = clickError instanceof Error ? clickError.message : String(clickError);
      logger.error('Failed to click menu element', { fileType, error: errorMsg });
      throw new Error(`Failed to click menu element: ${errorMsg}`);
    }

    // ШАГ 5: Ожидание FileChooser и accept файла
    logger.debug('Step 5: Waiting for FileChooser');
    
    let fileChooser;
    try {
      fileChooser = await fileChooserPromise;
    } catch (fcError) {
      const errorMsg = `FileChooser was not intercepted: ${fcError instanceof Error ? fcError.message : String(fcError)}. ` +
        `File: ${absolutePath}. Make sure the attach menu opened correctly.`;
      logger.error(errorMsg, { fileType, fileName });
      throw new Error(errorMsg);
    }

    if (!fileChooser) {
      throw new Error(`FileChooser is null for file: ${absolutePath}`);
    }

    // Accept файл
    logger.debug('FileChooser intercepted, accepting file', { absolutePath });
    try {
      await fileChooser.accept([absolutePath]);
      logger.info('File uploaded successfully via FileChooser.accept()', { fileName, fileType });
    } catch (acceptError) {
      const errorMsg = `FileChooser.accept() failed: ${acceptError instanceof Error ? acceptError.message : String(acceptError)}`;
      logger.error(errorMsg, { absolutePath, fileName });
      throw new Error(errorMsg);
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
              return `${sel} (parent)`;
            }
            if (!current.parentElement) { break; }
            current = current.parentElement;
          }
          // Кликаем на сам элемент
          (el as HTMLElement).click();
          return `${sel} (self)`;
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
