/**
 * Процессор дедупликации
 * 
 * Находит существующих клиентов по номерам телефонов и определяет стратегию обновления.
 * 
 * @module modules/import/processors/deduplication.processor
 */

import { PrismaClient } from '@prisma/client';
import type { DeduplicationStrategy, ParsedName, ParsedPhone, SearchScope, MatchCriteria } from '../types';

/**
 * Результат поиска существующего клиента
 */
interface FindClientResult {
  client: {
    id: string;
    lastName: string | null;
    firstName: string | null;
    middleName: string | null;
    phones: Array<{ phone: string }>;
  } | null;
  matchType: 'phone' | 'name_and_phone' | null;
}

/**
 * Параметры поиска существующего клиента
 */
export interface FindClientParams {
  phones: ParsedPhone[];
  parsedName: ParsedName;
  scopes: SearchScope[];
  matchCriteria: MatchCriteria;
  currentGroupId?: string;
  ownerUserId: string;
  currentUserId: string;
  userRole: string;
  prisma: PrismaClient;
}

/**
 * Находит существующего клиента согласно конфигурации поиска
 * 
 * @param params - Параметры поиска
 * @returns Результат поиска с клиентом и типом совпадения
 */
export async function findExistingClient(
  params: FindClientParams
): Promise<FindClientResult> {
  const { phones, parsedName, scopes, matchCriteria, currentGroupId, ownerUserId, currentUserId, userRole, prisma } = params;

  // Если поиск отключен
  if (scopes.includes('none') || scopes.length === 0) {
    return { client: null, matchType: null };
  }

  // Извлекаем только валидные нормализованные номера
  const validPhones = phones.filter((p) => p.isValid).map((p) => p.normalized);

  if (validPhones.length === 0) {
    return { client: null, matchType: null };
  }

  try {
    // Формируем условия поиска в зависимости от области поиска
    const whereConditions: Array<Record<string, unknown>> = [];

    // Поиск в текущей группе
    if (scopes.includes('current_group') && currentGroupId) {
      whereConditions.push({
        groupId: currentGroupId,
        phones: {
          some: {
            phone: { in: validPhones },
          },
        },
      });
    }

    // Поиск во всех группах владельца
    if (scopes.includes('owner_groups')) {
      whereConditions.push({
        userId: ownerUserId,
        phones: {
          some: {
            phone: { in: validPhones },
          },
        },
      });
    }

    // Поиск по всем пользователям (только для ROOT)
    if (scopes.includes('all_users') && userRole === 'ROOT') {
      whereConditions.push({
        phones: {
          some: {
            phone: { in: validPhones },
          },
        },
      });
    }

    if (whereConditions.length === 0) {
      return { client: null, matchType: null };
    }

    // Объединяем условия через OR
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const clients = await prisma.client.findMany({
      where: {
        OR: whereConditions,
      },
      include: {
        phones: {
          select: {
            phone: true,
          },
        },
      },
      take: 1, // Берем первого найденного
    });

    if (clients.length === 0) {
      return { client: null, matchType: null };
    }

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const client = clients[0];

    // Определяем тип совпадения в зависимости от критериев
    let matchType: 'phone' | 'name_and_phone' | null = 'phone';
    
    if (matchCriteria === 'phone_and_name' || matchCriteria === 'name') {
      // Проверяем совпадение по ФИО
      const nameMatches = 
        (parsedName.lastName && client.lastName && 
         parsedName.lastName.toLowerCase() === client.lastName.toLowerCase()) ||
        (parsedName.firstName && client.firstName && 
         parsedName.firstName.toLowerCase() === client.firstName.toLowerCase());
      
      if (nameMatches) {
        matchType = 'name_and_phone';
      } else if (matchCriteria === 'name') {
        // Если критерий только по имени, но имена не совпадают - не считаем совпадением
        return { client: null, matchType: null };
      }
    }

    return {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      client: {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        id: client.id,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        lastName: client.lastName,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        firstName: client.firstName,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        middleName: client.middleName,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        phones: client.phones,
      },
      matchType,
    };
  } catch (error) {
    // Ошибка при поиске - считаем что клиент не найден
    return { client: null, matchType: null };
  }
}

