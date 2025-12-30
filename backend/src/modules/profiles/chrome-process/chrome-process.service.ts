/**
 * Сервис управления Chrome процессами
 * 
 * Высокоуровневый сервис для управления Chrome процессами профилей.
 * Интегрируется с ProfilesService для синхронизации статусов.
 * 
 * @module modules/profiles/chrome-process/chrome-process.service
 */

import { Page } from 'puppeteer';
import { ChromeProcessManager, ChromeLaunchConfig, ChromeProcessInfo } from './chrome-process.manager';
import { IsolationService } from '../isolation/isolation.service';
import logger from '../../../config/logger';
import { join } from 'path';

/**
 * Информация о занятости профиля рассылкой
 */
interface BusyProfileInfo {
  profileId: string;
  messenger: 'whatsapp' | 'telegram';
  campaignId?: string;
  startedAt: Date;
}

/**
 * Сервис управления Chrome процессами
 */
export class ChromeProcessService {
  private processManager: ChromeProcessManager;
  private isolationService: IsolationService;
  
  /**
   * Профили, занятые рассылкой
   * Ключ: profileId, Значение: информация о занятости
   */
  private busyProfiles: Map<string, BusyProfileInfo> = new Map();

  constructor(isolationService: IsolationService) {
    this.processManager = new ChromeProcessManager();
    this.isolationService = isolationService;
  }

