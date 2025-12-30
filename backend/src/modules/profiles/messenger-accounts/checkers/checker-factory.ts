/**
 * Фабрика чекеров статуса входа
 * 
 * Создает и возвращает нужный чекер для конкретного мессенджера.
 * 
 * @module modules/profiles/messenger-accounts/checkers/checker-factory
 */

import { BaseChecker } from './base-checker';
import { WhatsAppChecker } from './whatsapp-checker';
import { TelegramChecker } from './telegram-checker';
import { CheckerConfig } from './types';
import logger from '../../../../config/logger';

/**
 * Реестр чекеров
 * 
 * Хранит инстансы чекеров для каждого типа мессенджера.
 */
class CheckerRegistry {
  private checkers: Map<string, BaseChecker> = new Map();

  /**
   * Регистрация чекера
   * 
   * @param serviceType - Тип мессенджера (техническое имя)
   * @param checker - Инстанс чекера
   */
  register(serviceType: string, checker: BaseChecker): void {
    this.checkers.set(serviceType.toLowerCase(), checker);
    logger.debug('Checker registered', { serviceType: serviceType.toLowerCase() });
  }

  /**
   * Получение чекера по типу мессенджера
   * 
   * @param serviceType - Тип мессенджера (техническое имя)
   * @returns Чекер или null, если не найден
   */
  get(serviceType: string): BaseChecker | null {
    return this.checkers.get(serviceType.toLowerCase()) || null;
  }

  /**
   * Получение всех зарегистрированных типов мессенджеров
   * 
   * @returns Массив типов мессенджеров
   */
  getRegisteredTypes(): string[] {
    return Array.from(this.checkers.keys());
  }
}

/**
 * Глобальный реестр чекеров
 */
const checkerRegistry = new CheckerRegistry();

/**
 * Инициализация реестра чекеров
 * 
 * Регистрирует все доступные чекеры с конфигурацией по умолчанию.
 * Можно вызвать с кастомной конфигурацией.
 * 
 * @param config - Конфигурация для всех чекеров
 */
export function initializeCheckers(config: CheckerConfig = {}): void {
  logger.info('Initializing messenger checkers...');

  // Регистрируем WhatsApp чекер
  const whatsappChecker = new WhatsAppChecker(config);
  checkerRegistry.register(whatsappChecker.getServiceType(), whatsappChecker);

  // Регистрируем Telegram чекер
  const telegramChecker = new TelegramChecker(config);
  checkerRegistry.register(telegramChecker.getServiceType(), telegramChecker);

  logger.info('Messenger checkers initialized', {
    registeredTypes: checkerRegistry.getRegisteredTypes(),
  });
}

/**
 * Получение чекера для мессенджера
 * 
 * @param serviceType - Тип мессенджера (техническое имя, например "whatsapp", "telegram")
 * @returns Чекер или null, если не найден
 */
export function getChecker(serviceType: string): BaseChecker | null {
  return checkerRegistry.get(serviceType);
}

/**
 * Получение чекера или выброс ошибки, если не найден
 * 
 * @param serviceType - Тип мессенджера
 * @returns Чекер
 * @throws Error если чекер не найден
 */
export function getCheckerOrThrow(serviceType: string): BaseChecker {
  const checker = getChecker(serviceType);
  if (!checker) {
    throw new Error(`Checker for messenger type "${serviceType}" not found`);
  }
  return checker;
}

/**
 * Проверка, поддерживается ли мессенджер
 * 
 * @param serviceType - Тип мессенджера
 * @returns true если поддерживается
 */
export function isSupported(serviceType: string): boolean {
  return checkerRegistry.get(serviceType) !== null;
}

/**
 * Получение всех поддерживаемых типов мессенджеров
 * 
 * @returns Массив типов мессенджеров
 */
export function getSupportedTypes(): string[] {
  return checkerRegistry.getRegisteredTypes();
}

// Инициализация чекеров при импорте модуля
initializeCheckers();

