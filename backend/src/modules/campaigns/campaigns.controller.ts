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
import { getCampaignExecutorService, CampaignExecutorService } from './executor';
import { CampaignStatsService } from './stats';
import { CampaignProgressService } from './progress';
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
  private statsService: CampaignStatsService;
  private progressService: CampaignProgressService;

  constructor() {
    this.service = getCampaignsService(prisma);
    this.statsService = new CampaignStatsService(prisma);
    this.progressService = new CampaignProgressService(prisma);
  }

  private resolveWsServer(req: AuthenticatedRequest): WebSocketServer | undefined {
    const wsServerUnknown: unknown = req.app.get('wsServer');
    if (wsServerUnknown instanceof WebSocketServer) {
      return wsServerUnknown;
    }
    return undefined;
  }

  private resolveExecutor(req: AuthenticatedRequest): CampaignExecutorService {
    const executorUnknown: unknown = req.app.get('campaignExecutor');
    if (executorUnknown instanceof CampaignExecutorService) {
      return executorUnknown;
    }
    const wsServer = this.resolveWsServer(req);
    return getCampaignExecutorService(prisma, wsServer);
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
  // Campaign Control Handlers
  // ============================================

  /**
   * Запуск кампании
   * POST /api/campaigns/:campaignId/start
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

      const executor = this.resolveExecutor(req);
      await executor.startCampaign(campaignId);

      // Получаем обновлённую кампанию для возврата
      const campaign = await this.service.getCampaign(userId, campaignId);

      res.json(campaign);
    } catch (error) {
      next(error);
    }
  };

  /**
   * Приостановка кампании
   * POST /api/campaigns/:campaignId/pause
   */
  pauseCampaign = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId = req.user!.id;
      const { campaignId } = campaignIdParamSchema.parse(req.params);

      const executor = this.resolveExecutor(req);
      await executor.pauseCampaign(campaignId);

      // Получаем обновлённую кампанию для возврата
      const campaign = await this.service.getCampaign(userId, campaignId);

      res.json(campaign);
    } catch (error) {
      next(error);
    }
  };

  /**
   * Возобновление кампании
   * POST /api/campaigns/:campaignId/resume
   */
  resumeCampaign = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId = req.user!.id;
      const { campaignId } = campaignIdParamSchema.parse(req.params);

      const executor = this.resolveExecutor(req);
      await executor.resumeCampaign(campaignId);

      // Получаем обновлённую кампанию для возврата
      const campaign = await this.service.getCampaign(userId, campaignId);

      res.json(campaign);
    } catch (error) {
      next(error);
    }
  };

  /**
   * Отмена кампании
   * POST /api/campaigns/:campaignId/cancel
   */
  cancelCampaign = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId = req.user!.id;
      const { campaignId } = campaignIdParamSchema.parse(req.params);

      const executor = this.resolveExecutor(req);
      await executor.cancelCampaign(campaignId);

      // Получаем обновлённую кампанию для возврата
      const campaign = await this.service.getCampaign(userId, campaignId);

      res.json(campaign);
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
   */
  getProgress = async (
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

      // Используем CampaignProgressService для получения полного прогресса
      const backendProgress = await this.progressService.getProgress(campaignId);
      
      if (!backendProgress) {
        // Fallback к базовой статистике
        const stats = await this.service.getCampaignStats(userId, campaignId);
        const progressPercent = stats.campaign.totalContacts > 0
          ? Math.round((stats.campaign.processedContacts / stats.campaign.totalContacts) * 100)
          : 0;

        res.json({
          campaignId: stats.campaign.id,
          status: stats.campaign.status,
          totalContacts: stats.campaign.totalContacts,
          processedContacts: stats.campaign.processedContacts,
          successfulContacts: stats.campaign.successfulContacts,
          failedContacts: stats.campaign.failedContacts,
          skippedContacts: stats.campaign.skippedContacts,
          progressPercent,
          contactsPerMinute: 0,
          estimatedSecondsRemaining: null,
          estimatedCompletionTime: null,
          profilesProgress: stats.profiles.map((p) => ({
            profileId: p.profileId,
            profileName: p.profileName,
            status: p.status,
            assignedCount: p.assignedCount,
            processedCount: p.processedCount,
            successCount: p.successCount,
            failedCount: p.failedCount,
            progressPercent: p.assignedCount > 0 
              ? Math.round((p.processedCount / p.assignedCount) * 100)
              : 0,
          })),
          startedAt: stats.campaign.startedAt?.toISOString() || null,
          lastUpdateAt: new Date().toISOString(),
        });
        return;
      }

      // Преобразуем backend формат в frontend формат
      const frontendProgress = {
        campaignId: backendProgress.campaignId,
        status: backendProgress.status,
        totalContacts: backendProgress.totalContacts,
        processedContacts: backendProgress.processedContacts,
        successfulContacts: backendProgress.successfulContacts,
        failedContacts: backendProgress.failedContacts,
        skippedContacts: backendProgress.skippedContacts,
        progressPercent: backendProgress.progress,
        contactsPerMinute: backendProgress.speed,
        estimatedSecondsRemaining: backendProgress.eta,
        estimatedCompletionTime: backendProgress.eta 
          ? new Date(Date.now() + (backendProgress.eta * 1000)).toISOString()
          : null,
        profilesProgress: backendProgress.profiles.map((p) => ({
          profileId: p.profileId,
          profileName: p.profileName,
          status: p.status,
          assignedCount: p.assignedCount,
          processedCount: p.processedCount,
          successCount: p.successCount,
          failedCount: p.failedCount,
          progressPercent: p.progress,
        })),
        startedAt: backendProgress.startedAt?.toISOString() || null,
        lastUpdateAt: new Date().toISOString(),
      };

      res.json(frontendProgress);
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

      // Используем CampaignStatsService для получения полной статистики
      const stats = await this.statsService.getStats(campaignId);
      
      if (!stats) {
        // Если статистика не найдена, возвращаем 404
        res.status(404).json({ error: 'Статистика кампании не найдена' });
        return;
      }

      // Преобразуем даты в строки для frontend
      const frontendStats = {
        ...stats,
        startedAt: stats.startedAt ? stats.startedAt.toISOString() : null,
        completedAt: stats.completedAt ? stats.completedAt.toISOString() : null,
      };

      res.json(frontendStats);
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
   * Получение профилей кампании
   * GET /api/campaigns/:campaignId/profiles
   */
  getProfiles = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId = req.user!.id;
      const { campaignId } = campaignIdParamSchema.parse(req.params);

      // Проверка доступа
      await this.service.getCampaign(userId, campaignId);

      // Получаем профили через репозиторий
      const { CampaignProfileRepository } = await import('./campaigns.repository');
      const profileRepo = new CampaignProfileRepository(prisma);
      const profiles = await profileRepo.findByCampaignId(campaignId);

      // Преобразуем в формат для frontend
      const frontendProfiles = profiles.map((p) => ({
        id: p.id,
        campaignId: p.campaignId,
        profileId: p.profileId,
        profile: p.profile ? {
          id: p.profile.id,
          name: p.profile.name,
          status: p.profile.status,
        } : undefined,
        assignedCount: p.assignedCount,
        processedCount: p.processedCount,
        successCount: p.successCount,
        failedCount: p.failedCount,
        status: p.status,
        lastError: p.lastError,
        createdAt: p.createdAt.toISOString(),
        updatedAt: p.updatedAt.toISOString(),
      }));

      res.json(frontendProfiles);
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
   */
  exportCampaign = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const userId = req.user!.id;
      const { campaignId } = campaignIdParamSchema.parse(req.params);

      // Проверка доступа к кампании
      const campaign = await this.service.getCampaign(userId, campaignId);
      if (!campaign) {
        res.status(404).json({ error: 'Кампания не найдена' });
        return;
      }

      // Получаем параметры экспорта из query
      const format = (req.query.format as string) === 'json' ? 'json' : 'csv';
      const includeContacts = req.query.includeContacts !== 'false';
      const includeLogs = req.query.includeLogs === 'true';
      const includeErrors = req.query.includeErrors !== 'false';

      if (format === 'json') {
        // JSON экспорт - возвращаем статистику
        const stats = await this.statsService.getStats(campaignId);
        if (!stats) {
          res.status(404).json({ error: 'Статистика не найдена' });
          return;
        }
        res.json(stats);
      } else {
        // CSV экспорт
        const csvContent = await this.statsService.exportToCsv(campaignId, {
          format: 'csv',
          includeContacts,
          includeLogs,
          includeErrors,
        });

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="campaign_${campaignId}_export.csv"`);
        res.send(csvContent);
      }
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

