/**
 * Контроллер экспорта групп клиентов
 * 
 * Обрабатывает HTTP запросы для экспорта групп клиентов в Excel/CSV файлы.
 * 
 * @module modules/export/export.controller
 */

import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../middleware/auth';
import { ValidatedQueryRequest } from '../../middleware/zodValidate';
import { prisma } from '../../config';
import logger from '../../config/logger';
import { exportGroup } from './services/export.service';
import type { ExportGroupQuery } from './schemas/export.schemas';

/**
 * Обработчик экспорта группы клиентов
 * 
 * GET /api/export/groups/:groupId?format=xlsx|xls|csv
 * 
 * Логика:
 * 1. Проверяет существование группы
 * 2. Проверяет права доступа (обычные пользователи - только свои группы, ROOT - все группы)
 * 3. Экспортирует группу в указанном формате
 * 4. Возвращает файл для скачивания
 * 
 * @param req - Express Request с параметром :groupId и query параметром format
 * @param res - Express Response
 * @param next - Express NextFunction
 */
export async function exportGroupHandler(
  req: ValidatedQueryRequest<ExportGroupQuery> & AuthenticatedRequest & { params: { groupId: string } },
  res: Response,
  _next: NextFunction
): Promise<void> {
  try {
    const currentUser = req.user;
    if (!currentUser) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const { groupId } = req.params;
    const { format } = req.validatedQuery;

    // Проверка существования группы
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const group = await prisma.clientGroup.findUnique({
      where: { id: groupId },
      select: {
        id: true,
        userId: true,
        name: true,
      },
    });

    if (!group) {
      logger.warn('Export attempt with non-existent group', {
        groupId,
        userId: currentUser.id,
      });
      res.status(404).json({ message: 'Client group not found' });
      return;
    }

    // Проверка прав доступа (если группа принадлежит другому пользователю и текущий не ROOT)
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    if (currentUser.role !== 'ROOT' && group.userId !== currentUser.id) {
      logger.warn('Export attempt to group from another user', {
        groupId,
        groupOwnerId: group.userId,
        userId: currentUser.id,
      });
      res.status(403).json({ message: 'Access denied to this group' });
      return;
    }

    // Выполнение экспорта
    const { buffer, filename } = await exportGroup(groupId, format, prisma);

    // Установка заголовков для скачивания файла
    const contentType = format === 'csv' 
      ? 'text/csv' 
      : format === 'xlsx' 
      ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      : 'application/vnd.ms-excel';

    // Используем RFC 5987 для корректной передачи имени файла с кириллицей
    const encodedFilename = encodeURIComponent(filename);
    const rfc5987Filename = `filename*=UTF-8''${encodedFilename}`;

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; ${rfc5987Filename}; filename="${filename}"`);
    res.setHeader('X-Filename', filename); // Дополнительный заголовок для надежности
    res.setHeader('Content-Length', buffer.length.toString());

    logger.info('Export request completed', {
      groupId,
      exportedBy: currentUser.id,
      format,
      filename,
    });

    // Отправка файла
    res.status(200).send(buffer);
  } catch (error) {
    logger.error('Unexpected error during export', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: req.user?.id,
      groupId: req.params.groupId,
    });

    // Определение типа ошибки для соответствующего статуса
    if (error instanceof Error) {
      if (error.message.includes('not found')) {
        res.status(404).json({ message: error.message });
        return;
      }
      if (error.message.includes('Unsupported export format')) {
        res.status(400).json({ message: error.message });
        return;
      }
    }

    res.status(500).json({ message: 'Internal server error during export' });
  }
}

