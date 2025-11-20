/**
 * Контроллер управления клиентами
 * 
 * Обрабатывает HTTP запросы для управления клиентами:
 * - POST /api/clients - создание клиента
 * - GET /api/clients - список клиентов (с пагинацией, поиском, фильтрацией, сортировкой)
 * - GET /api/clients/:id - получение клиента по ID
 * - PATCH /api/clients/:id - обновление клиента
 * - DELETE /api/clients/:id - удаление клиента
 * 
 * Безопасность:
 * - Каждый пользователь видит и управляет только своими клиентами
 * - Проверка прав доступа при обновлении/удалении (только свои клиенты)
 * 
 * @module modules/clients/clients.controller
 */

import { Response, NextFunction } from 'express';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { ValidatedRequest, ValidatedQueryRequest } from '../../middleware/zodValidate';
import { AuthenticatedRequest } from '../../middleware/auth';
import { CreateClientInput, UpdateClientInput, ListClientsQuery } from './client.schemas';
import { prisma } from '../../config';
import logger from '../../config/logger';

/**
 * Обработчик создания клиента
 * 
 * POST /api/clients
 * 
 * Логика:
 * 1. Создает клиента с userId из req.user
 * 2. Проверяет существование regionId и groupId (если указаны)
 * 3. Проверяет, что groupId принадлежит текущему пользователю
 * 4. Возвращает созданного клиента
 * 
 * @param req - Express Request с валидированным body (CreateClientInput)
 * @param res - Express Response
 * @param next - Express NextFunction
 */
export async function createClientHandler(
  req: ValidatedRequest<CreateClientInput> & AuthenticatedRequest,
  res: Response,
  _next: NextFunction
): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const { lastName, firstName, middleName, regionId, groupId, status } = req.body;

    // Проверка существования региона (если указан)
    if (regionId) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      const region = await prisma.region.findUnique({
        where: { id: regionId },
      });

      if (!region) {
        logger.warn('Attempt to create client with non-existent region', { regionId, userId });
        res.status(404).json({ message: 'Region not found' });
        return;
      }
    }

    // Проверка существования группы и принадлежности пользователю (если указана)
    if (groupId) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      const group = await prisma.clientGroup.findUnique({
        where: { id: groupId },
      });

      if (!group) {
        logger.warn('Attempt to create client with non-existent group', { groupId, userId });
        res.status(404).json({ message: 'Client group not found' });
        return;
      }

      // Проверка принадлежности группы пользователю
      if (group.userId !== userId) {
        logger.warn('Attempt to create client with group from another user', { groupId, userId });
        res.status(403).json({ message: 'Client group does not belong to you' });
        return;
      }
    }

    // Создание клиента
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const newClient = await prisma.client.create({
      data: {
        userId,
        lastName,
        firstName,
        middleName: middleName ?? null,
        regionId: regionId ?? null,
        groupId: groupId ?? null,
        status: status ?? 'NEW',
      },
      include: {
        region: {
          select: {
            id: true,
            name: true,
          },
        },
        group: {
          select: {
            id: true,
            name: true,
          },
        },
        phones: {
          select: {
            id: true,
            phone: true,
          },
        },
      },
    });

    logger.info('Client created successfully', {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      clientId: newClient.id,
      userId,
    });

    res.status(201).json(newClient);
  } catch (error: unknown) {
    // Обработка ошибок Prisma
    if (error instanceof PrismaClientKnownRequestError) {
      if (error.code === 'P2003') {
        // Foreign key constraint violation
        logger.warn('Attempt to create client with invalid foreign key', {
          userId: req.user?.id,
        });
        res.status(400).json({ message: 'Invalid region or group ID' });
        return;
      }
    }

    // Обработка неожиданных ошибок
    logger.error('Unexpected error during client creation', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: req.user?.id,
    });

    res.status(500).json({ message: 'Internal server error' });
  }
}

/**
 * Обработчик получения списка клиентов
 * 
 * GET /api/clients
 * 
 * Логика:
 * 1. Получает клиентов текущего пользователя
 * 2. Применяет пагинацию, поиск, фильтрацию, сортировку
 * 3. Возвращает список клиентов с метаданными пагинации
 * 
 * @param req - Express Request с валидированными query параметрами (ListClientsQuery)
 * @param res - Express Response
 * @param next - Express NextFunction
 */
