/**
 * Контроллер для управления кампаниями рассылки
 * 
 * Обрабатывает HTTP-запросы, валидирует входные данные
 * и вызывает соответствующие методы сервиса.
 * 
 * @module modules/campaigns/campaigns.controller
 */

import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../middleware/auth';
import { CampaignsService, getCampaignsService } from './campaigns.service';
import { getCampaignExecutorService } from './executor';
import {
  createCampaignSchema,
  updateCampaignSchema,
  listCampaignsQuerySchema,
  listMessagesQuerySchema,
  listLogsQuerySchema,
  startCampaignSchema,
  duplicateCampaignSchema,
  updateCampaignProfilesSchema,
  campaignIdParamSchema,
} from './campaigns.schemas';
import prisma from '../../config/database';
import logger from '../../config/logger';
import { WebSocketServer } from '../websocket';

// ============================================
// Controller Class
// ============================================

export class CampaignsController {
  private service: CampaignsService;

  constructor() {
    this.service = getCampaignsService(prisma);
  }

  private resolveWsServer(req: AuthenticatedRequest): WebSocketServer | undefined {
    const wsServerUnknown: unknown = req.app.get('wsServer');
    if (wsServerUnknown instanceof WebSocketServer) {
      return wsServerUnknown;
    }
    return undefined;
  }

  // ============================================
  // CRUD Handlers
  // ============================================

  /**
   * Получение списка кампаний пользователя
   * GET /api/campaigns
   */
  listCampaigns = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId = req.user!.id;
      const query = listCampaignsQuerySchema.parse(req.query);

      const result = await this.service.listCampaigns(userId, query);

      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  /**
   * Получение кампании по ID
   * GET /api/campaigns/:campaignId
   */
  getCampaign = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId = req.user!.id;
      const isRoot = req.user!.role === 'ROOT';
      const { campaignId } = campaignIdParamSchema.parse(req.params);

      const campaign = await this.service.getCampaign(userId, campaignId, isRoot);

