/**
 * Модуль глобальных настроек кампаний
 * 
 * Экспорты:
 * - CampaignSettingsService - сервис управления настройками
 * - CampaignSettingsRepository - репозиторий для работы с БД
 * - ensureCampaignGlobalSettings - функция инициализации дефолтных настроек
 */

export { CampaignSettingsService } from './campaign-settings.service';
export { CampaignSettingsRepository } from './campaign-settings.repository';
export { ensureCampaignGlobalSettings } from './init-campaign-settings';