export async function listClientsHandler(
  req: ValidatedQueryRequest<ListClientsQuery> & AuthenticatedRequest,
  res: Response,
  _next: NextFunction
): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const { page, limit, search, regionId, groupId, status, sortBy, sortOrder } = req.validatedQuery;

    // Построение условий фильтрации
    const where: Record<string, unknown> = {
      userId, // Только клиенты текущего пользователя
    };

    // Фильтр по региону
    if (regionId) {
      where.regionId = regionId;
    }

    // Фильтр по группе
    if (groupId) {
      where.groupId = groupId;
    }

    // Фильтр по статусу
    if (status) {
      where.status = status;
    }

    // Поиск по ФИО
    // Примечание: SQLite не поддерживает case-insensitive поиск через Prisma
    // Для case-insensitive поиска можно использовать raw SQL или нормализовать данные
    if (search) {
      where.OR = [
        { lastName: { contains: search } },
        { firstName: { contains: search } },
        { middleName: { contains: search } },
      ];
    }

    // Построение сортировки
    const orderBy: Record<string, string> = {};
    orderBy[sortBy] = sortOrder;

    // Подсчет общего количества (для пагинации)
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const total = await prisma.client.count({ where });

    // Получение клиентов с пагинацией
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const clients = await prisma.client.findMany({
      where,
      include: {
        region: {
          select: {
            id: true,
            name: true,
          },
        },
        group: {
          select: {
            id: true,
            name: true,
          },
        },
        phones: {
          select: {
            id: true,
            phone: true,
          },
        },
      },
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
    });

    // Метаданные пагинации
    const totalPages = Math.ceil(total / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    logger.debug('Clients list retrieved', {
      count: clients.length,
      total,
      page,
      limit,
      userId,
    });

    res.status(200).json({
      data: clients,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage,
        hasPrevPage,
      },
    });
  } catch (error) {
    logger.error('Unexpected error during clients list retrieval', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: req.user?.id,
    });

    res.status(500).json({ message: 'Internal server error' });
  }
}

/**
 * Обработчик получения клиента по ID
 * 
 * GET /api/clients/:id
 * 
 * Логика:
 * 1. Находит клиента по ID
 * 2. Проверяет, что клиент принадлежит текущему пользователю
 * 3. Возвращает данные клиента
 * 
 * @param req - Express Request с параметром :id
 * @param res - Express Response
 * @param next - Express NextFunction
 */
export async function getClientHandler(
  req: AuthenticatedRequest & { params: { id: string } },
  res: Response,
  _next: NextFunction
): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const { id } = req.params;

    // Поиск клиента
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const client = await prisma.client.findUnique({
      where: { id },
      include: {
        region: {
          select: {
            id: true,
            name: true,
          },
        },
        group: {
          select: {
            id: true,
            name: true,
          },
        },
        phones: {
          select: {
            id: true,
            phone: true,
          },
        },
      },
    });

    if (!client) {
      logger.warn('Attempt to get non-existent client', { clientId: id, userId });
      res.status(404).json({ message: 'Client not found' });
      return;
    }

    // Проверка принадлежности клиента пользователю
    if (client.userId !== userId) {
      logger.warn('Attempt to get client from another user', { clientId: id, userId });
      res.status(403).json({ message: 'Access denied' });
      return;
    }

    res.status(200).json(client);
  } catch (error) {
    logger.error('Unexpected error during client retrieval', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: req.user?.id,
    });

    res.status(500).json({ message: 'Internal server error' });
  }
}

/**
 * Обработчик обновления клиента
 * 
 * PATCH /api/clients/:id
 * 
 * Логика:
 * 1. Находит клиента по ID
 * 2. Проверяет, что клиент принадлежит текущему пользователю
 * 3. Проверяет существование regionId и groupId (если указаны)
 * 4. Проверяет, что groupId принадлежит текущему пользователю
 * 5. Обновляет клиента
 * 6. Возвращает обновленного клиента
 * 
 * @param req - Express Request с валидированным body (UpdateClientInput) и параметром :id
 * @param res - Express Response
 * @param next - Express NextFunction
 */
