/**
 * Контроллер управления телефонами клиентов
 * 
 * Обрабатывает HTTP запросы для управления телефонами клиентов:
 * - POST /api/clients/:id/phones - создание телефона для клиента
 * - GET /api/clients/:id/phones - список телефонов клиента
 * - PATCH /api/clients/:id/phones/:phoneId - обновление телефона
 * - DELETE /api/clients/:id/phones/:phoneId - удаление телефона
 * 
 * Безопасность:
 * - Телефоны - вложенный ресурс клиентов
 * - При создании/обновлении/удалении проверяется принадлежность клиента пользователю
 * 
 * @module modules/clients/client-phones.controller
 */

import { Response, NextFunction } from 'express';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { ValidatedRequest } from '../../middleware/zodValidate';
import { AuthenticatedRequest } from '../../middleware/auth';
import { CreateClientPhoneInput, UpdateClientPhoneInput } from './client-phone.schemas';
import { prisma } from '../../config';
import logger from '../../config/logger';

/**
 * Проверка принадлежности клиента пользователю
 * 
 * @param clientId - ID клиента
 * @param userId - ID пользователя
 * @returns true если клиент принадлежит пользователю, иначе false
 */
async function checkClientOwnership(clientId: string, userId: string): Promise<boolean> {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { userId: true },
  });

  return client?.userId === userId;
}

/**
 * Обработчик создания телефона клиента
 * 
 * POST /api/clients/:id/phones
 * 
 * Логика:
 * 1. Проверяет принадлежность клиента пользователю
 * 2. Создает телефон для клиента
 * 3. Возвращает созданный телефон
 * 
 * @param req - Express Request с валидированным body (CreateClientPhoneInput) и параметром :id
 * @param res - Express Response
 * @param next - Express NextFunction
 */
export async function createClientPhoneHandler(
  req: ValidatedRequest<CreateClientPhoneInput> & AuthenticatedRequest & { params: { id: string } },
  res: Response,
  _next: NextFunction
): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const { id: clientId } = req.params;
    const { phone, whatsAppStatus, telegramStatus } = req.body;

    // Проверка принадлежности клиента пользователю
    const isOwner = await checkClientOwnership(clientId, userId);
    if (!isOwner) {
      logger.warn('Attempt to create phone for client from another user', { clientId, userId });
      res.status(403).json({ message: 'Access denied' });
      return;
    }

    // Создание телефона
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const newPhone = await prisma.clientPhone.create({
      data: {
        clientId,
        phone,
        whatsAppStatus: whatsAppStatus || 'Unknown',
        telegramStatus: telegramStatus || 'Unknown',
      },
    });

    logger.info('Client phone created successfully', {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      phoneId: newPhone.id,
      clientId,
      userId,
    });

    res.status(201).json(newPhone);
  } catch (error: unknown) {
    // Обработка ошибок Prisma
    if (error instanceof PrismaClientKnownRequestError) {
      if (error.code === 'P2003') {
        // Foreign key constraint violation
        logger.warn('Attempt to create phone for non-existent client', {
          clientId: req.params.id,
          userId: req.user?.id,
        });
        res.status(404).json({ message: 'Client not found' });
        return;
      }
    }

    // Обработка неожиданных ошибок
    logger.error('Unexpected error during client phone creation', {
      error: error instanceof Error ? error.message : 'Unknown error',
      clientId: req.params.id,
      userId: req.user?.id,
    });

    res.status(500).json({ message: 'Internal server error' });
  }
}

/**
 * Обработчик получения списка телефонов клиента
 * 
 * GET /api/clients/:id/phones
 * 
 * Логика:
 * 1. Проверяет принадлежность клиента пользователю
 * 2. Получает все телефоны клиента
 * 3. Возвращает список телефонов
 * 
 * @param req - Express Request с параметром :id
 * @param res - Express Response
 * @param next - Express NextFunction
 */
export async function listClientPhonesHandler(
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

    const { id: clientId } = req.params;

    // Проверка принадлежности клиента пользователю
    const isOwner = await checkClientOwnership(clientId, userId);
    if (!isOwner) {
      logger.warn('Attempt to get phones for client from another user', { clientId, userId });
      res.status(403).json({ message: 'Access denied' });
      return;
    }

    // Получение телефонов клиента
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const phones = await prisma.clientPhone.findMany({
      where: { clientId },
      orderBy: {
        id: 'asc', // Сортировка по ID (в модели ClientPhone нет поля createdAt)
      },
    });

    logger.debug('Client phones list retrieved', {
      count: phones.length,
      clientId,
      userId,
    });

    res.status(200).json(phones);
  } catch (error) {
    logger.error('Unexpected error during client phones list retrieval', {
      error: error instanceof Error ? error.message : 'Unknown error',
      clientId: req.params.id,
      userId: req.user?.id,
    });

    res.status(500).json({ message: 'Internal server error' });
  }
}

/**
 * Обработчик обновления телефона клиента
 * 
 * PATCH /api/clients/:id/phones/:phoneId
 * 
 * Логика:
 * 1. Проверяет принадлежность клиента пользователю
 * 2. Проверяет существование телефона и его принадлежность клиенту
 * 3. Обновляет телефон
 * 4. Возвращает обновленный телефон
 * 
 * @param req - Express Request с валидированным body (UpdateClientPhoneInput) и параметрами :id, :phoneId
 * @param res - Express Response
 * @param next - Express NextFunction
 */
