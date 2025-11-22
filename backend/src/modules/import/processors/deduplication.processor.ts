/**
 * Процессор дедупликации
 * 
 * Находит существующих клиентов по номерам телефонов и определяет стратегию обновления.
 * 
 * @module modules/import/processors/deduplication.processor
 */

import { PrismaClient } from '@prisma/client';
import type { DeduplicationStrategy, ParsedName, ParsedPhone } from '../types';

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
 * Находит существующего клиента по номерам телефонов
 * 
 * @param phones - Массив распарсенных телефонов
 * @param userId - ID владельца группы (среди клиентов которого ищем)
 * @param prisma - Prisma клиент
 * @returns Результат поиска с клиентом и типом совпадения
 */
export async function findExistingClient(
  phones: ParsedPhone[],
  userId: string,
  prisma: PrismaClient
): Promise<FindClientResult> {
  // Извлекаем только валидные нормализованные номера
  const validPhones = phones.filter((p) => p.isValid).map((p) => p.normalized);

  if (validPhones.length === 0) {
    return { client: null, matchType: null };
  }

  try {
    // Поиск клиентов по номерам телефонов
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const clients = await prisma.client.findMany({
      where: {
        userId,
        phones: {
          some: {
            phone: {
              in: validPhones,
            },
          },
        },
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

    // Определяем тип совпадения (для будущего использования)
    // Пока просто возвращаем 'phone', так как сравнение ФИО делается в determineStrategy
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
      matchType: 'phone',
    };
  } catch (error) {
    // Ошибка при поиске - считаем что клиент не найден
    return { client: null, matchType: null };
  }
}

/**
 * Определяет стратегию обработки клиента
 * 
 * @param existingClient - Существующий клиент или null
 * @param parsedName - Распарсенное ФИО из импорта
 * @param parsedPhones - Распарсенные телефоны из импорта
 * @returns Стратегия обработки
 */
export function determineStrategy(
  existingClient: FindClientResult['client'],
  parsedName: ParsedName,
  parsedPhones: ParsedPhone[]
): DeduplicationStrategy {
  // Если клиент не найден - создаем новый
  if (!existingClient) {
    return {
      action: 'create',
      reason: 'New client',
    };
  }

  // Проверка: есть ли ФИО в существующем клиенте
  const hasExistingName =
    Boolean(existingClient.firstName) || Boolean(existingClient.lastName);
  const hasNewName = Boolean(parsedName.firstName) || Boolean(parsedName.lastName);

  // Проверка: есть ли новые номера
  const existingPhones = existingClient.phones.map((p) => p.phone);
  const newPhones = parsedPhones
    .filter((p) => p.isValid)
    .map((p) => p.normalized)
    .filter((p) => !existingPhones.includes(p));

  // Стратегия 1: Нет ФИО в старом, есть в новом → обновить ФИО
  if (!hasExistingName && hasNewName) {
    return {
      action: 'update',
      reason: 'Add missing name',
      existingClientId: existingClient.id,
    };
  }

  // Стратегия 2: Есть новые номера → добавить номера
  if (newPhones.length > 0) {
    return {
      action: 'update',
      reason: 'Add new phones',
      existingClientId: existingClient.id,
    };
  }

  // Стратегия 3: Полное совпадение → пропустить
  return {
    action: 'skip',
    reason: 'Duplicate',
    existingClientId: existingClient.id,
  };
}

