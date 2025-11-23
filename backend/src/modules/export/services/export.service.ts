/**
 * Сервис экспорта групп клиентов
 * 
 * Генерирует Excel/CSV файлы с данными группы клиентов.
 * 
 * @module modules/export/services/export.service
 */

import { PrismaClient } from '@prisma/client';
import * as XLSX from 'xlsx';
import logger from '../../../config/logger';

/**
 * Формат экспорта
 */
export type ExportFormat = 'xlsx' | 'xls' | 'csv';

/**
 * Данные клиента для экспорта
 * Ключи должны совпадать с заголовками колонок
 */
export interface ExportClientData {
  FullName: string;
  Phone: string;
  Region: string;
  Date: string;
}

/**
 * Экспортирует группу клиентов в файл
 * 
 * @param groupId - ID группы для экспорта
 * @param format - Формат файла (xlsx, xls, csv)
 * @param prisma - Prisma клиент
 * @returns Buffer с содержимым файла и имя файла
 */
export async function exportGroup(
  groupId: string,
  format: ExportFormat,
  prisma: PrismaClient
): Promise<{ buffer: Buffer; filename: string }> {
  // Получение группы с клиентами
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
  const group = await prisma.clientGroup.findUnique({
    where: { id: groupId },
    select: {
      id: true,
      name: true,
      clients: {
        include: {
          region: {
            select: {
              name: true,
            },
          },
          phones: {
            select: {
              phone: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      },
    },
  });

  if (!group) {
    throw new Error(`Group with id ${groupId} not found`);
  }

  // Подготовка данных для экспорта
  const exportData: ExportClientData[] = [];

  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
  for (const client of group.clients) {
    // Формирование ФИО
    const nameParts: string[] = [];
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (client.lastName) nameParts.push(client.lastName);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (client.firstName) nameParts.push(client.firstName);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (client.middleName) nameParts.push(client.middleName);
    const fullName = nameParts.join(' ').trim();

    // Формирование телефонов через запятую
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
    const phones = client.phones.map((p) => p.phone).join(', ');

    // Регион
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const region = client.region?.name || '';

    // Дата создания (только дата, без времени)
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const createdAt = new Date(client.createdAt);
    const date = createdAt.toISOString().split('T')[0]; // Формат YYYY-MM-DD

    exportData.push({
      FullName: fullName,
      Phone: phones,
      Region: region,
      Date: date,
    });
  }

  // Создание рабочей книги Excel
  const worksheet = XLSX.utils.json_to_sheet(exportData, {
    header: ['FullName', 'Phone', 'Region', 'Date'],
  });

  // Настройка ширины колонок
  const columnWidths = [
    { wch: 30 }, // FullName
    { wch: 40 }, // Phone
    { wch: 20 }, // Region
    { wch: 12 }, // Date
  ];
  worksheet['!cols'] = columnWidths;

  // Создание рабочей книги
  const workbook = XLSX.utils.book_new();
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
  XLSX.utils.book_append_sheet(workbook, worksheet, group.name);

  // Генерация файла в зависимости от формата
  let buffer: Buffer;
  let fileExtension: string;

  switch (format) {
    case 'xlsx':
      buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
      fileExtension = 'xlsx';
      break;
    case 'xls':
      buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xls' });
      fileExtension = 'xls';
      break;
    case 'csv':
      // Для CSV создаем отдельный буфер
      const csvData = XLSX.utils.sheet_to_csv(worksheet);
      buffer = Buffer.from(csvData, 'utf-8');
      fileExtension = 'csv';
      break;
    default:
      throw new Error(`Unsupported export format: ${format}`);
  }

  // Формирование имени файла (название группы + расширение)
  // Очистка имени группы от недопустимых символов для имени файла
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
  const sanitizedGroupName = group.name
    .replace(/[<>:"/\\|?*]/g, '_') // Замена недопустимых символов
    .trim()
    .substring(0, 100); // Ограничение длины

  const filename = `${sanitizedGroupName}.${fileExtension}`;

  logger.info('Group exported successfully', {
    groupId,
    groupName: group.name,
    format,
    clientsCount: exportData.length,
    filename,
  });

  return { buffer, filename };
}

