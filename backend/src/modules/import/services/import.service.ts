/**
 * Сервис импорта клиентов
 * 
 * Координирует весь процесс импорта: парсинг файла, обработка данных,
 * дедупликация, создание/обновление клиентов.
 * 
 * @module modules/import/services/import.service
 */

import { PrismaClient } from '@prisma/client';
import type { UserRole } from '@prisma/client';
import logger from '../../../config/logger';
import { parseExcelFile } from '../parsers/excel.parser';
import { parseFullName } from '../parsers/name.parser';
import { parsePhones } from '../parsers/phone.parser';
import { findOrCreateRegion, clearRegionCache, type RegionResult } from '../processors/region.processor';
import { findExistingClient, determineStrategy } from '../processors/deduplication.processor';
import { createClient, updateClientName, addPhonesToClient } from '../processors/client.processor';
import type { ImportResult, ImportStatistics, ProcessedRow, DeduplicationStrategy } from '../types';

/**
 * Импортирует клиентов из файла
 * 
 * @param file - Загруженный файл (Express.Multer.File)
 * @param groupId - ID группы, в которую импортируются клиенты
 * @param currentUserId - ID текущего пользователя (кто выполняет импорт)
 * @param userRole - Роль текущего пользователя
 * @param prisma - Prisma клиент
 * @returns Результат импорта
 */
