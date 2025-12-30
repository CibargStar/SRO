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

      // Убеждаемся, что страница готова (особенно важно для первого контакта)
      // Проверяем, что страница не закрыта и загружена
      if (page.isClosed()) {
        throw new Error('Page is closed');
      }

      // Получаем текущий URL страницы
      let currentUrl = page.url();
      
      // Если страница еще не загружена на базовый URL WhatsApp, сначала загружаем его
      if (!currentUrl.includes('web.whatsapp.com')) {
        logger.debug('Page not on WhatsApp Web, navigating to base URL first', { currentUrl });
        await page.goto('https://web.whatsapp.com', { waitUntil: 'networkidle2', timeout: 30000 });
        // Даем время для инициализации WhatsApp Web
        await this.delay(2000);
        // Обновляем currentUrl после навигации
        currentUrl = page.url();
      }

      // URL для открытия чата в WhatsApp Web
      const chatUrl = `https://web.whatsapp.com/send?phone=${normalizedPhone}`;

      logger.debug('Navigating to chat URL', { phone: normalizedPhone, chatUrl });

      // Проверяем, не находимся ли мы уже в этом чате
      if (currentUrl.includes(`phone=${normalizedPhone}`)) {
        logger.debug('Already in the correct chat, skipping navigation', { phone: normalizedPhone });
      } else {
        // Переходим на страницу чата
        // Используем waitForNavigation для гарантии, что навигация завершена
        await Promise.all([
          page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => {
            // Если waitForNavigation не сработал, это может быть нормально для некоторых случаев
          }),
          page.goto(chatUrl, { waitUntil: 'networkidle2', timeout: 30000 }),
        ]);

        // Дополнительное ожидание для обработки параметров WhatsApp Web
        await this.delay(1500);
      }

      // Ждем, пока загрузится интерфейс чата
      // Селектор для поля ввода сообщения
      // Увеличиваем таймаут для первого контакта, так как WhatsApp Web может загружаться дольше
      const messageInputSelector = 'div[contenteditable="true"][data-tab="10"]';
      await page.waitForSelector(messageInputSelector, { timeout: 20000 });

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
   * Логика аналогична Telegram sender, но с учетом особенностей WhatsApp (contenteditable div)
   */
  private async sendTextMessage(page: Page, text: string): Promise<void> {
    try {
      // Селектор для поля ввода сообщения WhatsApp
      const messageInputSelector = 'div[contenteditable="true"][data-tab="10"]';

      // Ждем появления поля ввода сообщения
      await page.waitForSelector(messageInputSelector, { timeout: 10000 });

      // Фокусируемся на поле ввода
      await page.focus(messageInputSelector);
      await this.delay(200);

      // Очищаем поле ввода (если там что-то есть)
      await page.click(messageInputSelector, { clickCount: 3 });
      await this.delay(100);
      await page.keyboard.press('Backspace');
      await this.delay(200);

      // Вводим текст через evaluate с прямым изменением DOM (более надежно для contenteditable)
      const textEntered = await page.evaluate((selector, textToType) => {
        // @ts-expect-error
        const input = document.querySelector(selector);
        if (!input) return false;
        
        // Фокусируемся на поле
        input.focus();
        
        // Очищаем поле
        // @ts-expect-error
        const selection = window.getSelection();
        // @ts-expect-error
        const range = document.createRange();
        range.selectNodeContents(input);
        selection.removeAllRanges();
        selection.addRange(range);
        // @ts-expect-error
        document.execCommand('delete', false, null);
        
        // Устанавливаем текст через insertText
        try {
          // @ts-expect-error
          document.execCommand('insertText', false, textToType);
        } catch (e) {
          // Fallback: прямое изменение DOM
          // @ts-expect-error
          let pElement = input.querySelector('p');
          if (!pElement) {
            // @ts-expect-error
            pElement = document.createElement('p');
            input.innerHTML = '';
            input.appendChild(pElement);
          }
          pElement.textContent = textToType;
          // @ts-expect-error
          input.dispatchEvent(new InputEvent('input', { bubbles: true, cancelable: true, inputType: 'insertText', data: textToType }));
        }
        
        // Проверяем, что текст установлен
        const actualText = (input.textContent || input.innerText || '').trim();
        return actualText === textToType.trim();
      }, messageInputSelector, text);

      if (!textEntered) {
        // Если evaluate не сработал, пробуем keyboard.type
        logger.debug('Text not entered via evaluate, trying keyboard.type', { textLength: text.length });
        await page.focus(messageInputSelector);
        await this.delay(200);
        
        // Очищаем еще раз
        await page.click(messageInputSelector, { clickCount: 3 });
        await this.delay(100);
        await page.keyboard.press('Backspace');
        await this.delay(200);
        
        // Вводим текст символ за символом
        for (const char of text) {
          await page.keyboard.type(char, { delay: 50 });
        }
        await this.delay(300);
        
        // Проверяем, что текст введен
        const textInField = await page.evaluate((selector) => {
          // @ts-expect-error
          const input = document.querySelector(selector);
          return input ? (input.textContent || input.innerText || '').trim() : '';
        }, messageInputSelector);
        
        if (textInField !== text.trim()) {
          logger.warn('Text was not entered into input field', { 
            textLength: text.length,
            expectedText: text.substring(0, 50),
            actualText: textInField.substring(0, 50)
          });
          throw new Error('Failed to enter text into input field');
        }
      }

      // Небольшая задержка перед отправкой
      await this.delay(500);

      // Отправляем сообщение (Enter)
      await page.keyboard.press('Enter');
      
      // Ждем, пока поле ввода станет пустым (сообщение отправлено)
      await this.delay(1000);

      // Проверяем, что поле ввода пустое
      const inputIsEmpty = await page.evaluate((selector) => {
        // @ts-expect-error
        const input = document.querySelector(selector);
        return input ? (!input.textContent || input.textContent.trim() === '') : false;
      }, messageInputSelector);

      if (!inputIsEmpty) {
        logger.warn('Input field is not empty after sending, message may not have been sent', { 
          textLength: text.length
        });
        // Не бросаем ошибку, так как сообщение могло быть отправлено, но поле еще не очистилось
      }

      logger.debug('WhatsApp text message sent', { textLength: text.length });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to send WhatsApp text message', { error: errorMsg });
      throw new Error(`Failed to send text message: ${errorMsg}`);
    }
  }

  /**
   * Проверка, что сообщение действительно отправлено
   * Проверяем: 1) поле ввода пустое, 2) сообщение появилось в чате, 3) есть индикаторы отправки
   */
  private async verifyMessageSent(page: Page, text: string): Promise<boolean> {
    try {
      // Ждем появления сообщения в чате
      const maxWaitTime = 5000; // 5 секунд максимум
      const checkInterval = 200; // проверяем каждые 200мс
      const maxChecks = maxWaitTime / checkInterval;

      for (let i = 0; i < maxChecks; i++) {
        // Проверяем несколько условий для надежности
        const verification = await page.evaluate((searchText) => {
          // @ts-expect-error
          const allText = document.body.innerText || '';
          const textFound = allText.includes(searchText.substring(0, 50));
          
          // Проверяем, что поле ввода пустое
          // @ts-expect-error
          const inputField = document.querySelector('div[contenteditable="true"][data-tab="10"]');
          const inputIsEmpty = !inputField || !inputField.textContent || inputField.textContent.trim() === '';
          
          // Проверяем наличие индикаторов отправки (галочки)
          // @ts-expect-error
          const sentIndicators = document.querySelectorAll('span[data-icon="msg-dblcheck"], span[data-icon="msg-check"]');
          const hasIndicators = sentIndicators.length > 0;
          
          // Ищем сообщение в контейнере сообщений
          // @ts-expect-error
          const messages = document.querySelectorAll('div[data-testid="msg-container"]');
          let foundInMessages = false;
          if (messages.length > 0) {
            const lastMessage = messages[messages.length - 1];
            const lastMessageText = lastMessage.textContent || '';
            foundInMessages = lastMessageText.includes(searchText.substring(0, 50));
          }
          
          return {
            textFound,
            inputIsEmpty,
            hasIndicators,
            foundInMessages,
            messagesCount: messages.length
          };
        }, text);

        // Сообщение считается отправленным, если:
        // 1. Текст найден в чате И поле ввода пустое
        // ИЛИ
        // 2. Текст найден в последнем сообщении И есть индикаторы отправки
        if ((verification.textFound && verification.inputIsEmpty) || 
            (verification.foundInMessages && verification.hasIndicators)) {
          logger.debug('Message verified as sent', { 
            textLength: text.length,
            textFound: verification.textFound,
            inputIsEmpty: verification.inputIsEmpty,
            foundInMessages: verification.foundInMessages,
            hasIndicators: verification.hasIndicators
          });
          return true;
        }

        await this.delay(checkInterval);
      }

      logger.warn('Message verification failed - message not found in chat', { 
        textLength: text.length,
        lastCheck: await page.evaluate(() => {
          // @ts-expect-error
          const inputField = document.querySelector('div[contenteditable="true"][data-tab="10"]');
          // @ts-expect-error
          const messages = document.querySelectorAll('div[data-testid="msg-container"]');
          return {
            inputIsEmpty: !inputField || !inputField.textContent || inputField.textContent.trim() === '',
            messagesCount: messages.length
          };
        })
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
   * Отправка файла/вложений через создание input[type="file"]
   * Это самый надежный способ - создаем скрытый input и триггерим FileChooser
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

      logger.debug('Sending WhatsApp file via input file method', { 
        originalPath: attachmentPath, 
        absolutePath,
        fileExists 
      });

      // Ждем появления поля ввода (чтобы убедиться, что чат открыт)
      const messageInputSelector = 'div[contenteditable="true"][data-tab="10"]';
      await page.waitForSelector(messageInputSelector, { timeout: 10000 });
      await this.delay(500);

      // Используем кнопку прикрепления для открытия FileChooser
      // Это более надежный способ, так как использует нативный интерфейс WhatsApp
      logger.debug('Looking for attach button to trigger file chooser');
      
      // Ищем кнопку прикрепления
      const attachButtonSelectors = [
        'button[aria-label="Прикрепить"]',
        'button[aria-label="Attach"]',
        'button[aria-label*="Прикрепить"]',
        'button[aria-label*="Attach"]',
        'span[data-icon="plus-rounded"]',
        'span[data-icon="attach"]',
      ];
      
      let attachButton = null;
      
      // Пробуем найти кнопку прикрепления
      for (const selector of attachButtonSelectors) {
        try {
          attachButton = await page.$(selector);
          if (attachButton) {
            logger.debug('Found attach button with selector', { selector });
            // Если это span, ищем родительскую кнопку
            if (selector.includes('span[data-icon')) {
              attachButton = await page.evaluateHandle((spanElement) => {
                // @ts-expect-error
                let element = spanElement;
                while (element && element.tagName !== 'BUTTON') {
                  element = element.parentElement;
                  if (!element || element.tagName === 'BODY') break;
                }
                return element;
              }, attachButton);
            }
            if (attachButton && attachButton.asElement()) {
              break;
            }
          }
        } catch (e) {
          // Продолжаем поиск
        }
      }

      // Если не нашли кнопку, используем альтернативный способ
      if (!attachButton || !attachButton.asElement()) {
        logger.debug('Attach button not found, using input file method');
        
        // Создаем input[type="file"] и триггерим FileChooser
        const [fileChooser] = await Promise.all([
          page.waitForFileChooser({ timeout: 15000 }),
          page.evaluate(() => {
            // @ts-expect-error
            const input = document.createElement('input');
            input.type = 'file';
            input.style.position = 'fixed';
            input.style.top = '0';
            input.style.left = '0';
            input.style.width = '1px';
            input.style.height = '1px';
            input.style.opacity = '0';
            input.style.pointerEvents = 'none';
            // @ts-expect-error
            document.body.appendChild(input);
            // @ts-expect-error
            input.click();
            setTimeout(() => {
              try {
                // @ts-expect-error
                if (input.parentNode) {
                  // @ts-expect-error
                  document.body.removeChild(input);
                }
              } catch (e) {
                // Игнорируем ошибки
              }
            }, 1000);
          }),
        ]);

        logger.debug('File chooser opened via input, accepting file', { absolutePath });
        await fileChooser.accept([absolutePath]);
      } else {
        // Используем кнопку прикрепления
        logger.debug('Using attach button to open file chooser');
        
        // Определяем тип файла по расширению
        const fileExt = absolutePath.split('.').pop()?.toLowerCase() || '';
        const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(fileExt);
        const isVideo = ['mp4', 'avi', 'mov', 'webm'].includes(fileExt);
        
        logger.debug('File type detection', {
          fileExt,
          isImage,
          isVideo,
          fileType: isImage ? 'image' : isVideo ? 'video' : 'document'
        });
        
        // Кликаем на кнопку прикрепления и сразу ждем FileChooser
        // FileChooser может открыться либо сразу, либо после выбора пункта меню
        logger.debug('Clicking attach button and waiting for file chooser');
        
        try {
          // Пробуем открыть FileChooser с таймаутом
          const [fileChooser] = await Promise.all([
            page.waitForFileChooser({ timeout: 5000 }).catch(() => null),
            attachButton.asElement()!.click(),
          ]);
          
          if (fileChooser) {
            // FileChooser открылся сразу
            logger.debug('File chooser opened immediately, accepting file', { absolutePath });
            await fileChooser.accept([absolutePath]);
          } else {
            // FileChooser не открылся сразу, значит появилось меню
            logger.debug('File chooser did not open immediately, waiting for menu');
            await this.delay(800);
            
            // Ждем появления меню
            try {
              await page.waitForSelector('div[role="menuitem"]', { timeout: 3000 });
            } catch (e) {
              logger.warn('Menu did not appear after clicking attach button');
            }
            
            // Определяем, какой пункт меню нужно выбрать
            let menuSelector = '';
            
            if (isImage || isVideo) {
              // Для фото и видео используем "Фото и видео"
              menuSelector = 'div[aria-label="Фото и видео"][role="menuitem"]';
              logger.debug('File is image or video, selecting "Фото и видео" menu item', {
                fileExt,
                isImage,
                isVideo,
                selector: menuSelector
              });
            } else {
              // Для документов используем "Документ"
              menuSelector = 'div[aria-label="Документ"][role="menuitem"]';
              logger.debug('File is document, selecting "Документ" menu item', {
                fileExt,
                selector: menuSelector
              });
            }
            
            // Ищем и кликаем на нужный пункт меню
            let menuItemClicked = false;
            
            // Сначала проверяем, есть ли вообще элементы меню
            const menuItemsCount = await page.evaluate(() => {
              // @ts-expect-error - DOM manipulation in browser context
              return document.querySelectorAll('div[role="menuitem"]').length;
            });
            
            logger.debug('Menu items found', { count: menuItemsCount });
            
            if (menuItemsCount === 0) {
              logger.warn('No menu items found, menu may not have appeared');
            }
            
            try {
              // Пробуем найти элемент через Puppeteer
              const menuItem = await page.$(menuSelector);
              if (menuItem) {
                logger.debug('Found menu item with Puppeteer selector, attempting click', { selector: menuSelector });
                
                // Пробуем несколько способов клика
                try {
                  // Способ 1: Обычный клик через Puppeteer
                  await menuItem.click();
                  logger.debug('Clicked menu item using Puppeteer click');
                  menuItemClicked = true;
                } catch (clickError) {
                  logger.warn('Puppeteer click failed, trying JavaScript click', { error: clickError });
                  
                  // Способ 2: JavaScript click через evaluate
                  const jsClickWorked = await page.evaluate((selector) => {
                    // @ts-expect-error - DOM manipulation in browser context
                    const element = document.querySelector(selector);
                    if (element) {
                      // @ts-expect-error
                      element.click();
                      return true;
                    }
                    return false;
                  }, menuSelector);
                  
                  if (jsClickWorked) {
                    logger.debug('Clicked menu item using JavaScript click');
                    menuItemClicked = true;
                  }
                }
              } else {
                logger.warn('Menu item not found with selector, trying alternative selectors', { selector: menuSelector });
                
                // Пробуем альтернативные селекторы
                const alternativeSelectors = isImage || isVideo
                  ? [
                      'div[aria-label="Фото и видео"]',
                      'div[role="menuitem"][aria-label*="Фото"]',
                      'div[role="menuitem"][aria-label*="видео"]',
                      'div[role="menuitem"][aria-label*="Photo"]',
                      'div[role="menuitem"][aria-label*="Video"]',
                    ]
                  : [
                      'div[aria-label="Документ"]',
                      'div[role="menuitem"][aria-label*="Документ"]',
                      'div[role="menuitem"][aria-label*="Document"]',
                    ];
                
                for (const altSelector of alternativeSelectors) {
                  const altMenuItem = await page.$(altSelector);
                  if (altMenuItem) {
                    logger.debug('Found menu item with alternative selector, clicking', { selector: altSelector });
                    try {
                      await altMenuItem.click();
                      menuItemClicked = true;
                      break;
                    } catch (e) {
                      // Пробуем JavaScript click
                      const jsClickWorked = await page.evaluate((selector) => {
                        // @ts-expect-error - DOM manipulation in browser context
                        const element = document.querySelector(selector);
                        if (element) {
                          // @ts-expect-error
                          element.click();
                          return true;
                        }
                        return false;
                      }, altSelector);
                      
                      if (jsClickWorked) {
                        menuItemClicked = true;
                        break;
                      }
                    }
                  }
                }
              }
            } catch (error) {
              logger.error('Error clicking menu item', { error, selector: menuSelector });
            }
            
            // Если не удалось кликнуть через селекторы, пробуем найти по тексту и SVG
            if (!menuItemClicked) {
              logger.debug('Trying to find and click menu item by SVG title and text content');
              
              const textClickWorked = await page.evaluate((isImage, isVideo) => {
                // Способ 1: Ищем по SVG title (более надежно для документов)
                if (!isImage && !isVideo) {
                  // @ts-expect-error - DOM manipulation in browser context
                  const svgTitles = document.querySelectorAll('svg title');
                  for (const title of svgTitles) {
                    // @ts-expect-error
                    if (title.textContent === 'ic-description-filled') {
                      // @ts-expect-error
                      let parent = title.parentElement;
                      let attempts = 0;
                      while (parent && attempts < 15) {
                        // @ts-expect-error
                        if (parent.getAttribute('role') === 'menuitem') {
                          // Пробуем несколько способов клика
                          try {
                            // @ts-expect-error
                            parent.click();
                            return true;
                          } catch (e) {
                            // Пробуем через dispatchEvent
                            // @ts-expect-error - DOM manipulation in browser context
                            const clickEvent = new MouseEvent('click', {
                              bubbles: true,
                              cancelable: true,
                              // @ts-expect-error - window is available in browser context
                              view: window
                            });
                            // @ts-expect-error - DOM manipulation in browser context
                            parent.dispatchEvent(clickEvent);
                            return true;
                          }
                        }
                        // @ts-expect-error
                        parent = parent.parentElement;
                        attempts++;
                      }
                    }
                  }
                }
                
                // Способ 2: Ищем span с точным текстом "Документ" или "Фото и видео"
                // @ts-expect-error
                const allSpans = document.querySelectorAll('span');
                
                for (const span of allSpans) {
                  // @ts-expect-error
                  const text = (span.textContent || '').trim();
                  
                  let shouldClick = false;
                  
                  if (isImage || isVideo) {
                    if (text === 'Фото и видео') {
                      shouldClick = true;
                    }
                  } else {
                    if (text === 'Документ') {
                      shouldClick = true;
                    }
                  }
                  
                  if (shouldClick) {
                    // Поднимаемся к родителю с role="menuitem"
                    // @ts-expect-error
                    let parent = span.parentElement;
                    let attempts = 0;
                    while (parent && attempts < 15) {
                      // @ts-expect-error
                      const role = parent.getAttribute('role');
                      // @ts-expect-error
                      const ariaLabel = parent.getAttribute('aria-label');
                      
                      // @ts-expect-error
                      if (role === 'menuitem' || (ariaLabel && (ariaLabel.includes('Документ') || ariaLabel.includes('Document') || 
                          ariaLabel.includes('Фото') || ariaLabel.includes('Photo') || ariaLabel.includes('видео') || ariaLabel.includes('Video')))) {
                        try {
                          // @ts-expect-error
                          parent.click();
                          return true;
                        } catch (e) {
                          // Пробуем через dispatchEvent
                          // @ts-expect-error - DOM manipulation in browser context
                          const clickEvent = new MouseEvent('click', {
                            bubbles: true,
                            cancelable: true,
                            // @ts-expect-error - window is available in browser context
                            view: window
                          });
                          // @ts-expect-error - DOM manipulation in browser context
                          parent.dispatchEvent(clickEvent);
                          return true;
                        }
                      }
                      // @ts-expect-error
                      parent = parent.parentElement;
                      attempts++;
                    }
                  }
                }
                
                // Способ 3: Ищем через menuItems по тексту
                // @ts-expect-error
                const menuItems = document.querySelectorAll('div[role="menuitem"]');
                for (const item of menuItems) {
                  // @ts-expect-error
                  const text = (item.textContent || '').trim().toLowerCase();
                  // @ts-expect-error
                  const ariaLabel = (item.getAttribute('aria-label') || '').toLowerCase();
                  
                  if (isImage || isVideo) {
                    if (text.includes('фото') || text.includes('видео') || text.includes('photo') || text.includes('video') ||
                        ariaLabel.includes('фото') || ariaLabel.includes('видео') || ariaLabel.includes('photo') || ariaLabel.includes('video')) {
                      try {
                        // @ts-expect-error
                        item.click();
                        return true;
                      } catch (e) {
                        // @ts-expect-error
                        const clickEvent = new MouseEvent('click', { bubbles: true, cancelable: true, view: window });
                        // @ts-expect-error
                        item.dispatchEvent(clickEvent);
                        return true;
                      }
                    }
                  } else {
                    if (text.includes('документ') || text.includes('document') || 
                        ariaLabel.includes('документ') || ariaLabel.includes('document')) {
                      try {
                        // @ts-expect-error
                        item.click();
                        return true;
                      } catch (e) {
                        // @ts-expect-error
                        const clickEvent = new MouseEvent('click', { bubbles: true, cancelable: true, view: window });
                        // @ts-expect-error
                        item.dispatchEvent(clickEvent);
                        return true;
                      }
                    }
                  }
                }
                return false;
              }, isImage, isVideo);
              
              if (textClickWorked) {
                logger.debug('Clicked menu item by SVG title or text content');
                menuItemClicked = true;
              } else {
                logger.warn('Could not find menu item by SVG title or text content');
              }
            }
            
            if (!menuItemClicked) {
              logger.warn('Could not find or click menu item, trying to click first available menuitem');
              // Пробуем кликнуть на первый видимый элемент меню
              const firstItemClicked = await page.evaluate(() => {
                // @ts-expect-error - DOM manipulation in browser context
                const menuItems = document.querySelectorAll('div[role="menuitem"]');
                for (const item of menuItems) {
                  // @ts-expect-error
                  if (item.offsetParent !== null) {
                    // @ts-expect-error
                    item.click();
                    return true;
                  }
                }
                return false;
              });
              
              if (firstItemClicked) {
                logger.debug('Clicked first available menu item');
                menuItemClicked = true;
              } else {
                // Пробуем сделать скриншот для отладки
                logger.error('Could not find or click any menu item. Menu may not have appeared.');
                throw new Error('Could not find or click any menu item. Menu may not have appeared.');
              }
            }
            
            if (menuItemClicked) {
              logger.debug('Menu item clicked successfully, waiting for file chooser');
              await this.delay(1000); // Увеличиваем задержку
              
              // Проверяем, появился ли input[type="file"] после клика
              const inputAppeared = await page.evaluate(() => {
                // @ts-expect-error - DOM manipulation in browser context
                const inputs = document.querySelectorAll('input[type="file"]');
                return inputs.length;
              });
              
              logger.debug('Input[type="file"] count after menu click', { count: inputAppeared });
              
              // Теперь ждем FileChooser после выбора пункта меню
              logger.debug('Waiting for file chooser after menu selection');
              
              try {
                const fileChooser2 = await page.waitForFileChooser({ timeout: 15000 });
                logger.debug('File chooser opened after menu selection, accepting file', { absolutePath });
                await fileChooser2.accept([absolutePath]);
              } catch (chooserError) {
                logger.warn('FileChooser timeout after menu click, trying alternative methods', { 
                  error: chooserError instanceof Error ? chooserError.message : 'Unknown error'
                });
                
                // Если FileChooser не открылся, пробуем найти input[type="file"] который мог появиться
                const inputFound = await page.evaluate(() => {
                  // @ts-expect-error - DOM manipulation in browser context
                  const inputs = document.querySelectorAll('input[type="file"]');
                  if (inputs.length > 0) {
                    // Берем последний input (скорее всего, это тот, который появился после клика)
                    // @ts-expect-error
                    const lastInput = inputs[inputs.length - 1];
                    // @ts-expect-error
                    lastInput.click();
                    return true;
                  }
                  return false;
                });
                
                if (inputFound) {
                  // Если нашли input и кликнули, ждем FileChooser еще раз
                  logger.debug('Found and clicked input[type="file"], waiting for file chooser');
                  try {
                    const fileChooser3 = await page.waitForFileChooser({ timeout: 15000 });
                    await fileChooser3.accept([absolutePath]);
                  } catch (e) {
                    throw new Error('FileChooser did not open even after clicking input[type="file"]. File may not be attached.');
                  }
                } else {
                  throw new Error('FileChooser did not open and no input[type="file"] found. File may not be attached.');
                }
              }
            }
          }
        } catch (error) {
          // Если все методы не сработали, пробуем использовать CDP для прямого взаимодействия
          logger.warn('Standard file chooser method failed, trying alternative approach', { error });
          throw error;
        }
      }
      
      // Ждем загрузки файла (появление превью или индикатора загрузки)
      // Проверяем несколько раз, так как загрузка может занять время
      let fileAttached = false;
      const maxChecks = 10;
      const checkInterval = 500;
      
      for (let i = 0; i < maxChecks; i++) {
        await this.delay(checkInterval);
        
        fileAttached = await page.evaluate(() => {
          // Проверяем наличие превью файла
          // @ts-expect-error
          const previews = document.querySelectorAll(
            '[class*="preview"]', 
            '[class*="media"]', 
            '[class*="file"]', 
            '[data-testid*="media"]',
            '[class*="attachment"]',
            '[class*="document"]',
            'img[src*="blob"]',
            'video[src*="blob"]'
          );
          
          // Проверяем наличие индикаторов загрузки
          // @ts-expect-error
          const bodyText = document.body.innerText || '';
          const hasUploading = bodyText.includes('Uploading') || bodyText.includes('Загрузка');
          
          // Проверяем, что поле ввода не пустое (может содержать имя файла)
          // @ts-expect-error
          const input = document.querySelector('div[contenteditable="true"][data-tab="10"]');
          const inputHasContent = input && (input.textContent || '').trim().length > 0;
          
          // Проверяем наличие элементов с именем файла
          // @ts-expect-error
          const fileNames = document.querySelectorAll('[class*="filename"], [class*="file-name"], [title*="."]');
          
          return previews.length > 0 || hasUploading || (inputHasContent && fileNames.length > 0);
        });
        
        if (fileAttached) {
          logger.debug('File attachment detected', { checkNumber: i + 1 });
          break;
        }
      }

      if (!fileAttached) {
        logger.warn('File attachment not detected after multiple checks', { 
          maxChecks,
          absolutePath 
        });
        // Продолжаем все равно, возможно файл прикрепился, но мы не видим индикаторов
      }

      // Ждем еще немного для завершения загрузки
      await this.delay(1000);

      // Селекторы для кнопки отправки файла
      const sendButtonSelectors = [
        'span[data-icon="send"]',
        'button[aria-label*="Send"]',
        'button[title*="Send"]',
        '[data-testid="send"]',
        'div[role="button"][title*="Send"]',
        'div[role="button"][aria-label*="Send"]',
      ];
      
      let sendButton = null;
      
      // Пробуем найти кнопку отправки по разным селекторам
      for (const selector of sendButtonSelectors) {
        try {
          sendButton = await page.$(selector);
          if (sendButton) {
            logger.debug('Found send button with selector', { selector });
            break;
          }
        } catch (e) {
          // Продолжаем поиск
        }
      }

      // Если не найдена через селекторы, пробуем найти через evaluate
      if (!sendButton) {
        logger.debug('Send button not found with selectors, trying alternative methods');
        sendButton = await page.evaluateHandle(() => {
          // @ts-expect-error
          const spans = document.querySelectorAll('span[data-icon]');
          for (const span of spans) {
            const icon = span.getAttribute('data-icon');
            if (icon === 'send') {
              // Ищем родительскую кнопку
              let element = span.parentElement;
              while (element && element.tagName !== 'BUTTON' && element.tagName !== 'DIV') {
                element = element.parentElement;
              }
              if (element) return element;
            }
          }
          return null;
        });
      }

      if (sendButton && sendButton.asElement()) {
        logger.debug('Clicking send button');
        await sendButton.asElement()!.click();
      } else {
        // Альтернативный способ: отправка через Enter
        logger.debug('Send button not found, trying Enter key');
        await page.keyboard.press('Enter');
      }

      // Ждем подтверждения отправки
      await this.delay(2000);

      logger.debug('WhatsApp file message sent successfully', { 
        attachmentPath: absolutePath 
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to send WhatsApp file message', { 
        attachmentPath, 
        error: errorMsg,
        stack: error instanceof Error ? error.stack : undefined
      });
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

