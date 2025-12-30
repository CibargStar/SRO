/**
 * Инициализация справочника мессенджеров
 * 
 * Создает начальные записи мессенджеров (WhatsApp, Telegram) в базе данных.
 * Выполняется один раз при первом запуске или через отдельную команду.
 * 
 * @module modules/profiles/messenger-accounts/init-messenger-services
 */

import { PrismaClient } from '@prisma/client';
import logger from '../../../config/logger';

/**
 * Начальные данные мессенджеров
 */
const MESSENGER_SERVICES = [
  {
    name: 'whatsapp',
    displayName: 'WhatsApp',
    icon: null,
    enabled: true,
  },
  {
    name: 'telegram',
    displayName: 'Telegram',
    icon: null,
    enabled: true,
  },
] as const;

/**
 * Инициализация справочника мессенджеров
 * 
 * Создает записи мессенджеров, если их еще нет в базе данных.
 * 
 * @param prisma - Prisma Client instance
 */
export async function initMessengerServices(prisma: PrismaClient): Promise<void> {
  try {
    logger.info('Initializing messenger services...');

    for (const service of MESSENGER_SERVICES) {
      // Проверяем, существует ли уже мессенджер
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      const existing = await prisma.messengerService.findUnique({
        where: { name: service.name },
      });

      if (!existing) {
        // Создаем мессенджер
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        const created = await prisma.messengerService.create({
          data: {
            name: service.name,
            displayName: service.displayName,
            icon: service.icon,
            enabled: service.enabled,
          },
        });

        logger.info(`Messenger service created: ${service.displayName}`, {
          id: created.id,
          name: created.name,
        });

        // Создаем конфигурацию проверки с интервалом по умолчанию (5 минут)
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        await prisma.messengerCheckConfig.create({
          data: {
            serviceId: created.id,
            checkIntervalSeconds: 300, // 5 минут по умолчанию
            enabled: true,
          },
        });

        logger.info(`Check config created for ${service.displayName}`);
      } else {
        logger.debug(`Messenger service already exists: ${service.displayName}`);
        
        // Проверяем, существует ли конфигурация для существующего мессенджера
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        const existingConfig = await prisma.messengerCheckConfig.findUnique({
          where: { serviceId: existing.id },
        });
        
        // Если конфигурации нет - создаем её
        if (!existingConfig) {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
          await prisma.messengerCheckConfig.create({
            data: {
              serviceId: existing.id,
              checkIntervalSeconds: 300, // 5 минут по умолчанию
              enabled: true,
            },
          });
          
          logger.info(`Check config created for existing service: ${service.displayName}`);
        }
      }
    }

    logger.info('Messenger services initialization completed');
  } catch (error) {
    logger.error('Failed to initialize messenger services', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    throw error;
  }
}

/**
 * Проверка и инициализация справочника мессенджеров
 * 
 * Удобная функция для вызова из основного приложения.
 * 
 * @param prisma - Prisma Client instance
 */
export async function ensureMessengerServices(prisma: PrismaClient): Promise<void> {
  try {
    await initMessengerServices(prisma);
  } catch (error) {
    // Не прерываем запуск приложения, только логируем ошибку
    logger.warn('Messenger services initialization failed, continuing anyway', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

