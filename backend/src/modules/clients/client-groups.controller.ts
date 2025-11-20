/**
 * Контроллер управления группами клиентов
 * 
 * Обрабатывает HTTP запросы для управления группами клиентов:
 * - POST /api/client-groups - создание группы
 * - GET /api/client-groups - список групп текущего пользователя
 * - GET /api/client-groups/:id - получение группы по ID
 * - PATCH /api/client-groups/:id - обновление группы
 * - DELETE /api/client-groups/:id - удаление группы
 * 
 * Безопасность:
 * - Каждый пользователь видит и управляет только своими группами
 * - Проверка прав доступа при обновлении/удалении (только свои группы)
 * - Уникальность названия группы для пользователя (userId + name)
 * 
 * @module modules/clients/client-groups.controller
 */

import { Response, NextFunction } from 'express';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { ValidatedRequest } from '../../middleware/zodValidate';
import { AuthenticatedRequest } from '../../middleware/auth';
import { CreateClientGroupInput, UpdateClientGroupInput } from './client-group.schemas';
import { prisma } from '../../config';
import logger from '../../config/logger';

/**
 * Обработчик создания группы клиентов
 * 
 * POST /api/client-groups
 * 
 * Логика:
 * 1. Создает группу с userId из req.user
 * 2. Проверяет уникальность названия для пользователя (userId + name)
 * 3. Возвращает созданную группу
 * 
 * @param req - Express Request с валидированным body (CreateClientGroupInput)
 * @param res - Express Response
 * @param next - Express NextFunction
 */
export async function createClientGroupHandler(
  req: ValidatedRequest<CreateClientGroupInput> & AuthenticatedRequest,
  res: Response,
  _next: NextFunction
): Promise<void> {
  try {
    const currentUser = req.user;
    if (!currentUser) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const { name, description, color, orderIndex, userId: targetUserId } = req.body;

    // Определение userId для создания группы:
    // - Если ROOT и передан userId в body - используем его (создание группы от имени другого пользователя)
    // - Иначе используем ID текущего пользователя (создание своей группы)
    let groupOwnerId: string;
    if (currentUser.role === 'ROOT' && targetUserId) {
      // ROOT может создавать группы от имени любого пользователя
      groupOwnerId = targetUserId;
    } else {
      // Обычный пользователь создает только свои группы
      groupOwnerId = currentUser.id;
    }

    // Проверка уникальности названия для пользователя
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const existingGroup = await prisma.clientGroup.findFirst({
      where: {
        userId: groupOwnerId,
        name,
      },
    });

    if (existingGroup) {
      logger.warn('Attempt to create group with existing name', { name, userId: currentUser.id, groupOwnerId });
      res.status(409).json({ message: 'Group with this name already exists' });
      return;
    }

    // Создание группы
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const newGroup = await prisma.clientGroup.create({
      data: {
        userId: groupOwnerId,
        name,
        description: description ?? null,
        color: color ?? null,
        orderIndex: orderIndex ?? null,
      },
      include: {
        _count: {
          select: {
            clients: true, // Количество клиентов в группе
          },
        },
      },
    });

    logger.info('Client group created successfully', {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      groupId: newGroup.id,
      requestedBy: currentUser.id,
      groupOwnerId,
    });

    res.status(201).json(newGroup);
  } catch (error: unknown) {
    // Обработка ошибок Prisma
    if (error instanceof PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        // Unique constraint violation (если есть уникальный индекс на userId + name)
        logger.warn('Attempt to create group with existing name (Prisma)', {
          userId: req.user?.id,
        });
        res.status(409).json({ message: 'Group with this name already exists' });
        return;
      }
    }

    // Обработка неожиданных ошибок
    logger.error('Unexpected error during client group creation', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: req.user?.id,
    });

    res.status(500).json({ message: 'Internal server error' });
  }
}

/**
 * Обработчик получения списка групп клиентов
 * 
 * GET /api/client-groups
 * 
 * Логика:
 * 1. Получает группы текущего пользователя
 * 2. Сортирует по orderIndex (если есть) или createdAt
 * 3. Возвращает список групп с количеством клиентов
 * 
 * @param req - Express Request
 * @param res - Express Response
 * @param next - Express NextFunction
 */
