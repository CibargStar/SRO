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
 * Находит или создает регион
 * 
 * @param regionName - Название региона
 * @param currentUserId - ID текущего пользователя (для логирования)
 * @param userRole - Роль текущего пользователя
 * @param prisma - Prisma клиент
 * @returns ID региона или null если регион пустой или не удалось создать
 */
export async function findOrCreateRegion(
  regionName: string,
  currentUserId: string,
  userRole: UserRole,
  prisma: PrismaClient
): Promise<string | null> {
  // Если регион пустой
  if (!regionName || typeof regionName !== 'string') {
    return null;
  }

  const normalized = regionName.trim();

  if (normalized.length === 0) {
    return null;
  }

  const normalizedKey = normalized.toLowerCase();

  // Проверка кэша
  const cachedId = regionCache.get(normalizedKey);
  if (cachedId) {
    return cachedId;
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
      regionCache.set(normalizedKey, existingRegion.id);
      return existingRegion.id;
    }

    // Регион не найден - создаем (только ROOT)
    if (userRole !== 'ROOT') {
      logger.warn('Non-ROOT user attempted to create region during import', {
        regionName: normalized,
        userId: currentUserId,
        userRole,
      });
      // Не создаем регион, но не прерываем импорт
      return null;
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
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    regionCache.set(normalizedKey, newRegion.id);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access
    return newRegion.id;
  } catch (error) {
    logger.error('Error finding or creating region', {
      error: error instanceof Error ? error.message : 'Unknown error',
      regionName: normalized,
      userId: currentUserId,
    });
    return null;
  }
}

