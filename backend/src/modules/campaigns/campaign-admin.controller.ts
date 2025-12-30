/**
 * Админ-контроллер для управления кампаниями (ROOT только)
 * 
 * Предоставляет функции для:
 * - Управления глобальными настройками кампаний
 * - Управления лимитами пользователей
 * - Просмотра всех кампаний системы
 * - Остановки любой кампании
 * 
 * @module modules/campaigns/campaign-admin.controller
 */

import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../middleware/auth';
import { CampaignSettingsService, CampaignSettingsRepository } from '../campaign-settings';
import { UserCampaignLimitsService } from '../user-campaign-limits';
import { getCampaignExecutorService, CampaignExecutorService } from './executor';
import prisma from '../../config/database';
import logger from '../../config/logger';
import { z } from 'zod';

// ============================================
// Schemas
// ============================================

const updateGlobalSettingsSchema = z.object({
  pauseMode: z.number().int().min(1).max(2).optional(),
  delayBetweenContactsMs: z.number().int().min(0).optional(),
  delayBetweenMessagesMs: z.number().int().min(0).optional(),
  maxContactsPerProfilePerHour: z.number().int().min(1).optional(),
  maxContactsPerProfilePerDay: z.number().int().min(1).optional(),
  // ПРИМЕЧАНИЕ: defaultWorkHoursStart, defaultWorkHoursEnd, defaultWorkDays больше не используются
  // Рабочие часы настраиваются индивидуально для каждой кампании
  typingSimulationEnabled: z.boolean().optional(),
  typingSpeedCharsPerSec: z.number().int().min(1).optional(),
  maxRetriesOnError: z.number().int().min(0).optional(),
  retryDelayMs: z.number().int().min(0).optional(),
  pauseOnCriticalError: z.boolean().optional(),
  profileHealthCheckIntervalMs: z.number().int().min(5000).optional(),
  autoResumeAfterRestart: z.boolean().optional(),
  keepCompletedCampaignsDays: z.number().int().min(1).optional(),
  warmupEnabled: z.boolean().optional(),
  warmupDay1To3Limit: z.number().int().min(1).optional(),
  warmupDay4To7Limit: z.number().int().min(1).optional(),
});

const setUserLimitsSchema = z.object({
  maxActiveCampaigns: z.number().int().min(0).optional(),
  maxTemplates: z.number().int().min(0).optional(),
  maxTemplateCategories: z.number().int().min(0).optional(),
  maxFileSizeMb: z.number().int().min(1).optional(),
  maxTotalStorageMb: z.number().int().min(1).optional(),
  allowScheduledCampaigns: z.boolean().optional(),
  allowUniversalCampaigns: z.boolean().optional(),
});

const userIdParamSchema = z.object({
  userId: z.string().uuid(),
});

const campaignIdParamSchema = z.object({
  campaignId: z.string().uuid(),
});

// ============================================
// Controller Class
// ============================================

export class CampaignAdminController {
  private settingsService: CampaignSettingsService;
  private limitsService: UserCampaignLimitsService;

  constructor() {
    this.settingsService = new CampaignSettingsService(
      new CampaignSettingsRepository(prisma)
    );
    this.limitsService = new UserCampaignLimitsService();
  }

  // ============================================
  // Global Settings Handlers
  // ============================================

