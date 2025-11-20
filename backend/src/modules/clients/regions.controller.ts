/**
 * Контроллер управления регионами
 * 
 * Обрабатывает HTTP запросы для управления регионами:
 * - POST /api/regions - создание региона (только ROOT)
 * - GET /api/regions - список всех регионов (доступно всем авторизованным)
 * - GET /api/regions/:id - получение региона по ID (доступно всем авторизованным)
 * - PATCH /api/regions/:id - обновление региона (только ROOT)
 * - DELETE /api/regions/:id - удаление региона (только ROOT)
 * 
 * Безопасность:
 * - Регионы - справочник, общий для всех пользователей
 * - Чтение доступно всем авторизованным пользователям
 * - Управление (создание/обновление/удаление) доступно только ROOT
 * 
 * @module modules/clients/regions.controller
 */

import { Response, NextFunction } from 'express';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { ValidatedRequest } from '../../middleware/zodValidate';
import { AuthenticatedRequest } from '../../middleware/auth';
import { CreateRegionInput, UpdateRegionInput } from './region.schemas';
import { prisma } from '../../config';
import logger from '../../config/logger';

/**
 * Обработчик создания региона
 * 
 * POST /api/regions
 * 
 * Логика:
 * 1. Создает регион с уникальным названием
 * 2. Возвращает созданный регион
 * 
 * Доступ: только ROOT (проверяется через requireRoot middleware)
 * 
 * @param req - Express Request с валидированным body (CreateRegionInput)
 * @param res - Express Response
 * @param next - Express NextFunction
 */
export async function createRegionHandler(
  req: ValidatedRequest<CreateRegionInput> & AuthenticatedRequest,
  res: Response,
  _next: NextFunction
): Promise<void> {
  try {
    const { name } = req.body;

    // Проверка уникальности названия
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const existingRegion = await prisma.region.findUnique({
      where: { name },
    });

    if (existingRegion) {
      logger.warn('Attempt to create region with existing name', { name });
      res.status(409).json({ message: 'Region with this name already exists' });
      return;
    }

    // Создание региона
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const newRegion = await prisma.region.create({
      data: {
        name,
      },
      include: {
        _count: {
          select: {
            clients: true, // Количество клиентов в регионе
          },
        },
      },
    });

    logger.info('Region created successfully', {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      regionId: newRegion.id,
      createdBy: req.user?.id,
    });

    res.status(201).json(newRegion);
  } catch (error: unknown) {
    // Обработка ошибок Prisma
    if (error instanceof PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        // Unique constraint violation
        logger.warn('Attempt to create region with existing name (Prisma)', {
          userId: req.user?.id,
        });
        res.status(409).json({ message: 'Region with this name already exists' });
        return;
      }
    }

    // Обработка неожиданных ошибок
    logger.error('Unexpected error during region creation', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: req.user?.id,
    });

    res.status(500).json({ message: 'Internal server error' });
  }
}

/**
 * Обработчик получения списка регионов
 * 
 * GET /api/regions
 * 
 * Логика:
 * 1. Получает все регионы
 * 2. Сортирует по названию
 * 3. Возвращает список регионов с количеством клиентов
 * 
 * Доступ: все авторизованные пользователи
 * 
 * @param req - Express Request
 * @param res - Express Response
 * @param next - Express NextFunction
 */
export async function listRegionsHandler(
  req: AuthenticatedRequest,
  res: Response,
  _next: NextFunction
): Promise<void> {
  try {
    // Получение всех регионов
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const regions = await prisma.region.findMany({
      include: {
        _count: {
          select: {
            clients: true, // Количество клиентов в регионе
          },
        },
      },
      orderBy: {
        name: 'asc', // Сортировка по названию
      },
    });

    logger.debug('Regions list retrieved', {
      count: regions.length,
      userId: req.user?.id,
    });

    res.status(200).json(regions);
  } catch (error) {
    logger.error('Unexpected error during regions list retrieval', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: req.user?.id,
    });

    res.status(500).json({ message: 'Internal server error' });
  }
}

/**
 * Обработчик получения региона по ID
 * 
 * GET /api/regions/:id
 * 
 * Логика:
 * 1. Находит регион по ID
 * 2. Возвращает данные региона
 * 
 * Доступ: все авторизованные пользователи
 * 
 * @param req - Express Request с параметром :id
 * @param res - Express Response
 * @param next - Express NextFunction
 */
export async function getRegionHandler(
  req: AuthenticatedRequest & { params: { id: string } },
  res: Response,
  _next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;

    // Поиск региона
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const region = await prisma.region.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            clients: true,
          },
        },
      },
    });

    if (!region) {
      logger.warn('Attempt to get non-existent region', { regionId: id });
      res.status(404).json({ message: 'Region not found' });
      return;
    }

    res.status(200).json(region);
  } catch (error) {
    logger.error('Unexpected error during region retrieval', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: req.user?.id,
    });

    res.status(500).json({ message: 'Internal server error' });
  }
}