  /**
   * Запуск Chrome для профиля
   * 
   * @param userId - ID пользователя
   * @param profileId - ID профиля
   * @param options - Опции запуска
   * @param resourceLimits - Лимиты ресурсов (опционально)
   * @returns Информация о запущенном процессе
   */
  async startProfile(
    userId: string,
    profileId: string,
    options?: {
      headless?: boolean;
      args?: string[];
    },
    resourceLimits?: {
      maxCpuPerProfile?: number | null;
      maxMemoryPerProfile?: number | null;
    }
  ): Promise<ChromeProcessInfo> {
    try {
      logger.debug('Starting Chrome profile', { userId, profileId, options, resourceLimits });

      // Проверка, не запущен ли уже процесс
      if (this.processManager.isProcessRunning(profileId)) {
        const existing = this.processManager.getProcessInfo(profileId);
        if (existing) {
          logger.warn('Chrome profile already running', { userId, profileId });
          return existing;
        }
      }

      // Получение пути к директории профиля
      const profilePath = this.isolationService.getProfilePath(userId, profileId);

      // Путь к данным Chrome (userDataDir)
      const chromeDataDir = join(profilePath, 'chrome-data');

      // Подготовка аргументов Chrome
      // ПРИМЕЧАНИЕ: Лимиты ресурсов (CPU, память) не применяются через аргументы Chrome,
      // так как Chrome не поддерживает такие ограничения через флаги запуска.
      // Для реального ограничения ресурсов нужны системные средства:
      // - cgroups на Linux
      // - Job Objects на Windows
      // - rctl на FreeBSD
      // Сейчас лимиты передаются в config для мониторинга и проверки превышения через ResourceMonitorService.
      const chromeArgs: string[] = options?.args ?? [];

      // Конфигурация запуска
      const config: ChromeLaunchConfig = {
        userDataDir: chromeDataDir,
        headless: options?.headless ?? true,
        args: chromeArgs,
        resourceLimits: resourceLimits
          ? {
              cpu: resourceLimits.maxCpuPerProfile ?? undefined,
              memory: resourceLimits.maxMemoryPerProfile ?? undefined,
            }
          : undefined,
      };

      // Запуск Chrome
      const processInfo = await this.processManager.launchChrome(profileId, config);

      logger.info('Chrome profile started successfully', {
        userId,
        profileId,
        pid: processInfo.pid,
        startedAt: processInfo.startedAt,
        resourceLimits: resourceLimits ? { ...resourceLimits } : undefined,
      });

      return processInfo;
    } catch (error) {
      logger.error('Failed to start Chrome profile', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
        profileId,
      });
      throw error;
    }
  }

  /**
   * Остановка Chrome для профиля
   * 
   * @param userId - ID пользователя
   * @param profileId - ID профиля
   * @param force - Принудительная остановка
   */
  async stopProfile(userId: string, profileId: string, force: boolean = false): Promise<void> {
    try {
      logger.debug('Stopping Chrome profile', { userId, profileId, force });

      await this.processManager.stopChrome(profileId, force);

      logger.info('Chrome profile stopped successfully', { userId, profileId });
    } catch (error) {
      logger.error('Failed to stop Chrome profile', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
        profileId,
      });
      throw error;
    }
  }

  /**
   * Проверка, запущен ли Chrome для профиля
   * 
   * @param profileId - ID профиля
   * @returns true если Chrome запущен
   */
  isProfileRunning(profileId: string): boolean {
    return this.processManager.isProcessRunning(profileId);
  }

  /**
   * Получение информации о процессе Chrome
   * 
   * @param profileId - ID профиля
   * @returns Информация о процессе или null
   */
  getProcessInfo(profileId: string): ChromeProcessInfo | null {
    return this.processManager.getProcessInfo(profileId);
  }

  /**
   * Получение списка всех запущенных процессов
   * 
   * @returns Массив информации о процессах
   */
  getAllProcesses(): ChromeProcessInfo[] {
    return this.processManager.getAllProcesses();
  }

  /**
   * Остановка всех процессов (для graceful shutdown)
   */
  async stopAllProcesses(force: boolean = false): Promise<void> {
    await this.processManager.stopAllProcesses(force);
  }

  /**
   * Очистка информации о процессе
   * 
   * @param profileId - ID профиля
   */
  cleanupProcess(profileId: string): void {
    this.processManager.cleanupProcess(profileId);
  }

  /**
   * Получение Page для профиля (fallback страница)
   * 
   * Возвращает Puppeteer Page для работы с браузером профиля.
   * Для мессенджеров лучше использовать getMessengerPage.
   * 
   * @param profileId - ID профиля
   * @returns Page или null если профиль не запущен
   */
  getPageForProfile(profileId: string): Page | null {
    const processInfo = this.processManager.getProcessInfo(profileId);
    return processInfo?.page || null;
  }

  /**
   * Получение Browser для профиля
   * 
   * Возвращает Puppeteer Browser для работы с браузером профиля.
   * 
   * @param profileId - ID профиля
   * @returns Browser или null если профиль не запущен
   */
  getBrowserForProfile(profileId: string) {
    const processInfo = this.processManager.getProcessInfo(profileId);
    return processInfo?.browser || null;
  }

  /**
   * Установка callback для обработки неожиданного закрытия браузера
   * 
   * Callback вызывается при disconnected событии браузера.
   * Используется для обновления статуса профиля в БД.
   * 
   * @param callback - Функция, вызываемая при disconnected событии
   */
  setDisconnectCallback(callback: (profileId: string) => void): void {
    this.processManager.setDisconnectCallback(callback);
  }

  // =====================================================
  // МЕТОДЫ ДЛЯ РАБОТЫ С ВКЛАДКАМИ МЕССЕНДЖЕРОВ
  // =====================================================

  /**
   * Создание вкладки для мессенджера
   * 
   * @param profileId - ID профиля
   * @param serviceName - Имя мессенджера (whatsapp, telegram)
   * @param url - URL для навигации (опционально)
   * @returns Page или null
   */
  async createMessengerPage(profileId: string, serviceName: string, url?: string): Promise<Page | null> {
    return this.processManager.createMessengerPage(profileId, serviceName, url);
  }

  /**
   * Получение вкладки мессенджера
   * 
   * @param profileId - ID профиля
   * @param serviceName - Имя мессенджера (whatsapp, telegram)
   * @returns Page или null
   */
  getMessengerPage(profileId: string, serviceName: string): Page | null {
    return this.processManager.getMessengerPage(profileId, serviceName);
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
    return this.processManager.getOrCreateMessengerPage(profileId, serviceName, url);
  }

  /**
   * Закрытие вкладки мессенджера
   * 
   * @param profileId - ID профиля
   * @param serviceName - Имя мессенджера
   */
  async closeMessengerPage(profileId: string, serviceName: string): Promise<void> {
    return this.processManager.closeMessengerPage(profileId, serviceName);
  }

  /**
   * Получение всех активных вкладок мессенджеров
   * 
   * @param profileId - ID профиля
   * @returns Карта serviceName -> Page
   */
  getAllMessengerPages(profileId: string): Map<string, Page> {
    return this.processManager.getAllMessengerPages(profileId);
  }

  // =====================================================
  // МЕТОДЫ ДЛЯ УПРАВЛЕНИЯ ЗАНЯТОСТЬЮ ПРОФИЛЕЙ РАССЫЛКОЙ
  // =====================================================

  /**
   * Пометить профиль как занятый рассылкой
   * 
   * Когда профиль занят, мониторинг статуса аккаунтов не будет переключать вкладки.
   * 
   * @param profileId - ID профиля
   * @param messenger - Мессенджер (whatsapp или telegram)
   * @param campaignId - ID кампании (опционально)
   */
  markProfileBusy(profileId: string, messenger: 'whatsapp' | 'telegram', campaignId?: string): void {
    this.busyProfiles.set(profileId, {
      profileId,
      messenger,
      campaignId,
      startedAt: new Date(),
    });
    logger.debug('Profile marked as busy', { profileId, messenger, campaignId });
  }

  /**
   * Пометить профиль как свободный
   * 
   * @param profileId - ID профиля
   */
  markProfileFree(profileId: string): void {
    const wasbusy = this.busyProfiles.delete(profileId);
    if (wasbusy) {
      logger.debug('Profile marked as free', { profileId });
    }
  }

  /**
   * Проверить, занят ли профиль рассылкой
   * 
   * @param profileId - ID профиля
   * @returns true если профиль занят
   */
  isProfileBusy(profileId: string): boolean {
    return this.busyProfiles.has(profileId);
  }

  /**
   * Получить информацию о занятости профиля
   * 
   * @param profileId - ID профиля
   * @returns Информация о занятости или undefined
   */
  getBusyProfileInfo(profileId: string): BusyProfileInfo | undefined {
    return this.busyProfiles.get(profileId);
  }

  /**
   * Получить список всех занятых профилей
   * 
   * @returns Массив информации о занятых профилях
   */
  getAllBusyProfiles(): BusyProfileInfo[] {
    return Array.from(this.busyProfiles.values());
  }
}

