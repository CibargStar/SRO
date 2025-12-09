import { PrismaClient } from '@prisma/client';
import { WebSocketServer } from '../../websocket';
import { CampaignExecutorService } from './campaign-executor.service';
import { CampaignRecoveryService, getCampaignRecoveryService } from '../recovery/campaign-recovery.service';

let executorInstance: CampaignExecutorService | null = null;
let recoveryInstance: CampaignRecoveryService | null = null;

export function getCampaignExecutorService(prisma: PrismaClient, wsServer?: WebSocketServer): CampaignExecutorService {
  executorInstance ??= new CampaignExecutorService(prisma, wsServer);
  return executorInstance;
}

export function getCampaignRecovery(prisma: PrismaClient, wsServer?: WebSocketServer): CampaignRecoveryService {
  const executor = getCampaignExecutorService(prisma, wsServer);
  recoveryInstance ??= getCampaignRecoveryService(prisma, executor, executor.getErrorHandler());
  return recoveryInstance;
}