/**
 * Параметры для определения стратегии
 */
export interface DetermineStrategyParams {
  existingClient: FindClientResult['client'];
  parsedName: ParsedName;
  parsedPhones: ParsedPhone[];
  duplicateAction: {
    defaultAction: 'skip' | 'update' | 'create';
    updateName: boolean;
    updateRegion: boolean;
    addPhones: boolean;
    addToGroup: boolean;
    moveToGroup: boolean;
  };
  noDuplicateAction: 'create' | 'skip';
}

/**
 * Определяет стратегию обработки клиента согласно конфигурации
 * 
 * @param params - Параметры для определения стратегии
 * @returns Стратегия обработки
 */
export function determineStrategy(
  params: DetermineStrategyParams
): DeduplicationStrategy {
  const { existingClient, parsedName, parsedPhones, duplicateAction, noDuplicateAction } = params;

  // Если клиент не найден
  if (!existingClient) {
    return {
      action: noDuplicateAction === 'create' ? 'create' : 'skip',
      reason: noDuplicateAction === 'create' ? 'New client' : 'Skipped (no duplicate action)',
    };
  }

  // Если действие по умолчанию - создать, игнорируем дубликат
  if (duplicateAction.defaultAction === 'create') {
    return {
      action: 'create',
      reason: 'Create new (ignore duplicate)',
    };
  }

  // Если действие по умолчанию - пропустить, проверяем нужно ли обновление
  if (duplicateAction.defaultAction === 'skip') {
    // Проверяем, есть ли что обновить
    const hasExistingName = Boolean(existingClient.firstName) || Boolean(existingClient.lastName);
    const hasNewName = Boolean(parsedName.firstName) || Boolean(parsedName.lastName);
    const existingPhones = existingClient.phones.map((p) => p.phone);
    const newPhones = parsedPhones
      .filter((p) => p.isValid)
      .map((p) => p.normalized)
      .filter((p) => !existingPhones.includes(p));

    // Если есть что обновить и это разрешено - обновляем
    if (duplicateAction.updateName && !hasExistingName && hasNewName) {
      return {
        action: 'update',
        reason: 'Add missing name',
        existingClientId: existingClient.id,
      };
    }

    if (duplicateAction.addPhones && newPhones.length > 0) {
      return {
        action: 'update',
        reason: 'Add new phones',
        existingClientId: existingClient.id,
      };
    }

    // Иначе пропускаем
    return {
      action: 'skip',
      reason: 'Duplicate',
      existingClientId: existingClient.id,
    };
  }

  // Действие по умолчанию - обновить
  // Проверяем, что нужно обновить
  const hasExistingName = Boolean(existingClient.firstName) || Boolean(existingClient.lastName);
  const hasNewName = Boolean(parsedName.firstName) || Boolean(parsedName.lastName);
  const existingPhones = existingClient.phones.map((p) => p.phone);
  const newPhones = parsedPhones
    .filter((p) => p.isValid)
    .map((p) => p.normalized)
    .filter((p) => !existingPhones.includes(p));

  const updateReasons: string[] = [];

  // Обновление ФИО
  if (duplicateAction.updateName && !hasExistingName && hasNewName) {
    updateReasons.push('Add missing name');
  }

  // Добавление новых номеров
  if (duplicateAction.addPhones && newPhones.length > 0) {
    updateReasons.push('Add new phones');
  }

  // Обновление региона (будет обработано в сервисе)
  if (duplicateAction.updateRegion) {
    updateReasons.push('Update region');
  }

  // Если есть что обновить
  if (updateReasons.length > 0) {
    return {
      action: 'update',
      reason: updateReasons.join(', '),
      existingClientId: existingClient.id,
    };
  }

  // Если нечего обновлять, но нужно добавить в группу или переместить
  if (duplicateAction.addToGroup || duplicateAction.moveToGroup) {
    return {
      action: 'update',
      reason: duplicateAction.moveToGroup ? 'Move to group' : 'Add to group',
      existingClientId: existingClient.id,
    };
  }

  // Полное совпадение - пропускаем
  return {
    action: 'skip',
    reason: 'Duplicate',
    existingClientId: existingClient.id,
  };
}

