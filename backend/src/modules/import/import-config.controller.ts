/**
 * Контроллер для работы с конфигурациями импорта
 * 
 * Обрабатывает HTTP запросы для управления конфигурациями импорта:
 * - GET /api/import/configs - список конфигураций пользователя
 * - GET /api/import/configs/:id - получение конфигурации по ID
 * - POST /api/import/configs - создание конфигурации
 * - PUT /api/import/configs/:id - обновление конфигурации
 * - DELETE /api/import/configs/:id - удаление конфигурации
 * - POST /api/import/configs/template/:name - создание из шаблона
 * 
 * @module modules/import/import-config.controller
 */

import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../middleware/auth';
import { ValidatedRequest, ValidatedQueryRequest } from '../../middleware/zodValidate';
import { prisma } from '../../config';
import logger from '../../config/logger';
import {
  createImportConfig,
  getImportConfigs,
  getImportConfigById,
  getDefaultImportConfigForUser,
  updateImportConfig,
  deleteImportConfig,
  createConfigFromTemplate,
} from './services/import-config.service';
import { getDefaultImportConfig, PRESET_TEMPLATES, type ImportConfig } from './types/import-config.types';
import type { ImportConfigInput, GetImportConfigsQuery } from './schemas/import-config.schemas';

/**
 * Обработчик получения списка конфигураций
 * 
 * GET /api/import/configs
 */
export async function listImportConfigsHandler(
  req: ValidatedQueryRequest<GetImportConfigsQuery> & AuthenticatedRequest,
  res: Response,
  _next: NextFunction
): Promise<void> {
  try {
    const currentUser = req.user;
    if (!currentUser) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const configs = await getImportConfigs(currentUser.id, prisma);

    // Если запрошены шаблоны, добавляем их к списку
    const includeTemplates = req.validatedQuery?.includeTemplates ?? false;
    let templates: Array<{ id: string; name: string; description?: string; isTemplate: true }> = [];
    
    if (includeTemplates) {
      templates = Object.entries(PRESET_TEMPLATES).map(([key, template]) => ({
        id: `template_${key}`,
        name: template.name,
        description: template.description,
        isTemplate: true as const,
      }));
    }

    res.status(200).json({
      configs,
      templates,
    });
  } catch (error) {
    logger.error('Unexpected error during import configs list retrieval', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: req.user?.id,
    });

    res.status(500).json({ message: 'Internal server error' });
  }
}

/**
 * Обработчик получения конфигурации по ID
 * 
 * GET /api/import/configs/:id
 */
export async function getImportConfigHandler(
  req: AuthenticatedRequest & { params: { id: string } },
  res: Response,
  _next: NextFunction
): Promise<void> {
  try {
    const currentUser = req.user;
    if (!currentUser) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const { id } = req.params;

    // Проверка на шаблон
    if (id.startsWith('template_')) {
      const templateName = id.replace('template_', '');
      const template = PRESET_TEMPLATES[templateName];
      
      if (!template) {
        res.status(404).json({ message: 'Template not found' });
        return;
      }

      res.status(200).json({
        ...template,
        id,
        userId: currentUser.id,
        isTemplate: true,
      });
      return;
    }

    const config = await getImportConfigById(id, currentUser.id, prisma);

    if (!config) {
      res.status(404).json({ message: 'Import config not found' });
      return;
    }

    res.status(200).json(config);
  } catch (error) {
    logger.error('Unexpected error during import config retrieval', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: req.user?.id,
    });

    res.status(500).json({ message: 'Internal server error' });
  }
}

/**
 * Обработчик получения конфигурации по умолчанию
 * 
 * GET /api/import/configs/default
 */
export async function getDefaultImportConfigHandler(
  req: AuthenticatedRequest,
  res: Response,
  _next: NextFunction
): Promise<void> {
  try {
    const currentUser = req.user;
    if (!currentUser) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    let config = await getDefaultImportConfigForUser(currentUser.id, prisma);

    // Если нет конфигурации по умолчанию, возвращаем системную по умолчанию
    if (!config) {
      config = getDefaultImportConfig(currentUser.id);
    }

    res.status(200).json(config);
  } catch (error) {
    logger.error('Unexpected error during default import config retrieval', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: req.user?.id,
    });

    res.status(500).json({ message: 'Internal server error' });
  }
}

/**
 * Обработчик создания конфигурации
 * 
 * POST /api/import/configs
 */
