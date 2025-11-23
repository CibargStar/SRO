/**
 * Сервис для работы с конфигурациями импорта
 * 
 * Предоставляет CRUD операции для управления конфигурациями импорта пользователей.
 * 
 * @module modules/import/services/import-config.service
 */

import { PrismaClient } from '@prisma/client';
import logger from '../../../config/logger';
import type { ImportConfig } from '../types/import-config.types';
import { getDefaultImportConfig, PRESET_TEMPLATES } from '../types/import-config.types';

/**
 * Создает новую конфигурацию импорта
 * 
 * @param config - Конфигурация импорта
 * @param prisma - Prisma клиент
 * @returns Созданная конфигурация с ID
 */
export async function createImportConfig(
  config: Omit<ImportConfig, 'id' | 'createdAt' | 'updatedAt'>,
  prisma: PrismaClient
): Promise<ImportConfig> {
  // Если это конфигурация по умолчанию, снимаем флаг с других конфигураций пользователя
  if (config.isDefault) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    await prisma.importConfig.updateMany({
      where: {
        userId: config.userId,
        isDefault: true,
      },
      data: {
        isDefault: false,
      },
    });
  }

  // Создание конфигурации
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
  const created = await prisma.importConfig.create({
    data: {
      userId: config.userId,
      name: config.name,
      description: config.description ?? null,
      isDefault: config.isDefault ?? false,
      config: JSON.stringify(config),
    },
  });

  logger.info('Import config created', {
    configId: created.id,
    userId: config.userId,
    name: config.name,
  });

  return {
    ...config,
    id: created.id,
    createdAt: created.createdAt,
    updatedAt: created.updatedAt,
  };
}

/**
 * Получает все конфигурации пользователя
 * 
 * @param userId - ID пользователя
 * @param prisma - Prisma клиент
 * @returns Массив конфигураций
 */
export async function getImportConfigs(
  userId: string,
  prisma: PrismaClient
): Promise<ImportConfig[]> {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
  const configs = await prisma.importConfig.findMany({
    where: {
      userId,
    },
    orderBy: [
      { isDefault: 'desc' },
      { createdAt: 'desc' },
    ],
  });

  return configs.map((c) => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      const configData = JSON.parse(c.config) as Omit<ImportConfig, 'id' | 'createdAt' | 'updatedAt'>;
      return {
        ...configData,
        id: c.id,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
      };
    } catch (error) {
      logger.error('Failed to parse import config', {
        configId: c.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      // Возвращаем конфигурацию по умолчанию в случае ошибки
      return {
        ...getDefaultImportConfig(userId),
        id: c.id,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
      };
    }
  });
}

/**
 * Получает конфигурацию по ID
 * 
 * @param configId - ID конфигурации
 * @param userId - ID пользователя (для проверки прав доступа)
 * @param prisma - Prisma клиент
 * @returns Конфигурация или null
 */