export async function updateClientHandler(
  req: ValidatedRequest<UpdateClientInput> & AuthenticatedRequest & { params: { id: string } },
  res: Response,
  _next: NextFunction
): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const { id } = req.params;
    const updateData = req.body;

    // Поиск клиента
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const existingClient = await prisma.client.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
      },
    });

    if (!existingClient) {
      logger.warn('Attempt to update non-existent client', { clientId: id, userId });
      res.status(404).json({ message: 'Client not found' });
      return;
    }

    // Проверка принадлежности клиента пользователю
    if (existingClient.userId !== userId) {
      logger.warn('Attempt to update client from another user', { clientId: id, userId });
      res.status(403).json({ message: 'Access denied' });
      return;
    }

    // Проверка существования региона (если указан)
    if (updateData.regionId !== undefined && updateData.regionId !== null) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      const region = await prisma.region.findUnique({
        where: { id: updateData.regionId },
      });

      if (!region) {
        logger.warn('Attempt to update client with non-existent region', {
          regionId: updateData.regionId,
          clientId: id,
          userId,
        });
        res.status(404).json({ message: 'Region not found' });
        return;
      }
    }

    // Проверка существования группы и принадлежности пользователю (если указана)
    if (updateData.groupId !== undefined && updateData.groupId !== null) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      const group = await prisma.clientGroup.findUnique({
        where: { id: updateData.groupId },
      });

      if (!group) {
        logger.warn('Attempt to update client with non-existent group', {
          groupId: updateData.groupId,
          clientId: id,
          userId,
        });
        res.status(404).json({ message: 'Client group not found' });
        return;
      }

      // Проверка принадлежности группы пользователю
      if (group.userId !== userId) {
        logger.warn('Attempt to update client with group from another user', {
          groupId: updateData.groupId,
          clientId: id,
          userId,
        });
        res.status(403).json({ message: 'Client group does not belong to you' });
        return;
      }
    }

    // Подготовка данных для обновления
    const updatePayload: Record<string, unknown> = {};

    if (updateData.lastName !== undefined) {
      updatePayload.lastName = updateData.lastName;
    }
    if (updateData.firstName !== undefined) {
      updatePayload.firstName = updateData.firstName;
    }
    if (updateData.middleName !== undefined) {
      updatePayload.middleName = updateData.middleName ?? null;
    }
    if (updateData.regionId !== undefined) {
      updatePayload.regionId = updateData.regionId ?? null;
    }
    if (updateData.groupId !== undefined) {
      updatePayload.groupId = updateData.groupId ?? null;
    }
    if (updateData.status !== undefined) {
      updatePayload.status = updateData.status;
    }

    // Обновление клиента
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const updatedClient = await prisma.client.update({
      where: { id },
      data: updatePayload,
      include: {
        region: {
          select: {
            id: true,
            name: true,
          },
        },
        group: {
          select: {
            id: true,
            name: true,
          },
        },
        phones: {
          select: {
            id: true,
            phone: true,
          },
        },
      },
    });

    logger.info('Client updated successfully', {
      clientId: id,
      updatedFields: Object.keys(updateData),
      userId,
    });

    res.status(200).json(updatedClient);
  } catch (error: unknown) {
    // Обработка ошибок Prisma
    if (error instanceof PrismaClientKnownRequestError) {
      if (error.code === 'P2025') {
        // Record not found
        logger.warn('Attempt to update non-existent client (Prisma)', {
          clientId: req.params.id,
          userId: req.user?.id,
        });
        res.status(404).json({ message: 'Client not found' });
        return;
      }
      if (error.code === 'P2003') {
        // Foreign key constraint violation
        logger.warn('Attempt to update client with invalid foreign key', {
          clientId: req.params.id,
          userId: req.user?.id,
        });
        res.status(400).json({ message: 'Invalid region or group ID' });
        return;
      }
    }

    // Обработка неожиданных ошибок
    logger.error('Unexpected error during client update', {
      error: error instanceof Error ? error.message : 'Unknown error',
      clientId: req.params.id,
      userId: req.user?.id,
    });

    res.status(500).json({ message: 'Internal server error' });
  }
}

/**
 * Обработчик удаления клиента
 * 
 * DELETE /api/clients/:id
 * 
 * Логика:
 * 1. Находит клиента по ID
 * 2. Проверяет, что клиент принадлежит текущему пользователю
 * 3. Удаляет клиента (каскадное удаление телефонов)
 * 4. Возвращает 204 No Content
 * 
 * @param req - Express Request с параметром :id
 * @param res - Express Response
 * @param next - Express NextFunction
 */
export async function deleteClientHandler(
  req: AuthenticatedRequest & { params: { id: string } },
  res: Response,
  _next: NextFunction
): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const { id } = req.params;

    // Поиск клиента
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const existingClient = await prisma.client.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
      },
    });

    if (!existingClient) {
      logger.warn('Attempt to delete non-existent client', { clientId: id, userId });
      res.status(404).json({ message: 'Client not found' });
      return;
    }

    // Проверка принадлежности клиента пользователю
    if (existingClient.userId !== userId) {
      logger.warn('Attempt to delete client from another user', { clientId: id, userId });
      res.status(403).json({ message: 'Access denied' });
      return;
    }

    // Удаление клиента (каскадное удаление телефонов)
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    await prisma.client.delete({
      where: { id },
    });

    logger.info('Client deleted successfully', {
      clientId: id,
      userId,
    });

    res.status(204).send();
  } catch (error: unknown) {
    // Обработка ошибок Prisma
    if (error instanceof PrismaClientKnownRequestError) {
      if (error.code === 'P2025') {
        // Record not found
        logger.warn('Attempt to delete non-existent client (Prisma)', {
          clientId: req.params.id,
          userId: req.user?.id,
        });
        res.status(404).json({ message: 'Client not found' });
        return;
      }
    }

    // Обработка неожиданных ошибок
    logger.error('Unexpected error during client deletion', {
      error: error instanceof Error ? error.message : 'Unknown error',
      clientId: req.params.id,
      userId: req.user?.id,
    });

    res.status(500).json({ message: 'Internal server error' });
  }
}

