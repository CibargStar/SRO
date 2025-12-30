/**
 * Менеджер процессов Chrome
 * 
 * Управляет жизненным циклом Chrome процессов через Puppeteer.
 * Обеспечивает изоляцию процессов и управление ресурсами.
 * 
 * @module modules/profiles/chrome-process/chrome-process.manager
 */

import puppeteer, { Browser, LaunchOptions, Page } from 'puppeteer';
import { kill } from 'process';
import { existsSync } from 'fs';
import logger from '../../../config/logger';

/**
 * Конфигурация запуска Chrome
 */
export interface ChromeLaunchConfig {
  /** Путь к директории профиля Chrome */
  userDataDir: string;
  /** Headless режим (без UI) */
  headless?: boolean;
  /** Аргументы запуска Chrome */
  args?: string[];
  /** Лимиты ресурсов */
  resourceLimits?: {
    /** Максимальное использование CPU (0-1) */
    cpu?: number;
    /** Максимальное использование памяти в MB */
    memory?: number;
  };
}

/**
 * Информация о запущенном процессе Chrome
 */
export interface ChromeProcessInfo {
  /** ID профиля */
  profileId: string;
  /** Browser instance */
  browser: Browser;
  /** Главная страница (fallback) */
  page: Page;
  /** Карта вкладок для мессенджеров (serviceName -> Page) */
  messengerPages: Map<string, Page>;
  /** PID процесса Chrome */
  pid?: number;
  /** Время запуска */
  startedAt: Date;
  /** Статус процесса */
  status: 'running' | 'stopping' | 'stopped' | 'error';
}

/**
 * Callback для обработки неожиданного закрытия браузера
 */
export type BrowserDisconnectCallback = (profileId: string) => void;

/**
 * Менеджер процессов Chrome
 */
export class ChromeProcessManager {
  private processes: Map<string, ChromeProcessInfo> = new Map();
  private disconnectCallback?: BrowserDisconnectCallback;

  /**
   * Установка callback для обработки неожиданного закрытия браузера
   * 
   * @param callback - Функция, вызываемая при disconnected событии
   */
  setDisconnectCallback(callback: BrowserDisconnectCallback): void {
    this.disconnectCallback = callback;
  }