  /**
   * Получить глобальные настройки кампаний
   * GET /api/admin/campaigns/settings
   */
  getGlobalSettings = async (
    _req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const settings = await this.settingsService.getGlobalSettings();
      res.json(settings);
    } catch (error) {
      next(error);
    }
  };

  /**
   * Обновить глобальные настройки кампаний
   * PUT /api/admin/campaigns/settings
   */
  updateGlobalSettings = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId = req.user!.id;
      const input = updateGlobalSettingsSchema.parse(req.body);

      // Преобразуем defaultWorkDays в JSON строку, если передан массив
      const updateInput: Partial<{
        pauseMode?: number;
        delayBetweenContactsMs?: number;
        delayBetweenMessagesMs?: number;
        maxContactsPerProfilePerHour?: number;
        maxContactsPerProfilePerDay?: number;
        // ПРИМЕЧАНИЕ: defaultWorkHoursStart, defaultWorkHoursEnd, defaultWorkDays больше не используются
        typingSimulationEnabled?: boolean;
        typingSpeedCharsPerSec?: number;
        maxRetriesOnError?: number;
        retryDelayMs?: number;
        pauseOnCriticalError?: boolean;
        profileHealthCheckIntervalMs?: number;
        autoResumeAfterRestart?: boolean;
        keepCompletedCampaignsDays?: number;
        warmupEnabled?: boolean;
        warmupDay1To3Limit?: number;
        warmupDay4To7Limit?: number;
      }> = { ...input };
      // ПРИМЕЧАНИЕ: defaultWorkDays больше не используется

      const settings = await this.settingsService.updateGlobalSettings(updateInput, userId);
      res.json(settings);
    } catch (error) {
      next(error);
    }
  };

  // ============================================
  // User Limits Handlers
  // ============================================

  /**
   * Получить все лимиты пользователей
   * GET /api/admin/campaigns/limits
   */
  getAllLimits = async (
    _req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const limits = await this.limitsService.getAllLimits();
      res.json(limits);
    } catch (error) {
      next(error);
    }
  };

  /**
   * Получить лимиты конкретного пользователя
   * GET /api/admin/campaigns/limits/:userId
   */
  getUserLimits = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { userId } = userIdParamSchema.parse(req.params);
      const limits = await this.limitsService.getLimits(userId);
      res.json(limits);
    } catch (error) {
      next(error);
    }
  };

  /**
   * Установить лимиты пользователя
   * PUT /api/admin/campaigns/limits/:userId
   */
  setUserLimits = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const rootUserId = req.user!.id;
      const { userId } = userIdParamSchema.parse(req.params);
      const input = setUserLimitsSchema.parse(req.body);

      const limits = await this.limitsService.setLimits(userId, input, rootUserId);
      res.json(limits);
    } catch (error) {
      next(error);
    }
  };

  // ============================================
  // All Campaigns Handlers
  // ============================================

  /**
   * Получить все кампании системы (для ROOT)
   * GET /api/admin/campaigns/all
   */
  getAllCampaigns = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const query = z.object({
        page: z.coerce.number().int().min(1).default(1).optional(),
        limit: z.coerce.number().int().min(1).max(100).default(20).optional(),
        status: z.enum(['DRAFT', 'SCHEDULED', 'QUEUED', 'RUNNING', 'PAUSED', 'COMPLETED', 'CANCELLED', 'ERROR']).optional(),
        userId: z.string().uuid().optional(),
        includeArchived: z.coerce.boolean().default(false).optional(),
      }).parse(req.query);

      const campaigns = await prisma.campaign.findMany({
        where: {
          ...(query.status && { status: query.status }),
          ...(query.userId && { userId: query.userId }),
          ...(!query.includeArchived && { archivedAt: null }),
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
            },
          },
          template: {
            select: {
              id: true,
              name: true,
            },
          },
          clientGroup: {
            select: {
              id: true,
              name: true,
            },
          },
          _count: {
            select: {
              messages: true,
              logs: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip: (query.page! - 1) * query.limit!,
        take: query.limit!,
      });

      const total = await prisma.campaign.count({
        where: {
          ...(query.status && { status: query.status }),
          ...(query.userId && { userId: query.userId }),
          ...(!query.includeArchived && { archivedAt: null }),
        },
      });

      res.json({
        data: campaigns,
        pagination: {
          page: query.page!,
          limit: query.limit!,
          total,
          totalPages: Math.ceil(total / query.limit!),
        },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Остановить любую кампанию (для ROOT)
   * POST /api/admin/campaigns/:campaignId/cancel
   */
  stopAnyCampaign = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { campaignId } = campaignIdParamSchema.parse(req.params);
      const executorServiceUnknown: unknown = req.app.get('campaignExecutor');
      const executorService = (executorServiceUnknown instanceof CampaignExecutorService 
        ? executorServiceUnknown 
        : getCampaignExecutorService(prisma));

      await executorService.cancelCampaign(campaignId);

      logger.info(`Campaign ${campaignId} cancelled by ROOT user ${req.user!.id}`);

      res.json({ success: true, message: 'Campaign cancelled successfully' });
    } catch (error) {
      next(error);
    }
  };
}

