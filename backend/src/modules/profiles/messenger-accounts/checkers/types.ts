/**
 * Типы для системы проверки статусов аккаунтов мессенджеров
 * 
 * Определяет типы данных для результатов проверки статуса входа.
 * 
 * @module modules/profiles/messenger-accounts/checkers/types
 */

import { MessengerAccountStatus } from '@prisma/client';
import { Page } from 'puppeteer';

/**
 * Результат проверки статуса входа
 */
export interface LoginCheckResult {
  /** Статус входа */
  status: MessengerAccountStatus;
  
  /** QR код в формате base64 (если требуется вход) */
  qrCode?: string;
  
  /** Требуется ли облачный пароль (для Telegram) */
  cloudPasswordRequired?: boolean;
  
  /** Сообщение об ошибке (если проверка не удалась) */
  error?: string;
  
  /** Время проверки */
  checkedAt: Date;
  
  /** Дополнительные метаданные */
  metadata?: Record<string, unknown>;
}

/**
 * Конфигурация проверки для конкретного мессенджера
 */
export interface CheckerConfig {
  /** Таймаут ожидания загрузки страницы (мс) */
  pageLoadTimeout?: number;
  
  /** Таймаут ожидания элементов (мс) */
  elementWaitTimeout?: number;
  
  /** Таймаут для скриншота QR (мс) */
  qrScreenshotTimeout?: number;
  
  /** Максимальное количество попыток проверки */
  maxRetries?: number;
}

/**
 * Контекст проверки
 */
export interface CheckContext {
  /** ID профиля */
  profileId: string;
  
  /** ID аккаунта мессенджера */
  accountId: string;
  
  /** ID мессенджера */
  serviceId: string;
  
  /** URL для проверки */
  url: string;
}

/**
 * Интерфейс для чекеров, поддерживающих ввод облачного пароля
 */
export interface CloudPasswordChecker {
  /**
   * Ввод облачного пароля (для Telegram 2FA)
   * 
   * @param page - Puppeteer Page instance
   * @param password - Облачный пароль
   * @returns true если пароль успешно введен
   */
  enterCloudPassword(page: Page, password: string): Promise<boolean>;
}

