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
  // Меню вложений (после клика на +)
  attachMenu: [
    'div[role="application"]', // Новый формат WhatsApp (2024+)
    '[role="menu"]',
    '[role="listbox"]',
    'div[role="dialog"]',
    'div[data-testid="menu"]',
  ],
  // Пункты меню вложений (после клика на +)
  menuItemDocument: [
    // Старый формат
    'div[aria-label="Документ"]',
    'div[aria-label="Document"]',
    '[role="menuitem"][aria-label="Документ"]',
    '[role="menuitem"][aria-label="Document"]',
  ],
  menuItemPhoto: [
    // Старый формат
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
   * Проверка и обработка модальных окон с ошибками (недействительный номер, контакт не существует и т.д.)
   * Проверяет различные типы ошибок WhatsApp перед попыткой открыть чат
   * Использует повторные попытки, так как модальное окно может появиться с задержкой
   * @returns true если модальное окно было обнаружено и закрыто, false если не найдено
   * @throws Error если модальное окно обнаружено (номер недействителен или контакт не существует)
   */
  private async checkAndHandleInvalidPhoneModal(page: Page, phone: string): Promise<boolean> {
    try {
      // Проверяем модальное окно с повторными попытками (до 3 секунд)
      const maxAttempts = 15;
      const checkInterval = 200;
      let modalInfo: { found: boolean; errorType?: string; ariaLabel?: string; textContent?: string; hasOkButton?: boolean } = { found: false };

      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        // Проверяем наличие модального окна с ошибкой
        modalInfo = await page.evaluate(() => {
          // Расширенный список ключевых слов для различных типов ошибок
          // 1. Недействительный номер телефона
          const invalidPhoneKeywords = [
            'недействителен',
            'invalid',
            'неверный',
            'incorrect',
            'номер телефона',
            'phone number',
            'отправленный по url',
            'sent via url',
          ];
          
          // 2. Контакт не существует / не зарегистрирован
          const contactNotFoundKeywords = [
            'не существует',
            'doesn\'t exist',
            'not exist',
            'не зарегистрирован',
            'not registered',
            'не найден',
            'not found',
            'не в whatsapp',
            'not on whatsapp',
            'не использует whatsapp',
            'doesn\'t use whatsapp',
            'не зарегистрирован в whatsapp',
            'not registered in whatsapp',
          ];
          
          // Объединяем все ключевые слова
          const allErrorKeywords = [...invalidPhoneKeywords, ...contactNotFoundKeywords];
          
          // ТОЧНЫЙ ПОИСК: Ищем модальное окно по точному селектору с aria-label
          // Это более надежный способ - ищем элемент с data-animate-modal-popup="true" 
          // и aria-label, содержащим ключевые слова
          const exactModalSelectors = [
            'div[data-animate-modal-popup="true"][aria-label*="недействителен"]',
            'div[data-animate-modal-popup="true"][aria-label*="invalid"]',
            'div[data-animate-modal-popup="true"][aria-label*="не существует"]',
            'div[data-animate-modal-popup="true"][aria-label*="not exist"]',
            'div[data-animate-modal-popup="true"][aria-label*="not registered"]',
            'div[data-animate-modal-popup="true"][aria-label*="не зарегистрирован"]',
          ];
          
          // Пробуем точные селекторы сначала
          for (const selector of exactModalSelectors) {
            const exactModal = document.querySelector(selector);
            if (exactModal) {
              const htmlModal = exactModal as HTMLElement;
              const style = window.getComputedStyle(htmlModal);
              const isVisible = htmlModal.offsetParent !== null && 
                               style.display !== 'none' && 
                               style.visibility !== 'hidden';
              
              if (isVisible) {
                const ariaLabel = htmlModal.getAttribute('aria-label') ?? '';
                const textContent = htmlModal.innerText ?? htmlModal.textContent ?? '';
                
                // Определяем тип ошибки
                const isContactNotFound = contactNotFoundKeywords.some(keyword => {
                  const normalizedKeyword = keyword.toLowerCase().trim();
                  const normalizedAriaLabel = ariaLabel.toLowerCase().replace(/&nbsp;/gi, ' ').replace(/\s+/g, ' ').trim();
                  const normalizedTextContent = textContent.toLowerCase().replace(/&nbsp;/gi, ' ').replace(/\s+/g, ' ').trim();
                  return normalizedAriaLabel.includes(normalizedKeyword) ||
                         normalizedTextContent.includes(normalizedKeyword);
                });
                
                const errorType = isContactNotFound ? 'contact_not_found' : 'invalid_phone';
                
                // Ищем кнопку OK
                const okButton = exactModal.querySelector('button') ?? 
                               exactModal.querySelector('[role="button"]') ??
                               Array.from(exactModal.querySelectorAll('button, [role="button"]')).find(btn => {
                                 const btnText = (btn as HTMLElement).textContent ?? '';
                                 return btnText.toLowerCase().includes('ok') || 
                                        btnText.toLowerCase().includes('ок');
                               });
                
                return {
                  found: true,
                  errorType,
                  ariaLabel,
                  textContent: textContent.substring(0, 200),
                  hasOkButton: !!okButton,
                };
              }
            }
          }
          
          // Если точные селекторы не сработали, используем общий поиск
          // Ищем ВСЕ модальные окна по data-animate-modal-popup
          const allModals = Array.from(document.querySelectorAll('div[data-animate-modal-popup="true"]'));
          
          // Также ищем через role="dialog"
          const dialogModals = Array.from(document.querySelectorAll('div[role="dialog"]'));
          
          // Объединяем все найденные модальные окна (убираем дубликаты)
          const allModalElements = Array.from(new Set([...allModals, ...dialogModals]));

          // Проверяем каждое модальное окно
          for (const modal of allModalElements) {
            const htmlModal = modal as HTMLElement;
            
            // Проверяем видимость модального окна
            const style = window.getComputedStyle(htmlModal);
            const isVisible = htmlModal.offsetParent !== null && 
                             style.display !== 'none' && 
                             style.visibility !== 'hidden';
            
            if (!isVisible) {
              continue; // Пропускаем невидимые модальные окна
            }

            // Получаем aria-label и весь текст из модального окна (включая дочерние элементы)
            const ariaLabel = htmlModal.getAttribute('aria-label') ?? '';
            // Используем innerText для получения видимого текста, включая дочерние элементы
            const textContent = htmlModal.innerText ?? htmlModal.textContent ?? '';
            
            // Нормализуем текст для поиска (убираем лишние пробелы и спецсимволы)
            // Важно: заменяем &nbsp; на пробел ДО нормализации
            const normalizedAriaLabel = ariaLabel.toLowerCase()
              .replace(/&nbsp;/gi, ' ')
              .replace(/\s+/g, ' ')
              .trim();
            const normalizedTextContent = textContent.toLowerCase()
              .replace(/&nbsp;/gi, ' ')
              .replace(/\s+/g, ' ')
              .trim();
            
            // Проверяем наличие ошибки через ключевые слова
            let hasError = allErrorKeywords.some(keyword => {
              const normalizedKeyword = keyword.toLowerCase().trim();
              return normalizedAriaLabel.includes(normalizedKeyword) ||
                     normalizedTextContent.includes(normalizedKeyword);
            });
            
            // Дополнительная проверка: если aria-label содержит "недействителен" или похожие слова напрямую
            // (на случай если ключевые слова не сработали из-за форматирования)
            if (!hasError && ariaLabel) {
              const directErrorPatterns = [
                /недействителен/i,
                /invalid/i,
                /неверный/i,
                /не существует/i,
                /doesn.*exist/i,
                /not.*exist/i,
                /not.*registered/i,
                /не зарегистрирован/i,
              ];
              hasError = directErrorPatterns.some(pattern => 
                pattern.test(ariaLabel) || pattern.test(textContent)
              );
            }

            if (hasError) {
              // Определяем тип ошибки
              const isContactNotFound = contactNotFoundKeywords.some(keyword => {
                const normalizedKeyword = keyword.toLowerCase().trim();
                return normalizedAriaLabel.includes(normalizedKeyword) ||
                       normalizedTextContent.includes(normalizedKeyword);
              });
              
              const errorType = isContactNotFound ? 'contact_not_found' : 'invalid_phone';

              // Ищем кнопку OK для закрытия
              const okButton = modal.querySelector('button') ?? 
                             modal.querySelector('[role="button"]') ??
                             Array.from(modal.querySelectorAll('button, [role="button"]')).find(btn => {
                               const btnText = (btn as HTMLElement).textContent ?? '';
                               return btnText.toLowerCase().includes('ok') || 
                                      btnText.toLowerCase().includes('ок');
                             });

              return {
                found: true,
                errorType,
                ariaLabel,
                textContent: textContent.substring(0, 200),
                hasOkButton: !!okButton,
              };
            }
          }

          return { found: false };
        });

        // Если модальное окно найдено, выходим из цикла
        if (modalInfo.found) {
          logger.debug('WhatsApp error modal found', { attempt: attempt + 1, phone });
          break;
        }

        // Если модальное окно не найдено, ждем перед следующей попыткой
        if (attempt < maxAttempts - 1) {
          await this.delay(checkInterval);
        }
      }

      // Если модальное окно не найдено после всех попыток, делаем финальную диагностику
      if (!modalInfo.found) {
        // Финальная диагностика: проверяем, есть ли вообще какие-то модальные окна
        const diagnosticInfo = await page.evaluate(() => {
          const modals = Array.from(document.querySelectorAll('div[data-animate-modal-popup="true"], div[role="dialog"]'));
          return modals.map(modal => {
            const htmlModal = modal as HTMLElement;
            const style = window.getComputedStyle(htmlModal);
            const isVisible = htmlModal.offsetParent !== null && 
                             style.display !== 'none' && 
                             style.visibility !== 'hidden';
            return {
              selector: modal.tagName,
              ariaLabel: htmlModal.getAttribute('aria-label') ?? '',
              textContent: (htmlModal.innerText ?? htmlModal.textContent ?? '').substring(0, 100),
              isVisible,
            };
          }).filter(m => m.isVisible);
        });

        if (diagnosticInfo.length > 0) {
          logger.warn('Modal windows found but not recognized as error modals', {
            phone,
            attempts: maxAttempts,
            modals: diagnosticInfo,
          });
        } else {
          logger.debug('No WhatsApp error modal found after all attempts', {
            phone,
            attempts: maxAttempts,
          });
        }
        return false;
      }

      if (modalInfo.found && 'errorType' in modalInfo) {
        logger.error('WhatsApp error modal detected', {
          phone,
          errorType: modalInfo.errorType,
          ariaLabel: modalInfo.ariaLabel,
          textContent: modalInfo.textContent,
        });

        // Закрываем модальное окно
        try {
          // Способ 1: Ищем и кликаем кнопку OK
          const okButtonClicked = await page.evaluate(() => {
            // Ищем кнопку OK в модальном окне
            const modal = document.querySelector('div[data-animate-modal-popup="true"]');
            if (!modal) {
              return false;
            }

            const buttons = Array.from(modal.querySelectorAll('button, [role="button"]'));
            for (const btn of buttons) {
              const btnText = (btn as HTMLElement).textContent ?? '';
              if (btnText.toLowerCase().includes('ok') || btnText.toLowerCase().includes('ок')) {
                (btn as HTMLElement).click();
                return true;
              }
            }
            return false;
          });

          if (!okButtonClicked) {
            // Способ 2: Нажимаем Escape
            await page.keyboard.press('Escape');
          }

          await this.delay(300);
          logger.debug('WhatsApp error modal closed', { errorType: modalInfo.errorType });
        } catch (closeError) {
          logger.warn('Failed to close WhatsApp error modal', {
            error: closeError instanceof Error ? closeError.message : 'Unknown',
            errorType: modalInfo.errorType,
          });
        }

        // Выбрасываем ошибку с понятным сообщением в зависимости от типа ошибки
        const errorText = modalInfo.textContent ?? modalInfo.ariaLabel ?? 'Unknown error';
        if (modalInfo.errorType === 'contact_not_found') {
          throw new Error(
            `Contact not found in WhatsApp: ${phone}. ` +
            `WhatsApp error: "${errorText}". ` +
            `This phone number is not registered in WhatsApp or doesn't exist.`
          );
        } else {
          throw new Error(
            `Invalid phone number: ${phone}. ` +
            `WhatsApp error: "${errorText}". ` +
            `Please check the phone number format and ensure it's valid.`
          );
        }
      }

      return false;
    } catch (error) {
      // Если это наша ошибка о недействительном номере или контакте - пробрасываем её дальше
      if (error instanceof Error && (
        error.message.includes('Invalid phone number') ||
        error.message.includes('Contact not found')
      )) {
        throw error;
      }
      // Иначе просто возвращаем false (модальное окно не найдено)
      logger.debug('Error checking for WhatsApp error modal', {
        error: error instanceof Error ? error.message : 'Unknown',
      });
      return false;
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

      // Проверяем наличие модального окна с ошибкой недействительного номера
      // Это должно быть сделано ДО ожидания поля ввода, так как при ошибке поле ввода не появится
      await this.checkAndHandleInvalidPhoneModal(page, phone);

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
    
    // Способ 1: Ищем через селекторы и используем page.click() для надежности
    for (const selector of SELECTORS.attachButton) {
      try {
        // Используем page.click() вместо element.click() - более надежно
        await page.click(selector).catch(() => null);
        
        // Проверяем, что клик сработал - ждем небольшую задержку
        await this.delay(100);
        
        // Проверяем, что элемент все еще существует (не был удален после клика)
        const element = await page.$(selector);
        if (element) {
          logger.debug('Clicked attach button via page.click', { selector });
          return true;
        }
      } catch {
        continue;
      }
    }

    // Способ 2: Ищем через селекторы и кликаем через element
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
              // Прокручиваем в видимую область перед кликом
              await page.evaluate((el) => {
                (el as HTMLElement).scrollIntoView({ block: 'center', behavior: 'instant' });
              }, buttonEl).catch(() => {});
              await this.delay(50);
              
              await (buttonEl as unknown as { click(): Promise<void> }).click();
              logger.debug('Clicked attach button via span parent', { selector });
              return true;
            }
          } else {
            // Прокручиваем в видимую область перед кликом
            await page.evaluate((el) => {
              (el as HTMLElement).scrollIntoView({ block: 'center', behavior: 'instant' });
            }, element).catch(() => {});
            await this.delay(50);
            
            await element.click();
            logger.debug('Clicked attach button', { selector });
            return true;
          }
        }
      } catch {
        continue;
      }
    }

    // Способ 3: Fallback через evaluate с более надежным кликом
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
            // Прокручиваем в видимую область
            element.scrollIntoView({ block: 'center', behavior: 'instant' });
            // Используем dispatchEvent для более надежного клика
            const clickEvent = new MouseEvent('click', {
              bubbles: true,
              cancelable: true,
              view: window,
            });
            element.dispatchEvent(clickEvent);
            // Также вызываем обычный click
            element.click();
            return true;
          }
        }
      }
      return false;
    });

    if (clicked) {
      logger.debug('Clicked attach button via evaluate fallback');
    }

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
    // ВАЖНО: для "Документ" используем только точные совпадения!
    const ariaLabels = fileType === 'document' 
      ? ['Документ', 'Document'] // Только основные варианты для точного совпадения
      : ['Фото и видео', 'Photos & videos', 'Photos', 'Photo & video', 'Foto e video', 'Fotos y videos'];

    // Ключевые слова для поиска по тексту
    const textKeywords = fileType === 'document'
      ? ['document', 'документ', 'dokument', 'documento']
      : ['photo', 'video', 'фото', 'видео', 'foto', 'video'];

    logger.debug('Searching for menu item element', { fileType, ariaLabels, textKeywords, timeout });

    let lastDiagnosticTime = 0;
    const diagnosticInterval = 2000; // Диагностика каждые 2 секунды
    let attemptCount = 0;

    while (Date.now() - startTime < timeout) {
      attemptCount++;
      if (page.isClosed()) {
        logger.warn('Page closed during menu item search');
        return null;
      }

      // Диагностика: логируем все элементы меню для отладки
      const now = Date.now();
      const elapsed = now - startTime;
      if (now - lastDiagnosticTime >= diagnosticInterval) {
        lastDiagnosticTime = now;
        try {
          const diagnosticInfo = await page.evaluate(() => {
            // Ищем меню контейнер (включая новый формат)
            const menuContainers = Array.from(document.querySelectorAll('div[role="application"], [role="menu"], [role="listbox"], div[role="dialog"]'));
            const menuItems = Array.from(document.querySelectorAll('li[role="button"], [role="menuitem"], div[role="button"], button'));
            return {
              menuContainers: menuContainers.map(item => {
                const htmlItem = item as HTMLElement;
                return {
                  tagName: htmlItem.tagName,
                  role: htmlItem.getAttribute('role') ?? '',
                  isVisible: htmlItem.offsetParent !== null,
                };
              }).filter(item => item.isVisible),
              menuItems: menuItems.map(item => {
                const htmlItem = item as HTMLElement;
                return {
                  tagName: htmlItem.tagName,
                  ariaLabel: htmlItem.getAttribute('aria-label') ?? '',
                  textContent: (htmlItem.textContent ?? '').trim().substring(0, 50),
                  isVisible: htmlItem.offsetParent !== null,
                  dataIcon: htmlItem.getAttribute('data-icon') ?? '',
                  role: htmlItem.getAttribute('role') ?? '',
                };
              }).filter(item => item.isVisible),
            };
          });
          logger.debug('Menu items diagnostic', { 
            fileType, 
            elapsed: `${elapsed}ms`,
            attempts: attemptCount,
            menuContainers: diagnosticInfo.menuContainers.length,
            foundItems: diagnosticInfo.menuItems.length,
            containers: diagnosticInfo.menuContainers,
            items: diagnosticInfo.menuItems 
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

      // Способ 5: Поиск нового формата WhatsApp (li[role="button"] с текстом в span)
      const newFormatElement = await page.evaluateHandle((labels: string[]) => {
        // Ищем все li[role="button"] элементы (новый формат WhatsApp)
        const menuButtons = Array.from(document.querySelectorAll('li[role="button"]'));
        
        // Сначала ищем точные совпадения
        const exactMatches: Array<{ element: Element; label: string }> = [];
        const partialMatches: Array<{ element: Element; label: string }> = [];
        
        for (const li of menuButtons) {
          const htmlLi = li as HTMLElement;
          if (htmlLi.offsetParent === null) {
            continue; // Пропускаем невидимые
          }
          
          // Проверяем, что это действительно меню прикрепления (есть контейнер с role="application")
          const parent = htmlLi.closest('div[role="application"], [role="menu"], [role="listbox"]');
          if (!parent) {
            continue; // Пропускаем элементы вне меню прикрепления
          }
          
          // Ищем текст во всех span внутри li
          // Важно: ищем span с текстом, который точно совпадает с искомыми метками
          const spans = li.querySelectorAll('span');
          let foundText = '';
          let foundExactMatch = false;
          
          // Сначала проверяем точные совпадения в каждом span
          for (let i = 0; i < spans.length; i++) {
            const span = spans[i] as HTMLElement;
            const text = (span.textContent ?? '').trim();
            
            // Проверяем точное совпадение с каждой меткой
            for (const label of labels) {
              const normalizedText = text.toLowerCase().trim();
              const normalizedLabel = label.toLowerCase().trim();
              
              // Точное совпадение - это то, что нам нужно!
              if (normalizedText === normalizedLabel) {
                foundText = text;
                foundExactMatch = true;
                exactMatches.push({ element: li, label });
                break; // Нашли точное совпадение, выходим из циклов
              }
            }
            
            if (foundExactMatch) {
              break; // Уже нашли точное совпадение
            }
            
            // Если точного совпадения нет, сохраняем самый длинный текст для частичного совпадения
            if (text.length > foundText.length) {
              foundText = text;
            }
          }
          
          // Если нашли точное совпадение, пропускаем частичные проверки
          if (foundExactMatch) {
            continue;
          }
          
          if (!foundText) {
            continue; // Пропускаем элементы без текста
          }
          
          // Проверяем частичные совпадения только если точного не было
          for (const label of labels) {
            const normalizedFound = foundText.toLowerCase().trim();
            const normalizedLabel = label.toLowerCase().trim();
            
            // Частичное совпадение (только для длинных меток, чтобы избежать ложных срабатываний)
            // НО: для "Документ" и "Document" используем только точное совпадение!
            if (normalizedLabel === 'документ' || normalizedLabel === 'document') {
              // Для "Документ" и "Document" не используем частичные совпадения
              continue;
            }
            
            if (normalizedFound.includes(normalizedLabel) && normalizedLabel.length >= 5) {
              // Используем частичное совпадение только для длинных меток (>= 5 символов)
              partialMatches.push({ element: li, label });
            }
          }
        }
        
        // Возвращаем точное совпадение, если есть
        // Приоритет: сначала "Документ"/"Document", потом другие
        if (exactMatches.length > 0) {
          // Ищем совпадение с "Документ" или "Document" в первую очередь
          const documentMatch = exactMatches.find(m => 
            m.label.toLowerCase() === 'документ' || m.label.toLowerCase() === 'document'
          );
          if (documentMatch) {
            return documentMatch.element;
          }
          // Если не нашли "Документ", возвращаем первое точное совпадение
          return exactMatches[0].element;
        }
        
        // Иначе возвращаем первое частичное совпадение (но только если это не "Документ")
        if (partialMatches.length > 0) {
          // Для "Документ" не используем частичные совпадения - это критично!
          const nonDocumentMatches = partialMatches.filter(m => 
            m.label.toLowerCase() !== 'документ' && m.label.toLowerCase() !== 'document'
          );
          if (nonDocumentMatches.length > 0) {
            return nonDocumentMatches[0].element;
          }
        }
        
        return null;
      }, ariaLabels);

      const newFormatEl = newFormatElement.asElement() as ElementHandle<Element> | null;
      if (newFormatEl) {
        // Логируем найденный элемент для отладки
        const foundText = await page.evaluate((el) => {
          const spans = el.querySelectorAll('span');
          let text = '';
          for (let i = 0; i < spans.length; i++) {
            const span = spans[i] as HTMLElement;
            const spanText = (span.textContent ?? '').trim();
            if (spanText.length > text.length) {
              text = spanText;
            }
          }
          return text;
        }, newFormatEl).catch(() => 'unknown');
        
        logger.debug('Found menu item via new WhatsApp format (li[role="button"])', { 
          fileType, 
          foundText,
          expectedLabels: ariaLabels,
          warning: foundText.toLowerCase().includes('опрос') ? 'WARNING: Found "Опрос" instead of "Документ"!' : undefined
        });
        
        // Дополнительная проверка: если нашли "Опрос" вместо "Документ", это ошибка!
        if (fileType === 'document' && foundText.toLowerCase().includes('опрос')) {
          logger.error('CRITICAL: Found "Опрос" instead of "Документ"! This should not happen.', {
            fileType,
            foundText,
            expectedLabels: ariaLabels
          });
          // Продолжаем поиск дальше, не возвращаем неправильный элемент
          // Это позволит попробовать другие способы поиска
        } else {
          return newFormatEl;
        }
      }

      // Способ 6: Поиск по тексту внутри элементов (для случаев, когда aria-label отсутствует)
      const textSearchElement = await page.evaluateHandle((keywords: string[]) => {
        // Ищем все видимые кликабельные элементы в меню
        const allElements = Array.from(document.querySelectorAll('[role="menuitem"], li[role="button"], div[role="button"], button, div'));
        
        const exactMatches: Element[] = [];
        const partialMatches: Element[] = [];
        
        for (const el of allElements) {
          const htmlEl = el as HTMLElement;
          if (htmlEl.offsetParent === null) {
            continue; // Пропускаем невидимые
          }
          
          // Проверяем, что это действительно элемент меню (не кнопка закрытия и т.д.)
          const parent = htmlEl.closest('[role="application"], [role="menu"], [role="listbox"], div[role="dialog"]');
          if (!parent) {
            continue; // Пропускаем элементы вне меню
          }
          
          const text = (htmlEl.textContent ?? '').toLowerCase().trim();
          const ariaLabel = (htmlEl.getAttribute('aria-label') ?? '').toLowerCase().trim();
          const combinedText = `${text} ${ariaLabel}`.trim();
          
          for (const keyword of keywords) {
            const normalizedKeyword = keyword.toLowerCase().trim();
            
            // Точное совпадение (приоритет) - проверяем отдельно текст и aria-label
            if (text === normalizedKeyword || ariaLabel === normalizedKeyword) {
              exactMatches.push(el);
              break; // Нашли точное совпадение
            }
            // Частичное совпадение (только если точного нет и ключевое слово >= 3 символов)
            else if (normalizedKeyword.length >= 3 && combinedText.includes(normalizedKeyword)) {
              partialMatches.push(el);
            }
          }
        }
        
        // Возвращаем точное совпадение, если есть
        if (exactMatches.length > 0) {
          return exactMatches[0];
        }
        
        // Иначе возвращаем первое частичное совпадение
        if (partialMatches.length > 0) {
          return partialMatches[0];
        }
        
        return null;
      }, textKeywords);

      const textElement = textSearchElement.asElement() as ElementHandle<Element> | null;
      if (textElement) {
        // Логируем найденный элемент для отладки
        const foundText = await page.evaluate((el) => {
          const htmlEl = el as HTMLElement;
          return (htmlEl.textContent ?? '').trim().substring(0, 50);
        }, textElement).catch(() => 'unknown');
        
        logger.debug('Found menu item via text search', { 
          fileType, 
          foundText,
          expectedKeywords: textKeywords 
        });
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
    
    // ШАГ 1.5: Ждем появления меню перед поиском элементов
    logger.debug('Step 1.5: Waiting for menu to appear');
    let menuAppeared = false;
    
    // Способ 1: Ждем появления контейнера меню
    for (const menuSelector of SELECTORS.attachMenu) {
      try {
        await page.waitForSelector(menuSelector, { timeout: 3000, visible: true }).catch(() => null);
        const menuExists = await page.$(menuSelector);
        if (menuExists) {
          const isVisible = await page.evaluate((el) => {
            const htmlEl = el as HTMLElement;
            if (!htmlEl) { return false; }
            const style = window.getComputedStyle(htmlEl);
            return htmlEl.offsetParent !== null && 
                   style.display !== 'none' && 
                   style.visibility !== 'hidden';
          }, menuExists).catch(() => false);
          if (isVisible) {
            menuAppeared = true;
            logger.debug('Menu container appeared', { selector: menuSelector });
            break;
          }
        }
      } catch {
        continue;
      }
    }
    
    // Способ 2: Ждем появления элементов меню напрямую (более надежно)
    if (!menuAppeared) {
      logger.debug('Menu container not found, waiting for menu items directly');
      const menuItemsAppeared = await page.waitForFunction(
        () => {
          const menuItems = document.querySelectorAll('[role="menuitem"]');
          return menuItems.length > 0;
        },
        { timeout: 5000 }
      ).catch(() => null);
      
      if (menuItemsAppeared) {
        menuAppeared = true;
        logger.debug('Menu items appeared directly');
      }
    }
    
    // Дополнительная задержка для загрузки элементов меню (особенно важно для медленных браузеров)
    if (menuAppeared) {
      await this.delay(1000); // Увеличено до 1 секунды для надежности
      logger.debug('Menu appeared, waiting for items to be ready');
    } else {
      logger.warn('Menu container not found, but continuing with longer delay', { fileType });
      await this.delay(2000); // Увеличена задержка, если меню не найдено
    }

    // ШАГ 2: Найти элемент меню (БЕЗ клика)
    // Это критично - мы должны найти элемент ДО запуска waitForFileChooser
    logger.debug('Step 2: Finding menu item element', { fileType, menuAppeared });
    const menuElement = await this.findMenuItemElement(page, fileType, 15000); // Увеличено с 10 до 15 секунд
    
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
      
      // Ждем появления меню при повторной попытке
      logger.debug('Retry: Waiting for menu to appear');
      let retryMenuAppeared = false;
      
      // Способ 1: Ждем контейнер меню
      for (const menuSelector of SELECTORS.attachMenu) {
        try {
          await page.waitForSelector(menuSelector, { timeout: 3000, visible: true }).catch(() => null);
          const menuExists = await page.$(menuSelector);
          if (menuExists) {
            const isVisible = await page.evaluate((el) => {
              const htmlEl = el as HTMLElement;
              if (!htmlEl) { return false; }
              const style = window.getComputedStyle(htmlEl);
              return htmlEl.offsetParent !== null && 
                     style.display !== 'none' && 
                     style.visibility !== 'hidden';
            }, menuExists).catch(() => false);
            if (isVisible) {
              retryMenuAppeared = true;
              logger.debug('Menu container appeared on retry', { selector: menuSelector });
              break;
            }
          }
        } catch {
          continue;
        }
      }
      
      // Способ 2: Ждем элементы меню напрямую
      if (!retryMenuAppeared) {
        const menuItemsAppeared = await page.waitForFunction(
          () => {
            const menuItems = document.querySelectorAll('[role="menuitem"]');
            return menuItems.length > 0;
          },
          { timeout: 5000 }
        ).catch(() => null);
        
        if (menuItemsAppeared) {
          retryMenuAppeared = true;
          logger.debug('Menu items appeared on retry');
        }
      }
      
      await this.delay(retryMenuAppeared ? 1200 : 2500); // Увеличена задержка
      
      // Повторяем поиск элемента
      const retryMenuElement = await this.findMenuItemElement(page, fileType, 15000); // Увеличено с 10 до 15 секунд
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