export async function createImportConfigHandler(
  req: ValidatedRequest<ImportConfigInput> & AuthenticatedRequest,
  res: Response,
  _next: NextFunction
): Promise<void> {
  try {
    const currentUser = req.user;
    if (!currentUser) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const input = req.body as ImportConfigInput;
    const config: Omit<ImportConfig, 'id' | 'createdAt' | 'updatedAt'> = {
      userId: currentUser.id,
      name: input.name,
      description: input.description ?? undefined,
      isDefault: Boolean(input.isDefault ?? false),
      searchScope: input.searchScope,
      duplicateAction: input.duplicateAction,
      noDuplicateAction: input.noDuplicateAction,
      validation: input.validation,
      additional: input.additional,
    };

    const created = await createImportConfig(config, prisma);

    res.status(201).json(created);
  } catch (error) {
    logger.error('Unexpected error during import config creation', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: req.user?.id,
    });

    res.status(500).json({ message: 'Internal server error' });
  }
}

/**
 * Обработчик обновления конфигурации
 * 
 * PUT /api/import/configs/:id
 */
export async function updateImportConfigHandler(
  req: ValidatedRequest<Partial<ImportConfigInput>> & AuthenticatedRequest & { params: { id: string } },
  res: Response,
  _next: NextFunction
): Promise<void> {
  try {
    const currentUser = req.user;
    if (!currentUser) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const { id } = req.params;
    const configData = req.body as Partial<ImportConfigInput>;

    if (!configData || Object.keys(configData).length === 0) {
      res.status(400).json({ message: 'Config data is required' });
      return;
    }

    const updatePayload: Partial<Omit<ImportConfig, 'id' | 'userId' | 'createdAt' | 'updatedAt'>> = {
      ...(configData.name !== undefined ? { name: configData.name } : {}),
      ...(configData.description !== undefined ? { description: configData.description ?? undefined } : {}),
      ...(configData.isDefault !== undefined ? { isDefault: configData.isDefault } : {}),
      ...(configData.searchScope !== undefined ? { searchScope: configData.searchScope } : {}),
      ...(configData.duplicateAction !== undefined ? { duplicateAction: configData.duplicateAction } : {}),
      ...(configData.noDuplicateAction !== undefined ? { noDuplicateAction: configData.noDuplicateAction } : {}),
      ...(configData.validation !== undefined ? { validation: configData.validation } : {}),
      ...(configData.additional !== undefined ? { additional: configData.additional } : {}),
    };

    const updated = await updateImportConfig(id, updatePayload, currentUser.id, prisma);

    if (!updated) {
      res.status(404).json({ message: 'Import config not found' });
      return;
    }

    res.status(200).json(updated);
  } catch (error) {
    logger.error('Unexpected error during import config update', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: req.user?.id,
    });

    res.status(500).json({ message: 'Internal server error' });
  }
}

/**
 * Обработчик удаления конфигурации
 * 
 * DELETE /api/import/configs/:id
 */
export async function deleteImportConfigHandler(
  req: AuthenticatedRequest & { params: { id: string } },
  res: Response,
  _next: NextFunction
): Promise<void> {
  try {
    const currentUser = req.user;
    if (!currentUser) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const { id } = req.params;

    const deleted = await deleteImportConfig(id, currentUser.id, prisma);

    if (!deleted) {
      res.status(404).json({ message: 'Import config not found' });
      return;
    }

    res.status(204).send();
  } catch (error) {
    logger.error('Unexpected error during import config deletion', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: req.user?.id,
    });

    res.status(500).json({ message: 'Internal server error' });
  }
}

/**
 * Обработчик создания конфигурации из шаблона
 * 
 * POST /api/import/configs/template/:name
 */
export async function createFromTemplateHandler(
  req: AuthenticatedRequest & { params: { name: string }; body?: { name?: string } },
  res: Response,
  _next: NextFunction
): Promise<void> {
  try {
    const currentUser = req.user;
    if (!currentUser) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const { name: templateName } = req.params;
    const customName = req.body?.name;

    const config = await createConfigFromTemplate(
      templateName,
      currentUser.id,
      customName,
      prisma
    );

    if (!config) {
      res.status(404).json({ message: 'Template not found' });
      return;
    }

    res.status(201).json(config);
  } catch (error) {
    logger.error('Unexpected error during template config creation', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: req.user?.id,
    });

    res.status(500).json({ message: 'Internal server error' });
  }
}

