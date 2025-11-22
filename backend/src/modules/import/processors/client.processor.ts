/**
 * Процессор клиентов
 * 
 * Создает и обновляет клиентов в базе данных.
 * 
 * @module modules/import/processors/client.processor
 */

import { PrismaClient } from '@prisma/client';
import type { ParsedName, ParsedPhone } from '../types';
import logger from '../../../config/logger';

/**
 * Данные для создания клиента
 */
interface CreateClientData {
  parsedName: ParsedName;
  regionId: string | null;
  phones: ParsedPhone[];
  groupId: string;
  userId: string; // Владелец группы
  status?: 'NEW' | 'OLD';
}

/**
 * Создает нового клиента с телефонами
 * 
 * @param data - Данные для создания клиента
 * @param prisma - Prisma клиент
 * @returns Созданный клиент
 */
export async function createClient(
  data: CreateClientData,
  prisma: PrismaClient
): Promise<{ id: string }> {
  try {
    // Создание клиента в транзакции
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const result = await prisma.$transaction(async (tx) => {
      // Создание клиента
      // В схеме lastName и firstName обязательны, но при импорте может не быть ФИО
      // Используем пустые строки если имя отсутствует (клиент без ФИО)
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      const client = await tx.client.create({
        data: {
          userId: data.userId,
          lastName: data.parsedName.lastName || '',
          firstName: data.parsedName.firstName || '',
          middleName: data.parsedName.middleName,
          regionId: data.regionId,
          groupId: data.groupId,
          status: data.status || 'NEW',
        },
        select: {
          id: true,
        },
      });

      // Создание телефонов (только валидные)
      const validPhones = data.phones.filter((p) => p.isValid);
      if (validPhones.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        await tx.clientPhone.createMany({
          data: validPhones.map((phone) => ({
            clientId: client.id,
            phone: phone.normalized,
          })),
        });
      }

      // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access
      return client;
    });

    logger.debug('Client created during import', {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      clientId: result.id,
      userId: data.userId,
      groupId: data.groupId,
    });

    // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access
    return result;
  } catch (error) {
    logger.error('Error creating client during import', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: data.userId,
      groupId: data.groupId,
    });
    throw error;
  }
}

/**
 * Обновляет ФИО клиента
 * 
 * @param clientId - ID клиента
 * @param parsedName - Новое ФИО
 * @param prisma - Prisma клиент
 */
export async function updateClientName(
  clientId: string,
  parsedName: ParsedName,
  prisma: PrismaClient
): Promise<void> {
  try {
    // Обновляем только если есть новые данные
    // Используем пустые строки если имя отсутствует
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    await prisma.client.update({
      where: { id: clientId },
      data: {
        lastName: parsedName.lastName || '',
        firstName: parsedName.firstName || '',
        middleName: parsedName.middleName,
      },
    });

    logger.debug('Client name updated during import', {
      clientId,
    });
  } catch (error) {
    logger.error('Error updating client name during import', {
      error: error instanceof Error ? error.message : 'Unknown error',
      clientId,
    });
    throw error;
  }
}

/**
 * Добавляет новые телефоны к существующему клиенту
 * 
 * @param clientId - ID клиента
 * @param phones - Новые телефоны
 * @param prisma - Prisma клиент
 */
export async function addPhonesToClient(
  clientId: string,
  phones: ParsedPhone[],
  prisma: PrismaClient
): Promise<void> {
  try {
    // Получаем существующие телефоны клиента
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const existingPhones = await prisma.clientPhone.findMany({
      where: { clientId },
      select: { phone: true },
    });

    const existingPhoneSet = new Set(existingPhones.map((p) => p.phone));

    // Фильтруем только новые валидные телефоны
    const newPhones = phones
      .filter((p) => p.isValid && !existingPhoneSet.has(p.normalized))
      .map((p) => ({
        clientId,
        phone: p.normalized,
      }));

    if (newPhones.length > 0) {
      // SQLite не поддерживает skipDuplicates, поэтому проверяем вручную
      // Создаем телефоны по одному с обработкой ошибок дубликатов
      for (const phoneData of newPhones) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
          await prisma.clientPhone.create({
            data: phoneData,
          });
        } catch (error) {
          // Игнорируем ошибки дубликатов (номер уже существует)
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          if (error && typeof error === 'object' && 'code' in error && error.code !== 'P2002') {
            throw error;
          }
        }
      }

      logger.debug('Phones added to client during import', {
        clientId,
        phonesCount: newPhones.length,
      });
    }
  } catch (error) {
    logger.error('Error adding phones to client during import', {
      error: error instanceof Error ? error.message : 'Unknown error',
      clientId,
    });
    throw error;
  }
}