export async function listClientGroupsHandler(
  req: AuthenticatedRequest & { query: { userId?: string } },
  res: Response,
  _next: NextFunction
): Promise<void> {
  try {
    const currentUser = req.user;
    if (!currentUser) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    // Определение userId для фильтрации:
    // - Если ROOT и передан userId в query - используем его (просмотр групп другого пользователя)
    // - Иначе используем ID текущего пользователя (только свои группы)
    let targetUserId: string;
    if (currentUser.role === 'ROOT' && req.query.userId) {
      // ROOT может просматривать группы любого пользователя
      targetUserId = req.query.userId;
    } else {
      // Обычный пользователь видит только свои группы
      targetUserId = currentUser.id;
    }

    // Получение групп пользователя
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const groups = await prisma.clientGroup.findMany({
      where: {
        userId: targetUserId,
      },
      include: {
        _count: {
          select: {
            clients: true, // Количество клиентов в группе
          },
        },
      },
      orderBy: [
        { orderIndex: 'asc' }, // Сначала по orderIndex
        { createdAt: 'desc' }, // Затем по дате создания
      ],
    });

    logger.debug('Client groups list retrieved', {
      count: groups.length,
      requestedBy: currentUser.id,
      targetUserId,
    });

    res.status(200).json(groups);
  } catch (error) {
    logger.error('Unexpected error during client groups list retrieval', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: req.user?.id,
    });

    res.status(500).json({ message: 'Internal server error' });
  }
}

/**
 * Обработчик получения группы клиентов по ID
 * 
 * GET /api/client-groups/:id
 * 
 * Логика:
 * 1. Находит группу по ID
 * 2. Проверяет, что группа принадлежит текущему пользователю
 * 3. Возвращает данные группы
 * 
 * @param req - Express Request с параметром :id
 * @param res - Express Response
 * @param next - Express NextFunction
 */
export async function getClientGroupHandler(
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

    // Поиск группы
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const group = await prisma.clientGroup.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            clients: true,
          },
        },
      },
    });

    if (!group) {
      logger.warn('Attempt to get non-existent group', { groupId: id, userId: currentUser.id });
      res.status(404).json({ message: 'Client group not found' });
      return;
    }

    // Проверка принадлежности группы пользователю (ROOT может получить группу любого пользователя)
    if (currentUser.role !== 'ROOT' && group.userId !== currentUser.id) {
      logger.warn('Attempt to get group from another user', { groupId: id, userId: currentUser.id });
      res.status(403).json({ message: 'Access denied' });
      return;
    }

    res.status(200).json(group);
  } catch (error) {
    logger.error('Unexpected error during client group retrieval', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: req.user?.id,
    });

    res.status(500).json({ message: 'Internal server error' });
  }
}

/**
 * Обработчик обновления группы клиентов
 * 
 * PATCH /api/client-groups/:id
 * 
 * Логика:
 * 1. Находит группу по ID
 * 2. Проверяет, что группа принадлежит текущему пользователю
 * 3. Проверяет уникальность нового названия (если изменяется)
 * 4. Обновляет группу
 * 5. Возвращает обновленную группу
 * 
 * @param req - Express Request с валидированным body (UpdateClientGroupInput) и параметром :id
 * @param res - Express Response
 * @param next - Express NextFunction
 */
