/**
 * Парсер Excel файлов (XLSX, XLS, CSV)
 * 
 * Читает файл и извлекает данные из обязательных колонок: name, phone, region.
 * Поддерживает различные форматы и варианты названий колонок (case-insensitive).
 * 
 * @module modules/import/parsers/excel.parser
 */

import * as XLSX from 'xlsx';
import type { ParsedRow } from '../types';

/**
 * Названия обязательных колонок (различные варианты)
 */
const COLUMN_NAMES = {
  name: ['name', 'имя', 'фио', 'full name', 'полное имя', 'контакт'],
  phone: ['phone', 'телефон', 'tel', 'mobile', 'мобильный', 'номер'],
  region: ['region', 'регион', 'область', 'город', 'city', 'area'],
};

/**
 * Находит индекс колонки по различным вариантам названий
 * 
 * @param headers - Массив заголовков
 * @param variants - Варианты названий колонки
 * @returns Индекс колонки или -1 если не найдена
 */
function findColumnIndex(headers: string[], variants: string[]): number {
  const normalizedHeaders = headers.map((h) => h.toLowerCase().trim());
  const normalizedVariants = variants.map((v) => v.toLowerCase().trim());

  for (let i = 0; i < normalizedHeaders.length; i++) {
    const header = normalizedHeaders[i];
    if (normalizedVariants.some((variant) => header.includes(variant) || variant.includes(header))) {
      return i;
    }
  }

  return -1;
}

/**
 * Парсит Excel файл и извлекает данные
 * 
 * @param buffer - Буфер с содержимым файла
 * @param filename - Имя файла (для определения формата)
 * @returns Массив распарсенных строк
 * 
 * @throws {Error} Если файл не может быть прочитан или отсутствуют обязательные колонки
 */
export function parseExcelFile(buffer: Buffer, filename: string): ParsedRow[] {
  try {
    // Определение формата файла
    const ext = filename.toLowerCase().split('.').pop();
    if (!ext || !['xlsx', 'xls', 'csv'].includes(ext)) {
      throw new Error(`Unsupported file format: ${ext}. Supported: xlsx, xls, csv`);
    }

    // Чтение файла
    const workbook = XLSX.read(buffer, {
      type: 'buffer',
      cellDates: false,
      cellNF: false,
      cellText: false,
    });

    // Получение первого листа
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      throw new Error('Excel file has no sheets');
    }

    const worksheet = workbook.Sheets[sheetName];

    // Конвертация в JSON
    const jsonData = XLSX.utils.sheet_to_json(worksheet, {
      header: 1, // Массив массивов
      defval: '', // Значение по умолчанию для пустых ячеек
      raw: false, // Все значения как строки
    }) as unknown[][];

    if (jsonData.length === 0) {
      throw new Error('Excel file is empty');
    }

    // Первая строка - заголовки
    const headers = (jsonData[0] as string[]).map((h) => String(h || '').trim());

    // Поиск индексов обязательных колонок
    const nameIndex = findColumnIndex(headers, COLUMN_NAMES.name);
    const phoneIndex = findColumnIndex(headers, COLUMN_NAMES.phone);
    const regionIndex = findColumnIndex(headers, COLUMN_NAMES.region);

    // Проверка наличия обязательных колонок
    const missingColumns: string[] = [];
    if (nameIndex === -1) {
      missingColumns.push('name (имя, фио)');
    }
    if (phoneIndex === -1) {
      missingColumns.push('phone (телефон)');
    }
    if (regionIndex === -1) {
      missingColumns.push('region (регион)');
    }

    if (missingColumns.length > 0) {
      throw new Error(`Missing required columns: ${missingColumns.join(', ')}`);
    }

    // Парсинг данных (начиная со второй строки)
    const rows: ParsedRow[] = [];

    for (let i = 1; i < jsonData.length; i++) {
      const row = jsonData[i] as unknown[];

      // Извлечение значений
      const name = row[nameIndex] ? String(row[nameIndex]).trim() : null;
      const phone = row[phoneIndex] ? String(row[phoneIndex]).trim() : '';
      const region = row[regionIndex] ? String(row[regionIndex]).trim() : '';

      // Пропускаем полностью пустые строки
      if (!name && !phone && !region) {
        continue;
      }

      rows.push({
        name: name || null,
        phone: phone || '',
        region: region || '',
        rowNumber: i + 1, // Номер строки в Excel (начиная с 1, учитывая заголовок)
      });
    }

    return rows;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to parse Excel file: ${error.message}`);
    }
    throw new Error('Failed to parse Excel file: Unknown error');
  }
}