export async function getImportConfigById(
  configId: string,
  userId: string,
  prisma: PrismaClient
): Promise<ImportConfig | null> {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
  const config = await prisma.importConfig.findFirst({
    where: {
      id: configId,
      userId, // Проверка прав доступа
    },
  });

  if (!config) {
    return null;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const configData = JSON.parse(config.config) as Omit<ImportConfig, 'id' | 'createdAt' | 'updatedAt'>;
    return {
      ...configData,
      id: config.id,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
    };
  } catch (error) {
    logger.error('Failed to parse import config', {
      configId: config.id,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return null;
  }
}

/**
 * Получает конфигурацию по умолчанию для пользователя
 * 
 * @param userId - ID пользователя
 * @param prisma - Prisma клиент
 * @returns Конфигурация по умолчанию или null
 */
export async function getDefaultImportConfigForUser(
  userId: string,
  prisma: PrismaClient
): Promise<ImportConfig | null> {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
  const config = await prisma.importConfig.findFirst({
    where: {
      userId,
      isDefault: true,
    },
  });

  if (!config) {
    return null;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const configData = JSON.parse(config.config) as Omit<ImportConfig, 'id' | 'createdAt' | 'updatedAt'>;
    return {
      ...configData,
      id: config.id,
      createdAt: config.createdAt,
      updatedAt: config.updatedAt,
    };
  } catch (error) {
    logger.error('Failed to parse import config', {
      configId: config.id,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return null;
  }
}

/**
 * Обновляет конфигурацию импорта
 * 
 * @param configId - ID конфигурации
 * @param config - Обновленная конфигурация
 * @param userId - ID пользователя (для проверки прав доступа)
 * @param prisma - Prisma клиент
 * @returns Обновленная конфигурация или null
 */
export async function updateImportConfig(
  configId: string,
  config: Partial<Omit<ImportConfig, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>,
  userId: string,
  prisma: PrismaClient
): Promise<ImportConfig | null> {
  // Проверка входных данных
  if (!config) {
    throw new Error('Config data is required');
  }

  // Проверка существования и прав доступа
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
  const existing = await prisma.importConfig.findFirst({
    where: {
      id: configId,
      userId,
    },
  });

  if (!existing) {
    return null;
  }

  // Если устанавливается как конфигурация по умолчанию, снимаем флаг с других
  if (config && config.isDefault === true) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    await prisma.importConfig.updateMany({
      where: {
        userId,
        isDefault: true,
        id: { not: configId },
      },
      data: {
        isDefault: false,
      },
    });
  }

  // Парсим существующую конфигурацию
  let existingConfig: ImportConfig;
  try {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const parsed = JSON.parse(existing.config) as Partial<ImportConfig>;
    
    // Проверяем, что парсинг прошел успешно и есть необходимые поля
    if (!parsed || typeof parsed !== 'object') {
      throw new Error('Invalid config format');
    }
    
    // Используем userId из существующей записи, если его нет в парсе
    existingConfig = {
      ...getDefaultImportConfig(userId),
      ...parsed,
      id: configId,
      userId: parsed.userId || existing.userId,
      createdAt: existing.createdAt,
      updatedAt: existing.updatedAt,
    } as ImportConfig;
  } catch (error) {
    logger.error('Failed to parse existing import config', {
      configId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    // Если парсинг не удался, создаем новую конфигурацию на основе дефолтной
    existingConfig = {
      ...getDefaultImportConfig(userId),
      id: configId,
      userId: existing.userId,
      createdAt: existing.createdAt,
      updatedAt: existing.updatedAt,
    };
  }
  
  // Объединяем с новыми данными
  // Убеждаемся, что все обязательные поля присутствуют
  const updatedConfig: ImportConfig = {
    ...existingConfig,
    ...config,
    id: configId,
    userId: existingConfig.userId || existing.userId,
    // Убеждаемся, что обязательные поля не undefined
    name: config.name ?? existingConfig.name,
    searchScope: config.searchScope ?? existingConfig.searchScope,
    duplicateAction: config.duplicateAction ?? existingConfig.duplicateAction,
    noDuplicateAction: config.noDuplicateAction ?? existingConfig.noDuplicateAction,
    validation: config.validation ?? existingConfig.validation,
    additional: config.additional ?? existingConfig.additional,
  };

  // Обновление конфигурации
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
  const updated = await prisma.importConfig.update({
    where: { id: configId },
    data: {
      name: updatedConfig.name,
      description: updatedConfig.description ?? null,
      isDefault: updatedConfig.isDefault ?? false,
      config: JSON.stringify(updatedConfig),
    },
  });

  logger.info('Import config updated', {
    configId,
    userId,
    name: updatedConfig.name,
  });

  return {
    ...updatedConfig,
    createdAt: updated.createdAt,
    updatedAt: updated.updatedAt,
  };
}

/**
 * Удаляет конфигурацию импорта
 * 
 * @param configId - ID конфигурации
 * @param userId - ID пользователя (для проверки прав доступа)
 * @param prisma - Prisma клиент
 * @returns true если удалено, false если не найдено
 */
export async function deleteImportConfig(
  configId: string,
  userId: string,
  prisma: PrismaClient
): Promise<boolean> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const deleted = await prisma.importConfig.deleteMany({
      where: {
        id: configId,
        userId, // Проверка прав доступа
      },
    });

    if (deleted.count > 0) {
      logger.info('Import config deleted', {
        configId,
        userId,
      });
      return true;
    }

    return false;
  } catch (error) {
    logger.error('Failed to delete import config', {
      configId,
      userId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return false;
  }
}

/**
 * Создает конфигурацию из предустановленного шаблона
 * 
 * @param templateName - Название шаблона
 * @param userId - ID пользователя
 * @param customName - Кастомное название (опционально)
 * @param prisma - Prisma клиент
 * @returns Созданная конфигурация или null если шаблон не найден
 */
export async function createConfigFromTemplate(
  templateName: string,
  userId: string,
  customName?: string,
  prisma?: PrismaClient
): Promise<ImportConfig | null> {
  const template = PRESET_TEMPLATES[templateName];
  if (!template) {
    return null;
  }

  const config: Omit<ImportConfig, 'id' | 'createdAt' | 'updatedAt'> = {
    ...template,
    name: customName || template.name,
    userId,
  };

  if (prisma) {
    return await createImportConfig(config, prisma);
  }

  // Если prisma не передан, возвращаем конфигурацию без сохранения
  return config as ImportConfig;
}