export async function updateClientPhoneHandler(
  req: ValidatedRequest<UpdateClientPhoneInput> & AuthenticatedRequest & { params: { id: string; phoneId: string } },
  res: Response,
  _next: NextFunction
): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const { id: clientId, phoneId } = req.params;
    const updateData = req.body;

    // Проверка принадлежности клиента пользователю
    const isOwner = await checkClientOwnership(clientId, userId);
    if (!isOwner) {
      logger.warn('Attempt to update phone for client from another user', { clientId, phoneId, userId });
      res.status(403).json({ message: 'Access denied' });
      return;
    }

    // Поиск телефона
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const existingPhone = await prisma.clientPhone.findUnique({
      where: { id: phoneId },
      select: {
        id: true,
        clientId: true,
      },
    });

    if (!existingPhone) {
      logger.warn('Attempt to update non-existent phone', { phoneId, clientId, userId });
      res.status(404).json({ message: 'Phone not found' });
      return;
    }

    // Проверка принадлежности телефона клиенту
    if (existingPhone.clientId !== clientId) {
      logger.warn('Attempt to update phone from another client', { phoneId, clientId, userId });
      res.status(403).json({ message: 'Phone does not belong to this client' });
      return;
    }

    // Подготовка данных для обновления
    const updatePayload: Record<string, unknown> = {};

    if (updateData.phone !== undefined) {
      updatePayload.phone = updateData.phone;
    }

    if (updateData.whatsAppStatus !== undefined) {
      updatePayload.whatsAppStatus = updateData.whatsAppStatus;
    }

    if (updateData.telegramStatus !== undefined) {
      updatePayload.telegramStatus = updateData.telegramStatus;
    }

    // Обновление телефона
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const updatedPhone = await prisma.clientPhone.update({
      where: { id: phoneId },
      data: updatePayload,
    });

    logger.info('Client phone updated successfully', {
      phoneId,
      clientId,
      updatedFields: Object.keys(updateData),
      userId,
    });

    res.status(200).json(updatedPhone);
  } catch (error: unknown) {
    // Обработка ошибок Prisma
    if (error instanceof PrismaClientKnownRequestError) {
      if (error.code === 'P2025') {
        // Record not found
        logger.warn('Attempt to update non-existent phone (Prisma)', {
          phoneId: req.params.phoneId,
          clientId: req.params.id,
          userId: req.user?.id,
        });
        res.status(404).json({ message: 'Phone not found' });
        return;
      }
    }

    // Обработка неожиданных ошибок
    logger.error('Unexpected error during client phone update', {
      error: error instanceof Error ? error.message : 'Unknown error',
      phoneId: req.params.phoneId,
      clientId: req.params.id,
      userId: req.user?.id,
    });

    res.status(500).json({ message: 'Internal server error' });
  }
}

/**
 * Обработчик удаления телефона клиента
 * 
 * DELETE /api/clients/:id/phones/:phoneId
 * 
 * Логика:
 * 1. Проверяет принадлежность клиента пользователю
 * 2. Проверяет существование телефона и его принадлежность клиенту
 * 3. Удаляет телефон
 * 4. Возвращает 204 No Content
 * 
 * @param req - Express Request с параметрами :id, :phoneId
 * @param res - Express Response
 * @param next - Express NextFunction
 */
export async function deleteClientPhoneHandler(
  req: AuthenticatedRequest & { params: { id: string; phoneId: string } },
  res: Response,
  _next: NextFunction
): Promise<void> {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const { id: clientId, phoneId } = req.params;

    // Проверка принадлежности клиента пользователю
    const isOwner = await checkClientOwnership(clientId, userId);
    if (!isOwner) {
      logger.warn('Attempt to delete phone for client from another user', { clientId, phoneId, userId });
      res.status(403).json({ message: 'Access denied' });
      return;
    }

    // Поиск телефона
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const existingPhone = await prisma.clientPhone.findUnique({
      where: { id: phoneId },
      select: {
        id: true,
        clientId: true,
      },
    });

    if (!existingPhone) {
      logger.warn('Attempt to delete non-existent phone', { phoneId, clientId, userId });
      res.status(404).json({ message: 'Phone not found' });
      return;
    }

    // Проверка принадлежности телефона клиенту
    if (existingPhone.clientId !== clientId) {
      logger.warn('Attempt to delete phone from another client', { phoneId, clientId, userId });
      res.status(403).json({ message: 'Phone does not belong to this client' });
      return;
    }

    // Удаление телефона
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    await prisma.clientPhone.delete({
      where: { id: phoneId },
    });

    logger.info('Client phone deleted successfully', {
      phoneId,
      clientId,
      userId,
    });

    res.status(204).send();
  } catch (error: unknown) {
    // Обработка ошибок Prisma
    if (error instanceof PrismaClientKnownRequestError) {
      if (error.code === 'P2025') {
        // Record not found
        logger.warn('Attempt to delete non-existent phone (Prisma)', {
          phoneId: req.params.phoneId,
          clientId: req.params.id,
          userId: req.user?.id,
        });
        res.status(404).json({ message: 'Phone not found' });
        return;
      }
    }

    // Обработка неожиданных ошибок
    logger.error('Unexpected error during client phone deletion', {
      error: error instanceof Error ? error.message : 'Unknown error',
      phoneId: req.params.phoneId,
      clientId: req.params.id,
      userId: req.user?.id,
    });

    res.status(500).json({ message: 'Internal server error' });
  }
}