      res.json(campaign);
    } catch (error) {
      next(error);
    }
  };

  /**
   * Создание новой кампании
   * POST /api/campaigns
   */
  createCampaign = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId = req.user!.id;
      const input = createCampaignSchema.parse(req.body);

      const campaign = await this.service.createCampaign(userId, input);

      logger.info('Campaign created via API', { campaignId: campaign.id, userId });

      res.status(201).json(campaign);
    } catch (error) {
      next(error);
    }
  };

  /**
   * Обновление кампании
   * PATCH /api/campaigns/:campaignId
   */
  updateCampaign = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId = req.user!.id;
      const { campaignId } = campaignIdParamSchema.parse(req.params);
      const input = updateCampaignSchema.parse(req.body);

      const campaign = await this.service.updateCampaign(userId, campaignId, input);

      logger.info('Campaign updated via API', { campaignId, userId });

      res.json(campaign);
    } catch (error) {
      next(error);
    }
  };

  /**
   * Удаление кампании
   * DELETE /api/campaigns/:campaignId
   */
  deleteCampaign = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId = req.user!.id;
      const { campaignId } = campaignIdParamSchema.parse(req.params);

      await this.service.deleteCampaign(userId, campaignId);

      logger.info('Campaign deleted via API', { campaignId, userId });

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };

  // ============================================
  // Action Handlers
  // ============================================

  /**
   * Дублирование кампании
   * POST /api/campaigns/:campaignId/duplicate
   */
  duplicateCampaign = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId = req.user!.id;
      const { campaignId } = campaignIdParamSchema.parse(req.params);
      const input = duplicateCampaignSchema.parse(req.body);

      const newCampaign = await this.service.duplicateCampaign(userId, campaignId, input);

      logger.info('Campaign duplicated via API', {
        sourceCampaignId: campaignId,
        newCampaignId: newCampaign.id,
        userId,
      });

      res.status(201).json(newCampaign);
    } catch (error) {
      next(error);
    }
  };

  /**
   * Архивирование кампании
   * POST /api/campaigns/:campaignId/archive
   */
  archiveCampaign = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId = req.user!.id;
      const { campaignId } = campaignIdParamSchema.parse(req.params);

      const campaign = await this.service.archiveCampaign(userId, campaignId);

      logger.info('Campaign archived via API', { campaignId, userId });

      res.json(campaign);
    } catch (error) {
      next(error);
    }
  };

  /**
   * Валидация кампании перед запуском
   * POST /api/campaigns/:campaignId/validate
   */
  validateCampaign = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId = req.user!.id;
      const { campaignId } = campaignIdParamSchema.parse(req.params);

      const result = await this.service.validateCampaign(userId, campaignId);

      res.json(result);
    } catch (error) {
      next(error);
    }
  };

  /**
   * Расчёт контактов для кампании
   * GET /api/campaigns/:campaignId/calculate-contacts
   */
  calculateContacts = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId = req.user!.id;
      const { campaignId } = campaignIdParamSchema.parse(req.params);

      // Проверка доступа
      const campaign = await this.service.getCampaign(userId, campaignId);
      if (!campaign) {
        res.status(404).json({ error: 'Кампания не найдена' });
        return;
      }

      const contacts = await this.service.calculateContacts(campaignId);

      res.json(contacts);
    } catch (error) {
      next(error);
    }
  };

  // ============================================
  // Campaign Control Handlers (Stubs for Executor)
  // ============================================

  /**
   * Запуск кампании
   * POST /api/campaigns/:campaignId/start
   * 
   * NOTE: Полная реализация будет добавлена в ЭТАП 6 (Campaign Executor)
   */
  startCampaign = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId = req.user!.id;
      const { campaignId } = campaignIdParamSchema.parse(req.params);
      const input = startCampaignSchema.parse(req.body);

      // Валидация перед запуском
      const validation = await this.service.validateCampaign(userId, campaignId);

      if (!validation.valid && !input.force) {
        res.status(400).json({
          error: 'Кампания не прошла валидацию',
          validation,
        });
        return;
      }

      // Подготовка очереди и перевод в QUEUED
      await this.service.queueCampaign(userId, campaignId, input.profileIds);

      const wsServer = this.resolveWsServer(req);
      const executor = getCampaignExecutorService(prisma, wsServer);
      await executor.startCampaign(campaignId);

      res.json({
        campaignId,
        status: 'RUNNING',
        validation,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Приостановка кампании
   * POST /api/campaigns/:campaignId/pause
   * 
   * NOTE: Полная реализация будет добавлена в ЭТАП 6 (Campaign Executor)
   */
  pauseCampaign = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { campaignId } = campaignIdParamSchema.parse(req.params);

      const wsServer = this.resolveWsServer(req);
      const executor = getCampaignExecutorService(prisma, wsServer);
      await executor.pauseCampaign(campaignId);

      res.json({
        campaignId,
        status: 'PAUSED',
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Возобновление кампании
   * POST /api/campaigns/:campaignId/resume
   * 
   * NOTE: Полная реализация будет добавлена в ЭТАП 6 (Campaign Executor)
   */
  resumeCampaign = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { campaignId } = campaignIdParamSchema.parse(req.params);

      const wsServer = this.resolveWsServer(req);
      const executor = getCampaignExecutorService(prisma, wsServer);
      await executor.resumeCampaign(campaignId);

      res.json({
        campaignId,
        status: 'RUNNING',
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Отмена кампании
   * POST /api/campaigns/:campaignId/cancel
   * 
   * NOTE: Полная реализация будет добавлена в ЭТАП 6 (Campaign Executor)
   */
  cancelCampaign = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { campaignId } = campaignIdParamSchema.parse(req.params);

      const wsServer = this.resolveWsServer(req);
      const executor = getCampaignExecutorService(prisma, wsServer);
      await executor.cancelCampaign(campaignId);

      res.json({
        campaignId,
        status: 'CANCELLED',
      });
    } catch (error) {
      next(error);
    }
  };

  // ============================================
  // Monitoring Handlers
  // ============================================

  /**
   * Получение прогресса кампании
   * GET /api/campaigns/:campaignId/progress
   * 
   * NOTE: Полная реализация с WebSocket будет добавлена позже
   */
  getProgress = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId = req.user!.id;
      const { campaignId } = campaignIdParamSchema.parse(req.params);

      const stats = await this.service.getCampaignStats(userId, campaignId);

      // Расчёт прогресса
      const progress = stats.campaign.totalContacts > 0
        ? (stats.campaign.processedContacts / stats.campaign.totalContacts) * 100
        : 0;

      res.json({
        campaign: stats.campaign,
        progress: Math.round(progress * 100) / 100, // 2 знака после запятой
        messages: stats.messages,
        byMessenger: stats.byMessenger,
        profiles: stats.profiles,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Получение сообщений кампании
   * GET /api/campaigns/:campaignId/messages
   */
  getMessages = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId = req.user!.id;
      const { campaignId } = campaignIdParamSchema.parse(req.params);
      const query = listMessagesQuerySchema.parse(req.query);

      const messages = await this.service.getCampaignMessages(userId, campaignId, query);

      res.json(messages);
    } catch (error) {
      next(error);
    }
  };

  /**
   * Получение логов кампании
   * GET /api/campaigns/:campaignId/logs
   */
  getLogs = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId = req.user!.id;
      const { campaignId } = campaignIdParamSchema.parse(req.params);
      const query = listLogsQuerySchema.parse(req.query);

      const logs = await this.service.getCampaignLogs(userId, campaignId, query);

      res.json(logs);
    } catch (error) {
      next(error);
    }
  };

  /**
   * Получение статистики кампании
   * GET /api/campaigns/:campaignId/stats
   */
  getStats = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId = req.user!.id;
      const { campaignId } = campaignIdParamSchema.parse(req.params);

      const stats = await this.service.getCampaignStats(userId, campaignId);

      res.json(stats);
    } catch (error) {
      next(error);
    }
  };

  // ============================================
  // Profile Management Handlers
  // ============================================

  /**
   * Обновление профилей кампании
   * PUT /api/campaigns/:campaignId/profiles
   */
  updateProfiles = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId = req.user!.id;
      const { campaignId } = campaignIdParamSchema.parse(req.params);
      const { profileIds } = updateCampaignProfilesSchema.parse(req.body);

      const profiles = await this.service.updateCampaignProfiles(userId, campaignId, profileIds);

      logger.info('Campaign profiles updated via API', { campaignId, profileCount: profileIds.length });

      res.json(profiles);
    } catch (error) {
      next(error);
    }
  };

  /**
   * Валидация профилей для кампании
   * POST /api/campaigns/:campaignId/validate-profiles
   */
  validateProfiles = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId = req.user!.id;
      const { campaignId } = campaignIdParamSchema.parse(req.params);
      const { profileIds } = updateCampaignProfilesSchema.parse(req.body);

      const validation = await this.service.validateProfiles(userId, profileIds, campaignId);

      res.json(validation);
    } catch (error) {
      next(error);
    }
  };

  // ============================================
  // Export Handler
  // ============================================

  /**
   * Экспорт результатов кампании
   * GET /api/campaigns/:campaignId/export
   * 
   * NOTE: Полная реализация будет добавлена в ЭТАП 5.7 (Campaign Stats Service)
   */
  exportCampaign = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const { campaignId } = campaignIdParamSchema.parse(req.params);

      // TODO: Вызов CampaignStatsService.exportToCsv() будет добавлен в ЭТАП 5.7
      await Promise.resolve();
      res.status(501).json({
        error: 'Функция экспорта будет реализована в следующем этапе',
        campaignId,
      });
    } catch (error) {
      next(error);
    }
  };
}

// Singleton instance
let controllerInstance: CampaignsController | null = null;

export function getCampaignsController(): CampaignsController {
  controllerInstance ??= new CampaignsController();
  return controllerInstance;
}

