/**
 * Публичный API модуля проверки статусов мессенджеров
 * 
 * Экспортирует все компоненты для проверки статуса входа в мессенджеры.
 * 
 * @module modules/profiles/messenger-accounts/checkers
 */

export { BaseChecker } from './base-checker';
export { WhatsAppChecker } from './whatsapp-checker';
export { TelegramChecker } from './telegram-checker';
export { StatusCheckerService } from './status-checker.service';
export {
  getChecker,
  getCheckerOrThrow,
  isSupported,
  getSupportedTypes,
  initializeCheckers,
} from './checker-factory';
export type {
  LoginCheckResult,
  CheckerConfig,
  CheckContext,
} from './types';