export async function importClients(
  file: Express.Multer.File,
  groupId: string,
  currentUserId: string,
  userRole: UserRole,
  prisma: PrismaClient
): Promise<ImportResult> {
  // Очистка кэша регионов перед началом
  clearRegionCache();

  // 1. ПРОВЕРКА ГРУППЫ (обязательно перед началом)
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
  const group = await prisma.clientGroup.findUnique({
    where: { id: groupId },
    select: {
      id: true,
      userId: true,
      name: true,
      _count: {
        select: {
          clients: true, // Количество клиентов в группе
        },
      },
    },
  });

  if (!group) {
    throw new Error(`Group with id ${groupId} not found`);
  }

  // Владелец клиентов = владелец группы
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
  const clientOwnerId = group.userId;
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
  const groupName = group.name;
  
  // Проверка: пустая ли группа (нет клиентов)
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
  const isGroupEmpty = group._count.clients === 0;

  logger.info('Starting import', {
    groupId,
    groupName,
    importedBy: currentUserId,
    clientOwnerId,
    filename: file.originalname,
    fileSize: file.size,
    isGroupEmpty, // Флаг пустой группы (сухой импорт без дедупликации)
  });

  const statistics: ImportStatistics = {
    total: 0,
    created: 0,
    updated: 0,
    skipped: 0,
    errors: 0,
    regionsCreated: 0,
  };

  const processedRows: ProcessedRow[] = [];
  const regionCache = new Map<string, RegionResult>();

  try {
    // 2. Парсинг файла
    const parsedRows = parseExcelFile(file.buffer, file.originalname);
    statistics.total = parsedRows.length;

    logger.info('File parsed successfully', {
      rowsCount: statistics.total,
      groupId,
    });

    // 3. Обработка каждой строки
    for (const row of parsedRows) {
      try {
        // 3.1 Парсинг ФИО
        const parsedName = parseFullName(row.name);

        // 3.2 Парсинг телефонов
        const parsedPhones = parsePhones(row.phone);

        // Проверка: должен быть хотя бы один валидный телефон
        const validPhones = parsedPhones.filter((p) => p.isValid);
        if (validPhones.length === 0) {
          throw new Error('No valid phone numbers found');
        }

        // 3.3 Обработка региона
        const regionResult: RegionResult = await findOrCreateRegion(
          row.region,
          currentUserId,
          userRole,
          prisma
        );

        // Подсчет созданных регионов (только реально созданные, не найденные)
        if (regionResult.wasCreated && row.region) {
          const normalizedKey = row.region.toLowerCase().trim();
          // Проверяем, не считали ли мы уже этот регион
          const cached = regionCache.get(normalizedKey);
          if (!cached || !cached.wasCreated) {
            // Это новый созданный регион, который еще не был посчитан
            regionCache.set(normalizedKey, regionResult);
            statistics.regionsCreated++;
          }
        } else if (regionResult.id && row.region) {
          // Регион найден (не создан) - сохраняем в кэш для избежания повторных запросов
          const normalizedKey = row.region.toLowerCase().trim();
          if (!regionCache.has(normalizedKey)) {
            regionCache.set(normalizedKey, regionResult);
          }
        }

        // 3.4 Дедупликация (только если группа не пустая)
        // Если группа пустая - пропускаем дедупликацию и создаем всех как новых
        let strategy: DeduplicationStrategy;
        
        if (isGroupEmpty) {
          // Сухой импорт: группа пустая, создаем всех как новых без проверки дубликатов
          strategy = {
            action: 'create',
            reason: 'New client (empty group)',
          };
        } else {
          // Обычный импорт: ищем дубликаты среди клиентов владельца группы
          const existingClientResult = await findExistingClient(
            validPhones,
            clientOwnerId,
            prisma
          );

          strategy = determineStrategy(
            existingClientResult.client,
            parsedName,
            parsedPhones
          );
        }

        // 3.5 Выполнение действия
        let clientId: string | undefined;
        if (strategy.action === 'create') {
          const client = await createClient(
            {
              parsedName,
              regionId: regionResult.id,
              phones: parsedPhones,
              groupId,
              userId: clientOwnerId,
              status: 'NEW',
            },
            prisma
          );
          clientId = client.id;
          statistics.created++;
        } else if (strategy.action === 'update') {
          if (!strategy.existingClientId) {
            throw new Error('No client ID for update');
          }

          // Обновление ФИО если нужно
          if (strategy.reason === 'Add missing name') {
            await updateClientName(strategy.existingClientId, parsedName, prisma);
          }

          // Добавление новых номеров
          if (strategy.reason === 'Add new phones') {
            await addPhonesToClient(strategy.existingClientId, parsedPhones, prisma);
          }

          clientId = strategy.existingClientId;
          statistics.updated++;
        } else {
          statistics.skipped++;
        }

        processedRows.push({
          parsedRow: row,
          parsedName,
          parsedPhones,
          regionId: regionResult.id,
          status:
            strategy.action === 'create'
              ? 'new'
              : strategy.action === 'update'
                ? 'updated'
                : 'skipped',
          clientId,
        });
      } catch (error) {
        statistics.errors++;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';

        // Детальное логирование ошибки
        logger.warn('Error processing import row', {
          rowNumber: row.rowNumber,
          error: errorMessage,
          rowData: { name: row.name, phone: row.phone, region: row.region },
          importedBy: currentUserId,
          groupId,
        });

        processedRows.push({
          parsedRow: row,
          parsedName: { lastName: null, firstName: null, middleName: null },
          parsedPhones: [],
          regionId: null,
          status: 'error',
          error: errorMessage,
        });
      }
    }

    // 4. Логирование итоговой статистики
    logger.info('Import completed', {
      groupId,
      groupName,
      importedBy: currentUserId,
      statistics,
    });

    return {
      success: statistics.errors === 0,
      statistics,
      processedRows,
      errors: processedRows
        .filter((r) => r.status === 'error')
        .map((r) => ({
          rowNumber: r.parsedRow.rowNumber,
          message: r.error || 'Unknown error',
          data: {
            name: r.parsedRow.name,
            phone: r.parsedRow.phone,
            region: r.parsedRow.region,
          },
        })),
      groupId,
      groupName,
    };
  } catch (error) {
    // Критическая ошибка (например, не удалось прочитать файл)
    logger.error('Critical error during import', {
      error: error instanceof Error ? error.message : 'Unknown error',
      groupId,
      importedBy: currentUserId,
    });
    throw error;
  }
}

