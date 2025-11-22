/**
 * Процессор регионов
 * 
 * Обрабатывает регионы: поиск существующих и создание новых.
 * Только ROOT может создавать регионы.
 * 
 * @module modules/import/processors/region.processor
 */

import { PrismaClient } from '@prisma/client';
import type { UserRole } from '@prisma/client';
import logger from '../../../config/logger';

/**
 * Кэш регионов для текущей сессии импорта
 * Ключ: нормализованное название региона (lowercase)
 * Значение: ID региона
 */
const regionCache = new Map<string, string>();

/**
 * Очищает кэш регионов
 */
export function clearRegionCache(): void {
  regionCache.clear();
}

/**
 * Результат поиска/создания региона
 */
export interface RegionResult {
  id: string | null;
  wasCreated: boolean; // true если регион был создан, false если найден
}

/**
 * Находит или создает регион
 * 
 * @param regionName - Название региона
 * @param currentUserId - ID текущего пользователя (для логирования)
 * @param userRole - Роль текущего пользователя
 * @param prisma - Prisma клиент
 * @returns Результат с ID региона и флагом создания
 */
export async function findOrCreateRegion(
  regionName: string,
  currentUserId: string,
  userRole: UserRole,
  prisma: PrismaClient
): Promise<RegionResult> {
  // Если регион пустой
  if (!regionName || typeof regionName !== 'string') {
    return { id: null, wasCreated: false };
  }

  const normalized = regionName.trim();

  if (normalized.length === 0) {
    return { id: null, wasCreated: false };
  }

  const normalizedKey = normalized.toLowerCase();

  // Проверка кэша (храним информацию о том, был ли регион создан)
  // Используем Map с объектом { id, wasCreated }
  const cached = regionCache.get(normalizedKey);
  if (cached) {
    // cached может быть строкой (старый формат) или объектом
    if (typeof cached === 'string') {
      return { id: cached, wasCreated: false }; // Старый формат - считаем что найден
    }
    return cached as RegionResult;
  }

  try {
    // Поиск в БД (SQLite не поддерживает case-insensitive через Prisma, делаем через поиск всех и фильтрацию)
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const allRegions = await prisma.region.findMany({
      select: {
        id: true,
        name: true,
      },
    });

    // Поиск с case-insensitive сравнением
    const existingRegion = allRegions.find(
      (r) => r.name.toLowerCase() === normalized.toLowerCase()
    );

    if (existingRegion) {
      // Регион найден - сохраняем в кэш и возвращаем
      const result: RegionResult = { id: existingRegion.id, wasCreated: false };
      regionCache.set(normalizedKey, result);
      return result;
    }

    // Регион не найден - создаем (только ROOT)
    if (userRole !== 'ROOT') {
      logger.warn('Non-ROOT user attempted to create region during import', {
        regionName: normalized,
        userId: currentUserId,
        userRole,
      });
      // Не создаем регион, но не прерываем импорт
      return { id: null, wasCreated: false };
    }

    // Создание нового региона
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const newRegion = await prisma.region.create({
      data: {
        name: normalized,
      },
      select: {
        id: true,
        name: true,
      },
    });

    logger.info('Region created during import', {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      regionId: newRegion.id,
      regionName: normalized,
      createdBy: currentUserId,
    });

    // Сохраняем в кэш
    const result: RegionResult = { 
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      id: newRegion.id, 
      wasCreated: true 
    };
    regionCache.set(normalizedKey, result);
    return result;
  } catch (error) {
    logger.error('Error finding or creating region', {
      error: error instanceof Error ? error.message : 'Unknown error',
      regionName: normalized,
      userId: currentUserId,
    });
    return { id: null, wasCreated: false };
  }
}

