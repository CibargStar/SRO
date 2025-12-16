/**
 * Роуты для админ-панели управления кампаниями (ROOT только)
 * 
 * Предоставляет endpoints для:
 * - Управления глобальными настройками кампаний
 * - Управления лимитами пользователей
 * - Просмотра всех кампаний системы
 * - Остановки любой кампании
 * 
 * @module modules/campaigns/campaign-admin.routes
 */

import { Router } from 'express';
import { CampaignAdminController } from './campaign-admin.controller';
import { authMiddleware, requireAuth, requireRoot } from '../../middleware';

const router = Router();
const controller = new CampaignAdminController();

// ============================================
// Global Settings Routes
// ============================================

/**
 * GET /api/admin/campaigns/settings
 * Получить глобальные настройки кампаний
 */
router.get(
  '/settings',
  authMiddleware,
  requireAuth,
  requireRoot,
  controller.getGlobalSettings
);

/**
 * PUT /api/admin/campaigns/settings
 * Обновить глобальные настройки кампаний
 */
router.put(
  '/settings',
  authMiddleware,
  requireAuth,
  requireRoot,
  controller.updateGlobalSettings
);

// ============================================
// User Limits Routes
// ============================================

/**
 * GET /api/admin/campaigns/limits
 * Получить все лимиты пользователей
 */
router.get(
  '/limits',
  authMiddleware,
  requireAuth,
  requireRoot,
  controller.getAllLimits
);

/**
 * GET /api/admin/campaigns/limits/:userId
 * Получить лимиты конкретного пользователя
 */
router.get(
  '/limits/:userId',
  authMiddleware,
  requireAuth,
  requireRoot,
  controller.getUserLimits
);

/**
 * PUT /api/admin/campaigns/limits/:userId
 * Установить лимиты пользователя
 */
router.put(
  '/limits/:userId',
  authMiddleware,
  requireAuth,
  requireRoot,
  controller.setUserLimits
);

// ============================================
// All Campaigns Routes
// ============================================

/**
 * GET /api/admin/campaigns/all
 * Получить все кампании системы
 */
router.get(
  '/all',
  authMiddleware,
  requireAuth,
  requireRoot,
  controller.getAllCampaigns
);

/**
 * POST /api/admin/campaigns/:campaignId/cancel
 * Остановить любую кампанию
 */
router.post(
  '/:campaignId/cancel',
  authMiddleware,
  requireAuth,
  requireRoot,
  controller.stopAnyCampaign
);

export default router;




