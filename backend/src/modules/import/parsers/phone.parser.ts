/**
 * Парсер и валидатор телефонных номеров
 * 
 * Извлекает несколько номеров из строки, нормализует и валидирует их.
 * Поддерживает различные форматы: российские (+7, 8, 7) и международные.
 * 
 * @module modules/import/parsers/phone.parser
 */

import { parsePhoneNumber, isValidPhoneNumber } from 'libphonenumber-js';
import type { ParsedPhone } from '../types';

/**
 * Нормализует номер телефона для российских номеров
 * Преобразует 8 в начале в +7, добавляет + к 7
 */
function normalizeRussianPhone(phone: string): string {
  // Удаляем все нецифровые символы кроме +
  const cleaned = phone.replace(/[^\d+]/g, '');
  
  // Если начинается с 8 и длина 11 цифр, заменяем на +7
  if (cleaned.startsWith('8') && cleaned.length === 11) {
    return `+7${cleaned.substring(1)}`;
  }
  
  // Если начинается с 7 без + и длина 11 цифр, добавляем +
  if (cleaned.startsWith('7') && !cleaned.startsWith('+7') && cleaned.length === 11) {
    return `+${cleaned}`;
  }
  
  // Если начинается с +7, возвращаем как есть
  if (cleaned.startsWith('+7')) {
    return cleaned;
  }
  
  // Если только 10 цифр (без кода страны), добавляем +7
  if (/^\d{10}$/.test(cleaned)) {
    return `+7${cleaned}`;
  }
  
  return cleaned;
}

/**
 * Парсит строку с телефонами на массив нормализованных номеров
 * 
 * @param phoneString - Строка с номерами (может быть несколько, разделены запятой/пробелом)
 * @returns Массив распарсенных телефонов
 * 
 * @example
 * ```typescript
 * parsePhones("+7 999 123-45-67, 8 999 123-45-68")
 * // [
 * //   { normalized: "+79991234567", original: "+7 999 123-45-67", isValid: true },
 * //   { normalized: "+79991234568", original: "8 999 123-45-68", isValid: true }
 * // ]
 * ```
 */
