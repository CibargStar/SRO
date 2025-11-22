/**
 * Парсер ФИО из полного имени
 * 
 * Разбирает строку с полным именем на компоненты: фамилия, имя, отчество.
 * Обрабатывает случаи с 3-4 словами, исключая слова типа "Оглы".
 * 
 * @module modules/import/parsers/name.parser
 */

import type { ParsedName } from '../types';

/**
 * Список слов-исключений (4-е слово, которое нужно игнорировать)
 */
const EXCLUDED_WORDS = [
  'оглы',
  'оглу',
  'оглыу',
  'кызы',
  'кызыу',
  'огли',
  'оглиу',
  'кызи',
  'кызиу',
];

/**
 * Парсит полное имя на компоненты
 * 
 * @param fullName - Полное имя (например: "Никита Путилин Михайлович")
 * @returns Объект с разобранными компонентами имени
 * 
 * @example
 * ```typescript
 * parseFullName("Иванов Иван Иванович")
 * // { lastName: "Иванов", firstName: "Иван", middleName: "Иванович" }
 * 
 * parseFullName("Иванов Иван Иванович Оглы")
 * // { lastName: "Иванов", firstName: "Иван", middleName: "Иванович" } (Оглы игнорируется)
 * 
 * parseFullName(null)
 * // { lastName: null, firstName: null, middleName: null }
 * ```
 */
export function parseFullName(fullName: string | null): ParsedName {
  // Если имя пустое или null
  if (!fullName || typeof fullName !== 'string') {
    return {
      lastName: null,
      firstName: null,
      middleName: null,
    };
  }

  // Нормализация: удаление лишних пробелов
  const trimmed = fullName.trim();

  if (trimmed.length === 0) {
    return {
      lastName: null,
      firstName: null,
      middleName: null,
    };
  }

  // Разделение по пробелам
  const words = trimmed.split(/\s+/).filter((word) => word.length > 0);

  // Обработка в зависимости от количества слов
  if (words.length === 0) {
    return {
      lastName: null,
      firstName: null,
      middleName: null,
    };
  }

  if (words.length === 1) {
    // Только одно слово - считаем фамилией
    return {
      lastName: words[0],
      firstName: null,
      middleName: null,
    };
  }

  if (words.length === 2) {
    // Два слова - фамилия и имя
    return {
      lastName: words[0],
      firstName: words[1],
      middleName: null,
    };
  }

  if (words.length === 3) {
    // Три слова - фамилия, имя, отчество
    return {
      lastName: words[0],
      firstName: words[1],
      middleName: words[2],
    };
  }

  // 4+ слова
  // Проверяем, является ли 4-е слово исключением
  const fourthWord = words[3]?.toLowerCase();

  if (fourthWord && EXCLUDED_WORDS.includes(fourthWord)) {
    // 4-е слово - исключение, игнорируем его
    return {
      lastName: words[0],
      firstName: words[1],
      middleName: words[2],
    };
  }

  // 4-е слово не исключение, берем первые 3 слова
  return {
    lastName: words[0],
    firstName: words[1],
    middleName: words[2],
  };
}

