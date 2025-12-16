/**
 * Модуль управления лимитами кампаний пользователей
 * 
 * Экспортирует:
 * - UserCampaignLimitsService - сервис для работы с лимитами
 * - UserCampaignLimitsRepository - репозиторий для работы с БД
 */

export { UserCampaignLimitsService } from './user-campaign-limits.service';
export { UserCampaignLimitsRepository } from './user-campaign-limits.repository';
export type { SetUserLimitsInput, UserLimitsWithUser } from './user-campaign-limits.service';




