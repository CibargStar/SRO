/**
 * Инициализация глобальных настроек кампаний
 * 
 * Гарантирует наличие записи CampaignGlobalSettings в БД при старте сервера.
 * Вызывается в bootstrap() один раз.
 */

import { PrismaClient } from '@prisma/client';
import { logger } from '../../config';
import { CampaignSettingsRepository } from './campaign-settings.repository';

/**
 * Создаёт дефолтные настройки кампаний если их ещё нет
 * 
 * @param prisma - Prisma клиент
 */
export async function ensureCampaignGlobalSettings(prisma: PrismaClient): Promise<void> {
  const repository = new CampaignSettingsRepository(prisma);

  try {
    const exists = await repository.exists();

    if (!exists) {
      logger.info('Creating default campaign global settings...');
      await repository.createGlobalSettings();
      logger.info('Default campaign global settings created successfully');
    } else {
      logger.info('Campaign global settings already exist');
    }
  } catch (error) {
    logger.error('Failed to ensure campaign global settings', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}