  /**
   * Получение пути к системному Chrome в зависимости от ОС
   * 
   * Ищет Chrome в стандартных путях установки.
   * Если Chrome не найден - возвращает undefined (будет использован Chromium от Puppeteer).
   * 
   * @returns Путь к Chrome или undefined
   */
  private getChromePath(): string | undefined {
    const platform = process.platform;
    
    const chromePaths: string[] = [];
    
    if (platform === 'win32') {
      // Windows
      chromePaths.push(
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`,
      );
    } else if (platform === 'darwin') {
      // macOS
      chromePaths.push(
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        '/Applications/Chromium.app/Contents/MacOS/Chromium',
      );
    } else {
      // Linux
      chromePaths.push(
        '/usr/bin/google-chrome',
        '/usr/bin/google-chrome-stable',
        '/usr/bin/chromium',
        '/usr/bin/chromium-browser',
        '/snap/bin/chromium',
      );
    }
    
    for (const chromePath of chromePaths) {
      if (existsSync(chromePath)) {
        logger.debug('Found Chrome at path', { chromePath, platform });
        return chromePath;
      }
    }
    
    logger.warn('Chrome not found in standard paths, using Puppeteer bundled Chromium', { platform });
    return undefined;
  }

  /**
   * Запуск Chrome процесса для профиля
   * 
   * @param profileId - ID профиля
   * @param config - Конфигурация запуска
   * @returns Информация о запущенном процессе
   */
  async launchChrome(profileId: string, config: ChromeLaunchConfig): Promise<ChromeProcessInfo> {
    try {
      // Проверка, не запущен ли уже процесс для этого профиля
      const existing = this.processes.get(profileId);
      if (existing) {
        // Проверяем реальное состояние процесса
        if (existing.status === 'running' && existing.browser && !existing.browser.isConnected()) {
          // Процесс помечен как running, но браузер отключен - очищаем и запускаем заново
          logger.warn('Chrome process marked as running but browser is disconnected, cleaning up', { profileId });
          this.processes.delete(profileId);
        } else if (existing.status === 'running' && existing.browser?.isConnected()) {
          // Процесс действительно запущен
          logger.debug('Chrome process already running for profile', { profileId });
          return existing;
        } else if (existing.status === 'stopping') {
          // Процесс останавливается - ждем завершения или очищаем
          logger.warn('Chrome process is stopping, cleaning up before restart', { profileId });
          this.processes.delete(profileId);
        } else {
          // Процесс в состоянии stopped или error - очищаем и запускаем заново
          logger.debug('Chrome process exists but not running, cleaning up', { profileId, status: existing.status });
          this.processes.delete(profileId);
        }
      }

      logger.info('Launching Chrome process', { profileId, userDataDir: config.userDataDir });

      // ИСПОЛЬЗУЕМ СИСТЕМНЫЙ CHROME вместо Chromium от Puppeteer
      // Chromium от Puppeteer имеет проблемы с CacheStorage на Windows
      const headlessMode = config.headless ?? false;
      
      // Определение пути к Chrome в зависимости от ОС
      const chromePath = this.getChromePath();
      
      const launchOptions: LaunchOptions = {
        headless: headlessMode,
        ...(chromePath ? { executablePath: chromePath } : {}), // Используем системный Chrome, если найден
        userDataDir: config.userDataDir,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
        ],
      };

      // Запуск браузера
      const browser = await puppeteer.launch(launchOptions);

      // Получение PID процесса (если доступно)
      // ВАЖНО: не использовать имя переменной process, чтобы не перекрывать глобальный объект Node.js
      const browserProcess = browser.process();
      const pid = browserProcess?.pid;

      // Создание новой страницы
      const page = await browser.newPage();

      // МИНИМАЛЬНАЯ КОНФИГУРАЦИЯ - без дополнительных настроек
      // Только базовые таймауты
      page.setDefaultNavigationTimeout(60000);
      page.setDefaultTimeout(60000);

      // ПРИМЕЧАНИЕ: resourceLimits из config не применяются здесь, так как Chrome не поддерживает
      // ограничение ресурсов через аргументы запуска. Лимиты используются только для:
      // 1. Мониторинга через ResourceMonitorService
      // 2. Проверки превышения лимитов после запуска
      // Для реального ограничения ресурсов нужны системные средства (cgroups, Job Objects и т.д.)

      // Информация о процессе
      const processInfo: ChromeProcessInfo = {
        profileId,
        browser,
        page,
        messengerPages: new Map(), // Карта вкладок для мессенджеров
        pid,
        startedAt: new Date(),
        status: 'running',
      };

      // Сохранение информации о процессе
      this.processes.set(profileId, processInfo);

      // Обработка закрытия браузера (включая неожиданное закрытие)
      browser.on('disconnected', () => {
        logger.info('Chrome browser disconnected', { profileId, pid });
        const info = this.processes.get(profileId);
        if (info) {
          info.status = 'stopped';
          // Очищаем все вкладки мессенджеров при отключении браузера
          info.messengerPages.clear();
        }
        this.processes.delete(profileId);
        
        // Вызываем callback для обновления статуса в БД
        if (this.disconnectCallback) {
          try {
            this.disconnectCallback(profileId);
          } catch (callbackError) {
            logger.error('Error in disconnect callback', {
              error: callbackError instanceof Error ? callbackError.message : 'Unknown error',
              profileId,
            });
          }
        }
      });

      logger.info('Chrome process launched successfully', {
        profileId,
        pid,
        userDataDir: config.userDataDir,
      });

      return processInfo;
    } catch (error) {
      logger.error('Failed to launch Chrome process', {
        error: error instanceof Error ? error.message : 'Unknown error',
        profileId,
        config,
      });

      // Удаление из карты при ошибке
      const existing = this.processes.get(profileId);
      if (existing) {
        // Пытаемся закрыть браузер, если он был создан
        try {
          if (existing.browser && existing.browser.isConnected()) {
            await existing.browser.close().catch(() => {
              // Игнорируем ошибки закрытия
            });
          }
        } catch (closeError) {
          logger.warn('Failed to close browser after launch error', {
            error: closeError instanceof Error ? closeError.message : 'Unknown error',
            profileId,
          });
        }
        this.processes.delete(profileId);
      }

      throw new Error(
        `Failed to launch Chrome process: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Остановка Chrome процесса для профиля
   * 
   * @param profileId - ID профиля
   * @param force - Принудительная остановка (kill)
   */
  async stopChrome(profileId: string, force: boolean = false): Promise<void> {
    try {
      const processInfo = this.processes.get(profileId);

      if (!processInfo) {
        logger.warn('Chrome process not found', { profileId });
        return;
      }

      if (processInfo.status === 'stopped') {
        logger.warn('Chrome process already stopped', { profileId });
        this.processes.delete(profileId);
        return;
      }

      logger.info('Stopping Chrome process', { profileId, force, pid: processInfo.pid });

      processInfo.status = 'stopping';

      try {
        // Закрытие всех вкладок мессенджеров
        const messengerPages = Array.from(processInfo.messengerPages.values());
        for (const page of messengerPages) {
          try {
            if (!page.isClosed()) {
              await page.close();
            }
          } catch (error) {
            logger.warn('Failed to close messenger page', { 
              error: error instanceof Error ? error.message : 'Unknown error', 
              profileId 
            });
          }
        }
        processInfo.messengerPages.clear();

        // Закрытие всех остальных страниц
        const pages = await processInfo.browser.pages();
        for (const page of pages) {
          try {
            if (!page.isClosed()) {
              await page.close();
            }
          } catch (error) {
            logger.warn('Failed to close page', { 
              error: error instanceof Error ? error.message : 'Unknown error', 
              profileId 
            });
          }
        }

        // Закрытие браузера
        // Примечание: Puppeteer не поддерживает принудительное закрытие через API,
        // но browser.close() должен корректно закрыть браузер
        // Если нужно принудительное закрытие, можно использовать process.kill() на PID
        await processInfo.browser.close();
        
        // Принудительное закрытие процесса, если force=true и PID доступен
        if (force && processInfo.pid) {
          try {
            // Используем kill для принудительного завершения процесса
            kill(processInfo.pid, 'SIGKILL');
            logger.debug('Force killed Chrome process', { profileId, pid: processInfo.pid });
          } catch (killError) {
            logger.warn('Failed to force kill Chrome process', {
              error: killError instanceof Error ? killError.message : 'Unknown error',
              profileId,
              pid: processInfo.pid,
            });
          }
        }

        processInfo.status = 'stopped';
        this.processes.delete(profileId);

        logger.info('Chrome process stopped successfully', { profileId, pid: processInfo.pid });
      } catch (error) {
        // При ошибке все равно помечаем как stopped и удаляем из карты
        // чтобы избежать "зависших" процессов
        processInfo.status = 'stopped';
        this.processes.delete(profileId);
        
        logger.error('Error stopping Chrome process', {
          error: error instanceof Error ? error.message : 'Unknown error',
          profileId,
        });
        
        // Если force=true, пробуем принудительно убить процесс
        if (force && processInfo.pid) {
          try {
            kill(processInfo.pid, 'SIGKILL');
            logger.info('Force killed Chrome process after error', { profileId, pid: processInfo.pid });
          } catch (killError) {
            logger.warn('Failed to force kill Chrome process after error', {
              error: killError instanceof Error ? killError.message : 'Unknown error',
              profileId,
              pid: processInfo.pid,
            });
          }
        }
        
        throw error;
      }
    } catch (error) {
      // Внешний catch - обрабатываем ошибки, которые произошли до попытки остановки
      // (например, если processInfo не найден)
      logger.error('Failed to stop Chrome process', {
        error: error instanceof Error ? error.message : 'Unknown error',
        profileId,
      });
      
      // Пытаемся очистить процесс из карты, если он там есть
      const existing = this.processes.get(profileId);
      if (existing) {
        existing.status = 'stopped';
        this.processes.delete(profileId);
      }
      
      throw error;
    }
  }

  /**
   * Получение информации о процессе Chrome
   * 
   * @param profileId - ID профиля
   * @returns Информация о процессе или null
   */
  getProcessInfo(profileId: string): ChromeProcessInfo | null {
    return this.processes.get(profileId) ?? null;
  }

  /**
   * Проверка, запущен ли процесс для профиля
   * 
   * @param profileId - ID профиля
   * @returns true если процесс запущен
   */
  isProcessRunning(profileId: string): boolean {
    const processInfo = this.processes.get(profileId);
    if (!processInfo) {
      return false;
    }
    
    // Проверяем реальное состояние браузера
    if (processInfo.status === 'running' && processInfo.browser) {
      // Проверяем, что браузер действительно подключен
      try {
        if (!processInfo.browser.isConnected()) {
          // Браузер отключен, но статус running - рассинхронизация
          logger.warn('Process marked as running but browser is disconnected, fixing status', { profileId });
          processInfo.status = 'stopped';
          this.processes.delete(profileId);
          return false;
        }
        return true;
      } catch (error) {
        // Ошибка при проверке подключения - считаем процесс остановленным
        logger.warn('Error checking browser connection, marking as stopped', {
          error: error instanceof Error ? error.message : 'Unknown error',
          profileId,
        });
        processInfo.status = 'stopped';
        this.processes.delete(profileId);
        return false;
      }
    }
    
    return false;
  }

  /**
   * Получение списка всех запущенных процессов
   * 
   * @returns Массив информации о процессах
   */
  getAllProcesses(): ChromeProcessInfo[] {
    return Array.from(this.processes.values());
  }

  /**
   * Остановка всех процессов
   */
  async stopAllProcesses(force: boolean = false): Promise<void> {
    const profileIds = Array.from(this.processes.keys());
    logger.info('Stopping all Chrome processes', { count: profileIds.length, force });

    const stopPromises = profileIds.map((profileId) => this.stopChrome(profileId, force));
    await Promise.allSettled(stopPromises);

    logger.info('All Chrome processes stopped', { count: profileIds.length });
  }

  /**
   * Очистка информации о процессе (при ошибках)
   * 
   * @param profileId - ID профиля
   */
  cleanupProcess(profileId: string): void {
    this.processes.delete(profileId);
    logger.debug('Process info cleaned up', { profileId });
  }

  /**
   * Создание новой вкладки для мессенджера
   * 
   * Каждый мессенджер работает в своей вкладке для изоляции и параллельной проверки.
   * 
   * @param profileId - ID профиля
   * @param serviceName - Имя мессенджера (whatsapp, telegram)
   * @param url - URL для навигации (опционально)
   * @returns Page или null если профиль не запущен
   */
  async createMessengerPage(profileId: string, serviceName: string, url?: string): Promise<Page | null> {
    const processInfo = this.processes.get(profileId);
    
    logger.debug('createMessengerPage called', { 
      profileId, 
      serviceName, 
      url,
      hasProcessInfo: !!processInfo,
      processStatus: processInfo?.status,
    });

    if (!processInfo) {
      logger.error('Cannot create messenger page: processInfo not found', { profileId, serviceName });
      return null;
    }

    if (processInfo.status !== 'running') {
      logger.error('Cannot create messenger page: process not running', { 
        profileId, 
        serviceName, 
        status: processInfo.status 
      });
      return null;
    }

    // Проверяем, есть ли уже вкладка для этого мессенджера
    const existingPage = processInfo.messengerPages.get(serviceName);
    if (existingPage) {
      try {
        // Проверяем, что страница не закрыта
        if (!existingPage.isClosed()) {
          logger.debug('Messenger page already exists', { profileId, serviceName });
          // Если URL передан - навигируем на него
          if (url) {
            try {
              const currentUrl = existingPage.url();
              if (!currentUrl.includes(new URL(url).hostname)) {
                await existingPage.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
              }
            } catch (e) {
              logger.warn('Failed to navigate existing messenger page', { 
                profileId, 
                serviceName, 
                error: e instanceof Error ? e.message : 'Unknown error' 
              });
            }
          }
          return existingPage;
        } else {
          // Страница закрыта, удаляем из карты
          logger.debug('Existing messenger page is closed, removing from map', { profileId, serviceName });
          processInfo.messengerPages.delete(serviceName);
        }
      } catch (error) {
        // Ошибка при проверке - страница может быть закрыта
        logger.warn('Error checking existing page status, removing from map', {
          error: error instanceof Error ? error.message : 'Unknown error',
          profileId,
          serviceName,
        });
        processInfo.messengerPages.delete(serviceName);
      }
    }

    try {
      logger.debug('Creating new messenger page', { profileId, serviceName, url });
      
      // Создаём новую вкладку
      const newPage = await processInfo.browser.newPage();
      
      // Базовые настройки
      newPage.setDefaultNavigationTimeout(60000);
      newPage.setDefaultTimeout(60000);

      // Сохраняем в карту
      processInfo.messengerPages.set(serviceName, newPage);

      // Обработка закрытия вкладки
      newPage.on('close', () => {
        logger.debug('Messenger page closed', { profileId, serviceName });
        processInfo.messengerPages.delete(serviceName);
      });

      // Навигация на URL если передан
      if (url) {
        await newPage.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
      }

      logger.info('Messenger page created', { profileId, serviceName, url });
      return newPage;
    } catch (error) {
      logger.error('Failed to create messenger page', {
        error: error instanceof Error ? error.message : 'Unknown error',
        profileId,
        serviceName,
      });
      return null;
    }
  }

  /**
   * Получение вкладки мессенджера
   * 
   * @param profileId - ID профиля
   * @param serviceName - Имя мессенджера (whatsapp, telegram)
   * @returns Page или null
   */
  getMessengerPage(profileId: string, serviceName: string): Page | null {
    const processInfo = this.processes.get(profileId);
    if (!processInfo) {
      return null;
    }

    // Проверяем, что процесс действительно запущен
    if (processInfo.status !== 'running' || !processInfo.browser?.isConnected()) {
      return null;
    }

    const page = processInfo.messengerPages.get(serviceName);
    if (page) {
      // Проверяем, что страница не закрыта
      try {
        if (!page.isClosed()) {
          return page;
        } else {
          // Страница закрыта, удаляем из карты
          processInfo.messengerPages.delete(serviceName);
        }
      } catch (error) {
        // Ошибка при проверке - страница может быть закрыта
        logger.warn('Error checking page status, removing from map', {
          error: error instanceof Error ? error.message : 'Unknown error',
          profileId,
          serviceName,
        });
        processInfo.messengerPages.delete(serviceName);
      }
    }

    return null;
  }

  /**
   * Получение или создание вкладки для мессенджера
   * 
   * @param profileId - ID профиля
   * @param serviceName - Имя мессенджера
   * @param url - URL для навигации
   * @returns Page или null
   */
  async getOrCreateMessengerPage(profileId: string, serviceName: string, url?: string): Promise<Page | null> {
    // Пытаемся получить существующую вкладку
    let page = this.getMessengerPage(profileId, serviceName);
    
    // Если страница найдена и URL передан - навигируем на него (если нужно)
    if (page && url) {
      try {
        const currentUrl = page.url();
        const targetHostname = new URL(url).hostname;
        if (!currentUrl.includes(targetHostname)) {
          await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
        }
      } catch (error) {
        logger.warn('Failed to navigate existing page to new URL, creating new page', {
          error: error instanceof Error ? error.message : 'Unknown error',
          profileId,
          serviceName,
          url,
        });
        // Если навигация не удалась - создаем новую страницу
        page = null;
      }
    }
    
    // Создаём новую вкладку если не найдена или навигация не удалась
    if (!page) {
      page = await this.createMessengerPage(profileId, serviceName, url);
    }

    return page;
  }

  /**
   * Закрытие вкладки мессенджера
   * 
   * @param profileId - ID профиля
   * @param serviceName - Имя мессенджера
   */
  async closeMessengerPage(profileId: string, serviceName: string): Promise<void> {
    const processInfo = this.processes.get(profileId);
    if (!processInfo) {
      return;
    }

    const page = processInfo.messengerPages.get(serviceName);
    if (page) {
      try {
        // Проверяем, что страница не закрыта перед закрытием
        if (!page.isClosed()) {
          await page.close();
          logger.debug('Messenger page closed', { profileId, serviceName });
        } else {
          logger.debug('Messenger page already closed', { profileId, serviceName });
        }
      } catch (error) {
        logger.warn('Failed to close messenger page', {
          error: error instanceof Error ? error.message : 'Unknown error',
          profileId,
          serviceName,
        });
      } finally {
        // Удаляем из карты в любом случае (даже если была ошибка)
        processInfo.messengerPages.delete(serviceName);
      }
    }
  }

  /**
   * Получение всех активных вкладок мессенджеров для профиля
   * 
   * @param profileId - ID профиля
   * @returns Карта serviceName -> Page
   */
  getAllMessengerPages(profileId: string): Map<string, Page> {
    const processInfo = this.processes.get(profileId);
    if (!processInfo) {
      return new Map();
    }
    return processInfo.messengerPages;
  }
}

