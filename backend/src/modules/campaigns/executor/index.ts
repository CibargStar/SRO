import { PrismaClient } from '@prisma/client';
import { WebSocketServer } from '../../websocket';
import { CampaignExecutorService } from './campaign-executor.service';
import { CampaignRecoveryService, getCampaignRecoveryService } from '../recovery/campaign-recovery.service';
import type { ChromeProcessService } from '../../profiles/chrome-process/chrome-process.service';

export { CampaignExecutorService };

let executorInstance: CampaignExecutorService | null = null;
let recoveryInstance: CampaignRecoveryService | null = null;

export function getCampaignExecutorService(
  prisma: PrismaClient,
  wsServer?: WebSocketServer,
  chromeProcessService?: ChromeProcessService
): CampaignExecutorService {
  executorInstance ??= new CampaignExecutorService(prisma, wsServer, chromeProcessService);
  return executorInstance;
}

export function getCampaignRecovery(
  prisma: PrismaClient,
  wsServer?: WebSocketServer,
  chromeProcessService?: ChromeProcessService
): CampaignRecoveryService {
  const executor = getCampaignExecutorService(prisma, wsServer, chromeProcessService);
  recoveryInstance ??= getCampaignRecoveryService(prisma, executor, executor.getErrorHandler());
  return recoveryInstance;
}