export function parsePhones(phoneString: string): ParsedPhone[] {
  if (!phoneString || typeof phoneString !== 'string') {
    return [];
  }

  // Простая логика разделения номеров:
  // 1. Разделяем по запятым
  // 2. Каждую часть обрабатываем как отдельный номер
  
  const phoneStrings: string[] = [];
  
  // Разделяем по запятым
  const commaParts = phoneString.split(',').map((p) => p.trim()).filter((p) => p.length > 0);
  
  // Если есть запятые, используем их для разделения
  if (commaParts.length > 1) {
    phoneStrings.push(...commaParts);
  } else {
    // Если запятых нет, пробуем найти номера через пробел
    // Ищем паттерны номеров: начинаются с +7, 8, или 7
    const phonePattern = /(\+?7|8)[\d\s\-\(\)]+/g;
    const matches = phoneString.match(phonePattern);
    
    if (matches && matches.length > 0) {
      phoneStrings.push(...matches.map((m) => m.trim()));
    } else {
      // Если ничего не найдено, пробуем всю строку как один номер
      phoneStrings.push(phoneString.trim());
    }
  }

  const result: ParsedPhone[] = [];

  for (const phoneStr of phoneStrings) {
    try {
      let normalized: string = phoneStr;
      let isValid = false;

      // Подготовка вариантов для валидации
      // Убираем лишние пробелы, но сохраняем структуру номера
      const cleaned = phoneStr.replace(/\s+/g, ' ').trim();
      
      // Создаем варианты для проверки
      const variants: string[] = [];
      
      // 1. Оригинальная строка
      variants.push(cleaned);
      
      // 2. Вариант с заменой 8 на +7 в начале
      if (cleaned.startsWith('8')) {
        variants.push(cleaned.replace(/^8/, '+7'));
      }
      
      // 3. Вариант с добавлением + к 7 в начале
      if (cleaned.match(/^7[\d\s\-\(\)]/) && !cleaned.startsWith('+7')) {
        variants.push(`+${cleaned}`);
      }
      
      // 4. Вариант с нормализацией через normalizeRussianPhone
      const normalizedRussian = normalizeRussianPhone(cleaned);
      if (normalizedRussian !== cleaned) {
        variants.push(normalizedRussian);
      }
      
      // 5. Вариант без пробелов, скобок и дефисов (только цифры и +)
      const digitsOnly = cleaned.replace(/[^\d+]/g, '');
      if (digitsOnly.length > 0) {
        // Нормализуем начало
        let normalizedDigits = digitsOnly;
        if (normalizedDigits.startsWith('8') && normalizedDigits.length === 11) {
          normalizedDigits = `+7${normalizedDigits.substring(1)}`;
        } else if (normalizedDigits.startsWith('7') && !normalizedDigits.startsWith('+7') && normalizedDigits.length === 11) {
          normalizedDigits = `+${normalizedDigits}`;
        } else if (!normalizedDigits.startsWith('+') && normalizedDigits.length >= 10) {
          // Если нет + и достаточно цифр, пробуем добавить +7
          if (normalizedDigits.startsWith('7')) {
            normalizedDigits = `+${normalizedDigits}`;
          } else if (normalizedDigits.length === 10) {
            normalizedDigits = `+7${normalizedDigits}`;
          }
        }
        // Добавляем оба варианта: оригинальный digitsOnly и нормализованный
        if (digitsOnly !== cleaned) {
          variants.push(digitsOnly);
        }
        if (normalizedDigits !== digitsOnly && normalizedDigits !== cleaned) {
          variants.push(normalizedDigits);
        }
      }

      // Убираем дубликаты
      const uniqueVariants = Array.from(new Set(variants));

      // Пробуем валидировать каждый вариант
      for (const variant of uniqueVariants) {
        try {
          // Сначала пробуем как российский номер с явным указанием страны
          try {
            if (isValidPhoneNumber(variant, 'RU')) {
              const parsed = parsePhoneNumber(variant, 'RU');
              normalized = parsed.format('E.164'); // Международный формат: +79991234567
              isValid = true;
              break;
            }
          } catch {
            // Продолжаем попытки
          }
          
          // Пробуем как международный (без указания страны)
          try {
            if (isValidPhoneNumber(variant)) {
              const parsed = parsePhoneNumber(variant);
              normalized = parsed.format('E.164');
              isValid = true;
              break;
            }
          } catch {
            // Продолжаем попытки
          }
          
          // Пробуем парсить без валидации (может быть частично валидный номер)
          // Это помогает обработать номера с опечатками в коде города
          try {
            const parsed = parsePhoneNumber(variant, 'RU');
            // Если парсинг успешен, проверяем, что это действительно российский номер
            if (parsed.country === 'RU') {
              normalized = parsed.format('E.164');
              isValid = true;
              break;
            }
          } catch {
            // Продолжаем попытки
          }
          
          // Пробуем парсить как международный без указания страны
          try {
            const parsed = parsePhoneNumber(variant);
            // Если это российский номер (начинается с +7, 7, или 8)
            if (parsed.country === 'RU' || variant.startsWith('+7') || variant.startsWith('7') || variant.startsWith('8')) {
              normalized = parsed.format('E.164');
              isValid = true;
              break;
            }
          } catch {
            // Продолжаем попытки
          }
        } catch {
          // Продолжаем попытки
        }
      }

      // Если не удалось нормализовать через libphonenumber-js, пробуем fallback логику
      // Это помогает обработать номера с опечатками в коде города
      if (!isValid) {
        // Извлекаем только цифры и +
        const digitsOnly = phoneStr.replace(/[^\d+]/g, '');
        
        // Проверяем, что это похоже на российский номер
        if (digitsOnly.startsWith('+7') && digitsOnly.length === 12) {
          // +7 и 10 цифр после = валидная структура
          normalized = digitsOnly;
          isValid = true; // Принимаем как валидный, даже если код города неправильный
        } else if (digitsOnly.startsWith('8') && digitsOnly.length === 11) {
          // 8 и 10 цифр после = валидная структура
          normalized = `+7${digitsOnly.substring(1)}`;
          isValid = true;
        } else if (digitsOnly.startsWith('7') && !digitsOnly.startsWith('+7') && digitsOnly.length === 11) {
          // 7 и 10 цифр после = валидная структура
          normalized = `+${digitsOnly}`;
          isValid = true;
        } else {
          // Не удалось нормализовать
          normalized = phoneStr;
        }
      }

      result.push({
        normalized,
        original: phoneStr,
        isValid,
      });
    } catch (error) {
      // Ошибка при парсинге - сохраняем оригинал как невалидный
      result.push({
        normalized: phoneStr,
        original: phoneStr,
        isValid: false,
      });
    }
  }

  return result;
}

/**
 * Нормализует один номер телефона
 * 
 * @param phone - Номер телефона
 * @returns Нормализованный номер или null если невалидный
 */
export function normalizePhone(phone: string): string | null {
  const parsed = parsePhones(phone);
  if (parsed.length === 0) {
    return null;
  }

  // Возвращаем первый валидный номер
  const validPhone = parsed.find((p) => p.isValid);
  return validPhone ? validPhone.normalized : parsed[0].normalized;
}

