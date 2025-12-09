/**
 * Campaign Recovery Service
 *
 * Восстанавливает и мониторит кампании после рестарта и при сбоях профилей/сети.
 * Интегрируется с Executor, ErrorHandler, LoadBalancer.
 */

import { PrismaClient } from '@prisma/client';
import logger from '../../../config/logger';
import { CampaignRepository } from '../campaigns.repository';
import { CampaignExecutorService } from '../executor/campaign-executor.service';
import { CampaignErrorHandler } from '../error-handling/campaign-error-handler';
import { LoadBalancerService } from '../load-balancer';
import { CampaignSettingsRepository } from '../../campaign-settings/campaign-settings.repository';

export class CampaignRecoveryService {
  private campaignRepo: CampaignRepository;
  private loadBalancer: LoadBalancerService;
  private settingsRepo: CampaignSettingsRepository;

  constructor(
    _prisma: PrismaClient,
    private executor: CampaignExecutorService,
    private errorHandler: CampaignErrorHandler
  ) {
    this.campaignRepo = new CampaignRepository(_prisma);
    this.loadBalancer = new LoadBalancerService(_prisma);
    this.settingsRepo = new CampaignSettingsRepository(_prisma);
  }

  /**
   * Восстановить кампании после рестарта (RUNNING/PAUSED/QUEUED)
   */
  async restoreRunningCampaigns(): Promise<void> {
    const settings = await this.settingsRepo.getOrCreate();
    const autoResumeEnabled = Boolean(settings.autoResumeAfterRestart);
    const active = await this.campaignRepo.findRunning();
    logger.info('Recovery: found active campaigns', { count: active.length });

    for (const campaign of active) {
      await this.restoreSingle(campaign.id, campaign.userId, campaign.status, autoResumeEnabled);
    }
  }

  private async restoreSingle(
    campaignId: string,
    userId: string,
    status: string,
    autoResumeEnabled: boolean
  ): Promise<void> {
    try {
      if (autoResumeEnabled && status === 'RUNNING') {
        await this.executor.startCampaign(campaignId);
        logger.info('Recovery: resumed campaign', { campaignId });
      } else if (status === 'PAUSED') {
        logger.info('Recovery: campaign paused left as-is', { campaignId });
      } else if (status === 'QUEUED') {
        await this.executor.startCampaign(campaignId);
        logger.info('Recovery: queued campaign started', { campaignId });
      }
    } catch (error: unknown) {
      const message = this.toMessage(error);
      logger.error('Recovery failed to resume campaign', { campaignId, message });
      this.errorHandler.handleCriticalError(
        { campaignId, userId, isCritical: true },
        `Recovery failed: ${message}`
      );
    }
  }

  /**
   * Перераспределение при падении профиля (stub — логика rebalance в load-balancer)
   */
  async rebalanceOnProfileFailure(campaignId: string, failedProfileId: string): Promise<void> {
    try {
      const result = await this.loadBalancer.rebalanceOnProfileFailure(campaignId, failedProfileId);
      logger.info('Rebalance executed', {
        campaignId,
        failedProfileId,
        reassigned: result.reassignedCount,
        distribution: result.newDistribution,
      });
    } catch (error: unknown) {
      const message = this.toMessage(error);
      logger.error('Rebalance failed', { campaignId, failedProfileId, message });
      this.errorHandler.handleMessengerError(
        { campaignId, userId: '', profileId: failedProfileId },
        `Rebalance failed: ${message}`
      );
    }
  }

  private toMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    if (typeof error === 'string') {
      return error;
    }
    return 'Unknown error';
  }
}

let recoveryInstance: CampaignRecoveryService | null = null;

export function getCampaignRecoveryService(
  prisma: PrismaClient,
  executor: CampaignExecutorService,
  errorHandler: CampaignErrorHandler
): CampaignRecoveryService {
  recoveryInstance ??= new CampaignRecoveryService(prisma, executor, errorHandler);
  return recoveryInstance;
}