/**
 * Обработчик обновления региона
 * 
 * PATCH /api/regions/:id
 * 
 * Логика:
 * 1. Находит регион по ID
 * 2. Проверяет уникальность нового названия (если изменяется)
 * 3. Обновляет регион
 * 4. Возвращает обновленный регион
 * 
 * Доступ: только ROOT (проверяется через requireRoot middleware)
 * 
 * @param req - Express Request с валидированным body (UpdateRegionInput) и параметром :id
 * @param res - Express Response
 * @param next - Express NextFunction
 */
export async function updateRegionHandler(
  req: ValidatedRequest<UpdateRegionInput> & AuthenticatedRequest & { params: { id: string } },
  res: Response,
  _next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Поиск региона
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const existingRegion = await prisma.region.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
      },
    });

    if (!existingRegion) {
      logger.warn('Attempt to update non-existent region', { regionId: id });
      res.status(404).json({ message: 'Region not found' });
      return;
    }

    // Проверка уникальности нового названия (если изменяется)
    if (updateData.name !== undefined && updateData.name !== existingRegion.name) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      const nameExists = await prisma.region.findUnique({
        where: { name: updateData.name },
      });

      if (nameExists) {
        logger.warn('Attempt to update region with existing name', {
          regionId: id,
          name: updateData.name,
        });
        res.status(409).json({ message: 'Region with this name already exists' });
        return;
      }
    }

    // Подготовка данных для обновления
    const updatePayload: Record<string, unknown> = {};

    if (updateData.name !== undefined) {
      updatePayload.name = updateData.name;
    }

    // Обновление региона
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const updatedRegion = await prisma.region.update({
      where: { id },
      data: updatePayload,
      include: {
        _count: {
          select: {
            clients: true,
          },
        },
      },
    });

    logger.info('Region updated successfully', {
      regionId: id,
      updatedFields: Object.keys(updateData),
      updatedBy: req.user?.id,
    });

    res.status(200).json(updatedRegion);
  } catch (error: unknown) {
    // Обработка ошибок Prisma
    if (error instanceof PrismaClientKnownRequestError) {
      if (error.code === 'P2025') {
        // Record not found
        logger.warn('Attempt to update non-existent region (Prisma)', {
          regionId: req.params.id,
          userId: req.user?.id,
        });
        res.status(404).json({ message: 'Region not found' });
        return;
      }
      if (error.code === 'P2002') {
        // Unique constraint violation
        logger.warn('Attempt to update region with existing name (Prisma)', {
          regionId: req.params.id,
          userId: req.user?.id,
        });
        res.status(409).json({ message: 'Region with this name already exists' });
        return;
      }
    }

    // Обработка неожиданных ошибок
    logger.error('Unexpected error during region update', {
      error: error instanceof Error ? error.message : 'Unknown error',
      regionId: req.params.id,
      userId: req.user?.id,
    });

    res.status(500).json({ message: 'Internal server error' });
  }
}

/**
 * Обработчик удаления региона
 * 
 * DELETE /api/regions/:id
 * 
 * Логика:
 * 1. Находит регион по ID
 * 2. Удаляет регион
 * 3. Возвращает 204 No Content
 * 
 * Примечание: При удалении региона клиенты остаются, но их regionId становится null
 * (благодаря onDelete: SetNull в схеме Prisma)
 * 
 * Доступ: только ROOT (проверяется через requireRoot middleware)
 * 
 * @param req - Express Request с параметром :id
 * @param res - Express Response
 * @param next - Express NextFunction
 */
export async function deleteRegionHandler(
  req: AuthenticatedRequest & { params: { id: string } },
  res: Response,
  _next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;

    // Поиск региона
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const existingRegion = await prisma.region.findUnique({
      where: { id },
      select: {
        id: true,
      },
    });

    if (!existingRegion) {
      logger.warn('Attempt to delete non-existent region', { regionId: id });
      res.status(404).json({ message: 'Region not found' });
      return;
    }

    // Удаление региона
    // При удалении региона клиенты остаются, но их regionId становится null
    // (благодаря onDelete: SetNull в схеме Prisma)
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    await prisma.region.delete({
      where: { id },
    });

    logger.info('Region deleted successfully', {
      regionId: id,
      deletedBy: req.user?.id,
    });

    res.status(204).send();
  } catch (error: unknown) {
    // Обработка ошибок Prisma
    if (error instanceof PrismaClientKnownRequestError) {
      if (error.code === 'P2025') {
        // Record not found
        logger.warn('Attempt to delete non-existent region (Prisma)', {
          regionId: req.params.id,
          userId: req.user?.id,
        });
        res.status(404).json({ message: 'Region not found' });
        return;
      }
    }

    // Обработка неожиданных ошибок
    logger.error('Unexpected error during region deletion', {
      error: error instanceof Error ? error.message : 'Unknown error',
      regionId: req.params.id,
      userId: req.user?.id,
    });

    res.status(500).json({ message: 'Internal server error' });
  }
}

