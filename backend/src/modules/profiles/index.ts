/**
 * Публичный API модуля управления профилями Chrome
 * 
 * Экспортирует все публичные компоненты модуля для использования в других частях приложения.
 * 
 * @module modules/profiles
 */

export { ProfilesService } from './profiles.service';
export { ProfilesRepository } from './profiles.repository';
export {
  createProfileHandler,
  listProfilesHandler,
  getProfileHandler,
  updateProfileHandler,
  deleteProfileHandler,
  getProfileStatusHandler,
  startProfileHandler,
  stopProfileHandler,
  getProfileResourcesHandler,
  getProfileResourcesHistoryHandler,
  checkProfileHealthHandler,
  getProfileNetworkStatsHandler,
  getProfileAlertsHandler,
  getProfileUnreadAlertsCountHandler,
  markAlertAsReadHandler,
  markAllAlertsAsReadHandler,
  getProfileAnalyticsHandler,
} from './profiles.controller';
export {
  getUserLimitsHandler,
  setUserLimitsHandler,
  getAllLimitsHandler,
  getMyLimitsHandler,
} from './limits/limits.controller';
export {
  createProfileSchema,
  updateProfileSchema,
  listProfilesQuerySchema,
  type CreateProfileInput,
  type UpdateProfileInput,
  type ListProfilesQuery,
  ProfileStatusEnum,
} from './profiles.schemas';
export { IsolationService, ProfileDirectoryManager } from './isolation';
export { ChromeProcessService, ChromeProcessManager } from './chrome-process';
export type { ChromeLaunchConfig, ChromeProcessInfo } from './chrome-process';
export { ProfileLimitsService, ProfileLimitsRepository } from './limits';
export type { ProfileLimitsInput } from './limits';
export { ResourceMonitorService, ProcessResourcesManager } from './resource-monitoring';
export type { ProcessResourceStats } from './resource-monitoring';
export { NetworkMonitorService, NetworkStatsManager } from './network-monitoring';
export type { NetworkStats } from './network-monitoring';
export { NotificationService, AlertManager } from './notifications';
export type { Alert, AlertType, AlertSeverity } from './notifications';
export { AnalyticsService, StatsAggregator } from './analytics';
export type { ProfileAnalytics, AggregatedResourceStats, AggregatedNetworkStats, AggregationPeriod } from './analytics';
export { HealthCheckService, ProfileHealthManager } from './health-monitoring';
export type { ProfileHealthCheck, ProfileHealthStatus, HealthCheckConfig } from './health-monitoring';
export { AutoRestartService, DEFAULT_AUTO_RESTART_CONFIG } from './auto-restart';
export type { AutoRestartConfig } from './auto-restart';
export { MessengerAccountsService, MessengerAccountsRepository } from './messenger-accounts';
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
  updateCheckConfigHandler,
} from './messenger-accounts';
export { StatusCheckerService, BaseChecker, WhatsAppChecker, TelegramChecker } from './messenger-accounts/checkers';
export type { LoginCheckResult, CheckerConfig, CheckContext } from './messenger-accounts/checkers';
export {
  createMessengerAccountSchema,
  updateMessengerAccountSchema,
  updateMessengerCheckConfigSchema,
  MessengerAccountStatusEnum,
  type CreateMessengerAccountInput,
  type UpdateMessengerAccountInput,
  type UpdateMessengerCheckConfigInput,
} from './messenger-accounts';

