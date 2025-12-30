/**
 * Публичный API модуля аккаунтов мессенджеров
 * 
 * Экспортирует все публичные компоненты модуля для использования в других частях приложения.
 * 
 * @module modules/profiles/messenger-accounts
 */

export { MessengerAccountsService } from './messenger-accounts.service';
export { MessengerAccountsRepository } from './messenger-accounts.repository';
export {
  getAllServicesHandler,
  getServiceByIdHandler,
  getAccountsByProfileHandler,
  getAccountByIdHandler,
  createAccountHandler,
  updateAccountHandler,
  enableAccountHandler,
  disableAccountHandler,
  deleteAccountHandler,
  checkAccountStatusHandler,
  getAllCheckConfigsHandler,
  getCheckConfigByServiceIdHandler,
  updateCheckConfigHandler,
} from './messenger-accounts.controller';
export {
  createMessengerAccountSchema,
  updateMessengerAccountSchema,
  updateMessengerCheckConfigSchema,
  MessengerAccountStatusEnum,
  type CreateMessengerAccountInput,
  type UpdateMessengerAccountInput,
  type UpdateMessengerCheckConfigInput,
} from './messenger-accounts.schemas';

