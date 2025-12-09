/**
 * Маршруты для модуля кампаний
 * 
 * Определяет API endpoints для работы с кампаниями рассылки.
 * Все маршруты требуют аутентификации.
 * 
 * @module modules/campaigns/campaigns.routes
 */

import { Router } from 'express';
import { authMiddleware } from '../../middleware/auth';
import { campaignActionRateLimiter } from '../../middleware/security';
import { getCampaignsController } from './campaigns.controller';

const router = Router();
const controller = getCampaignsController();

// ============================================
// Middleware - все маршруты требуют аутентификации
// ============================================
router.use(authMiddleware);

// ============================================
// Campaign CRUD Routes
// ============================================

/**
 * GET /api/campaigns
 * Получение списка кампаний пользователя
 * 
 * Query params:
 * - page: number (default: 1)
 * - limit: number (default: 20, max: 100)
 * - status: CampaignStatus | CampaignStatus[]
 * - campaignType: CampaignType
 * - messengerType: MessengerTarget
 * - search: string
 * - sortBy: 'createdAt' | 'updatedAt' | 'name' | 'scheduledAt' | 'startedAt'
 * - sortOrder: 'asc' | 'desc'
 * - includeArchived: boolean
 */
router.get('/', controller.listCampaigns);

/**
 * GET /api/campaigns/:campaignId
 * Получение кампании по ID
 */
router.get('/:campaignId', controller.getCampaign);

/**
 * POST /api/campaigns
 * Создание новой кампании
 * 
 * Body:
 * - name: string (required)
 * - description: string (optional)
 * - templateId: uuid (required)
 * - clientGroupId: uuid (required)
 * - campaignType: 'ONE_TIME' | 'SCHEDULED' (required)
 * - messengerType: 'WHATSAPP_ONLY' | 'TELEGRAM_ONLY' | 'UNIVERSAL' (required)
 * - universalTarget: 'BOTH' | 'WHATSAPP_FIRST' | 'TELEGRAM_FIRST' (optional)
 * - profileIds: uuid[] (required)
 * - scheduleConfig: ScheduleConfig (optional)
 * - filterConfig: FilterConfig (optional)
 * - optionsConfig: OptionsConfig (optional)
 * - scheduledAt: datetime (optional)
 */
router.post('/', campaignActionRateLimiter, controller.createCampaign);

/**
 * PATCH /api/campaigns/:campaignId
 * Обновление кампании (только для статуса DRAFT)
 */
router.patch('/:campaignId', campaignActionRateLimiter, controller.updateCampaign);

/**
 * DELETE /api/campaigns/:campaignId
 * Удаление кампании
 */
router.delete('/:campaignId', campaignActionRateLimiter, controller.deleteCampaign);

// ============================================
// Campaign Action Routes
// ============================================

/**
 * POST /api/campaigns/:campaignId/duplicate
 * Дублирование кампании
 * 
 * Body:
 * - name: string (optional, default: "Название (копия)")
 */
router.post('/:campaignId/duplicate', campaignActionRateLimiter, controller.duplicateCampaign);

/**
 * POST /api/campaigns/:campaignId/archive
 * Архивирование кампании (только для завершённых)
 */
router.post('/:campaignId/archive', campaignActionRateLimiter, controller.archiveCampaign);

/**
 * POST /api/campaigns/:campaignId/validate
 * Полная валидация кампании перед запуском
 * 
 * Returns: CampaignValidationResult
 */
router.post('/:campaignId/validate', campaignActionRateLimiter, controller.validateCampaign);

/**
 * GET /api/campaigns/:campaignId/calculate-contacts
 * Расчёт количества контактов с учётом фильтров
 */
router.get('/:campaignId/calculate-contacts', campaignActionRateLimiter, controller.calculateContacts);

// ============================================
// Campaign Control Routes (будут реализованы в ЭТАП 6)
// ============================================

/**
 * POST /api/campaigns/:campaignId/start
 * Запуск кампании
 * 
 * Body:
 * - profileIds: uuid[] (optional - переопределение профилей)
 * - force: boolean (optional - игнорировать предупреждения)
 */
router.post('/:campaignId/start', campaignActionRateLimiter, controller.startCampaign);

/**
 * POST /api/campaigns/:campaignId/pause
 * Приостановка кампании
 */
router.post('/:campaignId/pause', campaignActionRateLimiter, controller.pauseCampaign);

/**
 * POST /api/campaigns/:campaignId/resume
 * Возобновление кампании
 */
router.post('/:campaignId/resume', campaignActionRateLimiter, controller.resumeCampaign);

/**
 * POST /api/campaigns/:campaignId/cancel
 * Отмена кампании
 */
router.post('/:campaignId/cancel', campaignActionRateLimiter, controller.cancelCampaign);

// ============================================
// Campaign Monitoring Routes
// ============================================

/**
 * GET /api/campaigns/:campaignId/progress
 * Получение текущего прогресса кампании
 */
router.get('/:campaignId/progress', controller.getProgress);

/**
 * GET /api/campaigns/:campaignId/messages
 * Получение списка сообщений кампании
 * 
 * Query params:
 * - page: number
 * - limit: number
 * - status: MessageStatus | MessageStatus[]
 * - messenger: MessengerType
 * - profileId: uuid
 */
router.get('/:campaignId/messages', controller.getMessages);

/**
 * GET /api/campaigns/:campaignId/logs
 * Получение логов кампании
 * 
 * Query params:
 * - page: number
 * - limit: number
 * - level: LogLevel | LogLevel[]
 * - action: string
 */
router.get('/:campaignId/logs', controller.getLogs);

/**
 * GET /api/campaigns/:campaignId/stats
 * Получение статистики кампании
 */
router.get('/:campaignId/stats', controller.getStats);

// ============================================
// Profile Management Routes
// ============================================

/**
 * PUT /api/campaigns/:campaignId/profiles
 * Обновление профилей кампании (только для DRAFT)
 * 
 * Body:
 * - profileIds: uuid[]
 */
router.put('/:campaignId/profiles', campaignActionRateLimiter, controller.updateProfiles);

/**
 * POST /api/campaigns/:campaignId/validate-profiles
 * Валидация списка профилей
 * 
 * Body:
 * - profileIds: uuid[]
 */
router.post('/:campaignId/validate-profiles', campaignActionRateLimiter, controller.validateProfiles);

// ============================================
// Export Routes
// ============================================

/**
 * GET /api/campaigns/:campaignId/export
 * Экспорт результатов кампании в CSV
 * 
 * Query params:
 * - format: 'csv' | 'json' (default: 'csv')
 */
router.get('/:campaignId/export', controller.exportCampaign);

export { router as campaignsRoutes };

