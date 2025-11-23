/**
 * Контроллер импорта клиентов
 * 
 * Обрабатывает HTTP запросы для импорта клиентов из Excel файлов.
 * 
 * @module modules/import/import.controller
 */

import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../middleware/auth';
import { ValidatedQueryRequest } from '../../middleware/zodValidate';
import { prisma } from '../../config';
import logger from '../../config/logger';
import { importClients } from './services/import.service';
import type { ImportClientsQuery } from './schemas/import.schemas';

/**
 * Обработчик импорта клиентов
 * 
 * POST /api/import/clients?groupId=...
 * 
 * Логика:
 * 1. Проверяет наличие файла и groupId
 * 2. Валидирует формат файла
 * 3. Проверяет существование группы
 * 4. Выполняет импорт через importService
 * 5. Возвращает результат с статистикой
 * 
 * @param req - Express Request с загруженным файлом и query параметрами
 * @param res - Express Response
 * @param next - Express NextFunction
 */
export async function importClientsHandler(
  req: ValidatedQueryRequest<ImportClientsQuery> & AuthenticatedRequest,
  res: Response,
  _next: NextFunction
): Promise<void> {
  try {
    const currentUser = req.user;
    if (!currentUser) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    // Проверка наличия файла
    const file = req.file;
    if (!file) {
      logger.warn('Import request without file', { userId: currentUser.id });
      res.status(400).json({ message: 'File is required' });
      return;
    }

    // Получение groupId из query
    const { groupId } = req.validatedQuery;

    // Проверка существования группы
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const group = await prisma.clientGroup.findUnique({
      where: { id: groupId },
      select: { id: true, userId: true, name: true },
    });

    if (!group) {
      logger.warn('Import attempt with non-existent group', {
        groupId,
        userId: currentUser.id,
      });
      res.status(404).json({ message: 'Client group not found' });
      return;
    }

    // Проверка прав доступа (если группа принадлежит другому пользователю и текущий не ROOT)
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    if (currentUser.role !== 'ROOT' && group.userId !== currentUser.id) {
      logger.warn('Import attempt to group from another user', {
        groupId,
        groupOwnerId: group.userId,
        userId: currentUser.id,
      });
      res.status(403).json({ message: 'Access denied to this group' });
      return;
    }

    // Получение configId из query (опционально)
    const configId = req.query.configId as string | undefined;

    // Выполнение импорта
    const result = await importClients(
      file,
      groupId,
      currentUser.id,
      currentUser.role,
      prisma,
      configId
    );

    logger.info('Import request completed', {
      groupId,
      importedBy: currentUser.id,
      statistics: result.statistics,
    });

    res.status(200).json({
      success: result.success,
      statistics: result.statistics,
      message: result.success
        ? 'Импорт завершен успешно'
        : `Импорт завершен с ${result.statistics.errors} ошибками`,
      errors: result.errors.length > 0 ? result.errors : undefined,
      groupId: result.groupId,
      groupName: result.groupName,
    });
  } catch (error) {
    logger.error('Unexpected error during import', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: req.user?.id,
    });

    // Определение типа ошибки для соответствующего статуса
    if (error instanceof Error) {
      if (error.message.includes('not found') || error.message.includes('Missing required')) {
        res.status(400).json({ message: error.message });
        return;
      }
    }

    res.status(500).json({ message: 'Internal server error during import' });
  }
}