export async function updateClientGroupHandler(
  req: ValidatedRequest<UpdateClientGroupInput> & AuthenticatedRequest & { params: { id: string } },
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
    const updateData = req.body;

    // Поиск группы
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const existingGroup = await prisma.clientGroup.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        name: true,
      },
    });

    if (!existingGroup) {
      logger.warn('Attempt to update non-existent group', { groupId: id, userId: currentUser.id });
      res.status(404).json({ message: 'Client group not found' });
      return;
    }

    // Проверка принадлежности группы пользователю (ROOT может обновлять группы любого пользователя)
    if (currentUser.role !== 'ROOT' && existingGroup.userId !== currentUser.id) {
      logger.warn('Attempt to update group from another user', { groupId: id, userId: currentUser.id });
      res.status(403).json({ message: 'Access denied' });
      return;
    }

    // Проверка уникальности нового названия (если изменяется)
    // Проверяем уникальность для владельца группы (не для текущего пользователя)
    if (updateData.name !== undefined && updateData.name !== existingGroup.name) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      const nameExists = await prisma.clientGroup.findFirst({
        where: {
          userId: existingGroup.userId, // Проверяем уникальность для владельца группы
          name: updateData.name,
        },
      });

      if (nameExists) {
        logger.warn('Attempt to update group with existing name', {
          groupId: id,
          name: updateData.name,
          userId: currentUser.id,
          groupOwnerId: existingGroup.userId,
        });
        res.status(409).json({ message: 'Group with this name already exists' });
        return;
      }
    }

    // Подготовка данных для обновления
    const updatePayload: Record<string, unknown> = {};

    if (updateData.name !== undefined) {
      updatePayload.name = updateData.name;
    }
    if (updateData.description !== undefined) {
      updatePayload.description = updateData.description ?? null;
    }
    if (updateData.color !== undefined) {
      updatePayload.color = updateData.color ?? null;
    }
    if (updateData.orderIndex !== undefined) {
      updatePayload.orderIndex = updateData.orderIndex ?? null;
    }

    // Обновление группы
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const updatedGroup = await prisma.clientGroup.update({
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

    logger.info('Client group updated successfully', {
      groupId: id,
      updatedFields: Object.keys(updateData),
      requestedBy: currentUser.id,
      groupOwnerId: existingGroup.userId,
    });

    res.status(200).json(updatedGroup);
  } catch (error: unknown) {
    // Обработка ошибок Prisma
    if (error instanceof PrismaClientKnownRequestError) {
      if (error.code === 'P2025') {
        // Record not found
        logger.warn('Attempt to update non-existent group (Prisma)', {
          groupId: req.params.id,
          userId: req.user?.id,
        });
        res.status(404).json({ message: 'Client group not found' });
        return;
      }
      if (error.code === 'P2002') {
        // Unique constraint violation
        logger.warn('Attempt to update group with existing name (Prisma)', {
          groupId: req.params.id,
          userId: req.user?.id,
        });
        res.status(409).json({ message: 'Group with this name already exists' });
        return;
      }
    }

    // Обработка неожиданных ошибок
    logger.error('Unexpected error during client group update', {
      error: error instanceof Error ? error.message : 'Unknown error',
      groupId: req.params.id,
      userId: req.user?.id,
    });

    res.status(500).json({ message: 'Internal server error' });
  }
}

/**
 * Обработчик удаления группы клиентов
 * 
 * DELETE /api/client-groups/:id
 * 
 * Логика:
 * 1. Находит группу по ID
 * 2. Проверяет, что группа принадлежит текущему пользователю
 * 3. Проверяет, что в группе нет клиентов (или разрешаем удаление с каскадом)
 * 4. Удаляет группу
 * 5. Возвращает 204 No Content
 * 
 * Примечание: При удалении группы клиенты остаются, но их groupId становится null
 * (благодаря onDelete: SetNull в схеме Prisma)
 * 
 * @param req - Express Request с параметром :id
 * @param res - Express Response
 * @param next - Express NextFunction
 */
export async function deleteClientGroupHandler(
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

    // Поиск группы
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const existingGroup = await prisma.clientGroup.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
      },
    });

    if (!existingGroup) {
      logger.warn('Attempt to delete non-existent group', { groupId: id, userId: currentUser.id });
      res.status(404).json({ message: 'Client group not found' });
      return;
    }

    // Проверка принадлежности группы пользователю (ROOT может удалять группы любого пользователя)
    if (currentUser.role !== 'ROOT' && existingGroup.userId !== currentUser.id) {
      logger.warn('Attempt to delete group from another user', { groupId: id, userId: currentUser.id });
      res.status(403).json({ message: 'Access denied' });
      return;
    }

    // Удаление группы
    // При удалении группы клиенты удаляются каскадно (благодаря onDelete: Cascade в схеме Prisma)
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    await prisma.clientGroup.delete({
      where: { id },
    });

    logger.info('Client group deleted successfully', {
      groupId: id,
      requestedBy: currentUser.id,
      groupOwnerId: existingGroup.userId,
    });

    res.status(204).send();
  } catch (error: unknown) {
    // Обработка ошибок Prisma
    if (error instanceof PrismaClientKnownRequestError) {
      if (error.code === 'P2025') {
        // Record not found
        logger.warn('Attempt to delete non-existent group (Prisma)', {
          groupId: req.params.id,
          userId: req.user?.id,
        });
        res.status(404).json({ message: 'Client group not found' });
        return;
      }
    }

    // Обработка неожиданных ошибок
    logger.error('Unexpected error during client group deletion', {
      error: error instanceof Error ? error.message : 'Unknown error',
      groupId: req.params.id,
      userId: req.user?.id,
    });

    res.status(500).json({ message: 'Internal server error' });
  }
}

