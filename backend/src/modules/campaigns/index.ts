/**
 * Модуль кампаний рассылки
 * 
 * Экспортирует все компоненты модуля campaigns.
 * 
 * @module modules/campaigns
 */

// Repository exports
export {
  CampaignRepository,
  CampaignProfileRepository,
  CampaignMessageRepository,
  CampaignLogRepository,
  type CreateCampaignData,
  type UpdateCampaignData,
  type UpdateCampaignProgressData,
  type ListCampaignsQuery as RepoListCampaignsQuery,
  type CreateCampaignProfileData,
  type UpdateCampaignProfileData,
  type CreateCampaignMessageData,
  type UpdateCampaignMessageData,
  type CreateCampaignLogData,
  type ListMessagesQuery as RepoListMessagesQuery,
  type ListLogsQuery as RepoListLogsQuery,
} from './campaigns.repository';

// Service exports
export {
  CampaignsService,
  getCampaignsService,
  type CampaignValidationResult,
  type CalculatedContacts,
  type ProfileValidation,
} from './campaigns.service';

// Schema exports
export {
  campaignTypeSchema,
  campaignStatusSchema,
  campaignProfileStatusSchema,
  messageStatusSchema,
  messengerTargetSchema,
  messengerTypeSchema,
  universalTargetSchema,
  logLevelSchema,
  scheduleConfigSchema,
  filterConfigSchema,
  optionsConfigSchema,
  createCampaignSchema,
  updateCampaignSchema,
  listCampaignsQuerySchema,
  listMessagesQuerySchema,
  listLogsQuerySchema,
  startCampaignSchema,
  duplicateCampaignSchema,
  updateCampaignProfilesSchema,
  campaignIdParamSchema,
  messageIdParamSchema,
  type ScheduleConfig,
  type FilterConfig,
  type OptionsConfig,
  type CreateCampaignInput,
  type UpdateCampaignInput,
  type ListCampaignsQuery,
  type ListMessagesQuery,
  type ListLogsQuery,
  type StartCampaignInput,
  type DuplicateCampaignInput,
  type UpdateCampaignProfilesInput,
  type CampaignType,
  type CampaignStatus,
  type CampaignProfileStatus,
  type MessageStatus,
  type MessengerTarget,
  type MessengerType,
  type UniversalTarget,
  type LogLevel,
} from './campaigns.schemas';

// Controller exports
export {
  CampaignsController,
  getCampaignsController,
} from './campaigns.controller';

// Routes export
export { campaignsRoutes } from './campaigns.routes';
export { default as campaignAdminRoutes } from './campaign-admin.routes';

// Load Balancer exports
export {
  LoadBalancerService,
  type ContactInfo,
  type ProfileAssignment,
  type DistributionResult,
  type FilterConfig as LoadBalancerFilterConfig,
  type OptionsConfig as LoadBalancerOptionsConfig,
} from './load-balancer';

// Scheduler exports
export {
  CampaignSchedulerService,
  type ScheduleConfig as SchedulerScheduleConfig,
  type GlobalSettings,
} from './scheduler';

// Progress exports
export {
  CampaignProgressService,
  type CampaignProgress,
  type ProfileProgress,
} from './progress';

// Stats exports
export {
  CampaignStatsService,
  type CampaignStats,
  type MessengerStats,
  type ProfileStats,
  type ErrorStats,
  type ExportOptions,
} from './stats';

// Message Sender exports
export {
  MessageSenderService,
  type SendMessageInput,
  type SendMessageResult,
  WhatsAppSender,
  TelegramSender,
} from './message-sender';

// Executor exports
export {
  CampaignExecutorService,
  type ExecutorOptions,
} from './executor/campaign-executor.service';
export { getCampaignExecutorService, getCampaignRecovery } from './executor';

// Recovery exports
export {
  CampaignRecoveryService,
  getCampaignRecoveryService,
} from './recovery/campaign-recovery.service';

// Profile Worker exports
export { ProfileWorker } from './profile-worker';

