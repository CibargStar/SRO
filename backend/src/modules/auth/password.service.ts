/**
 * Сервис хеширования паролей
 * 
 * Единая точка для работы с паролями в системе.
 * Использует argon2id - современный и безопасный алгоритм хеширования.
 * 
 * @module modules/auth/password.service
 */

import argon2 from 'argon2';
import logger from '../../config/logger';

/**
 * Параметры хеширования для argon2id
 * 
 * Выбраны для баланса безопасности и производительности:
 * - memoryCost: 65536 (64 MB) - память для хеширования
 * - timeCost: 3 - количество итераций (время вычисления)
 * - parallelism: 4 - количество параллельных потоков
 * 
 * Эти параметры обеспечивают:
 * - Защиту от brute force атак
 * - Защиту от rainbow table атак
 * - Приемлемую производительность (хеширование ~200-500ms)
 * 
 * В production можно увеличить параметры для большей безопасности,
 * но это увеличит время хеширования.
 */
const ARGON2_OPTIONS: argon2.Options = {
  type: argon2.argon2id, // Гибридный режим (защита от time-memory trade-off атак)
  memoryCost: 65536, // 64 MB (2^16)
  timeCost: 3, // 3 итерации
  parallelism: 4, // 4 потока
  hashLength: 32, // 32 байта (256 бит) - достаточная длина для безопасности
};

/**
 * Хеширует пароль с использованием argon2id
 * 
 * @param plain - Пароль в открытом виде (plaintext)
 * @returns Промис с хешем пароля (включает соль и параметры)
 * 
 * @throws {Error} Если произошла ошибка при хешировании
 * 
 * @example
 * ```typescript
 * const hash = await hashPassword('mySecurePassword123!');
 * // Сохранить hash в БД
 * ```
 * 
 * Безопасность:
 * - Использует криптографически стойкий алгоритм argon2id
 * - Автоматически генерирует уникальную соль для каждого пароля
 * - Параметры хеширования включены в результат (для верификации)
 * - Асинхронная операция (не блокирует event loop)
 * - Не логирует пароль или хеш
 */
export async function hashPassword(plain: string): Promise<string> {
  if (!plain || plain.length === 0) {
    throw new Error('Password cannot be empty');
  }

  try {
    // Хеширование пароля с использованием argon2id
    // Результат включает: алгоритм, параметры, соль и хеш
    const hash = await argon2.hash(plain, ARGON2_OPTIONS);
    
    // ВАЖНО: Не логируем пароль или хеш!
    // Логируем только факт успешного хеширования
    logger.debug('Password hashed successfully');
    
    return hash;
  } catch (error) {
    // Логируем ошибку без деталей пароля
    logger.error('Failed to hash password', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw new Error('Password hashing failed');
  }
}

/**
 * Проверяет соответствие пароля хешу
 * 
 * @param plain - Пароль в открытом виде для проверки
 * @param hash - Хеш пароля из базы данных
 * @returns Промис с булевым значением: true если пароль совпадает, false иначе
 * 
 * @throws {Error} Если произошла ошибка при верификации
 * 
 * @example
 * ```typescript
 * const isValid = await verifyPassword('mySecurePassword123!', storedHash);
 * if (isValid) {
 *   // Пароль верный
 * }
 * ```
 * 
 * Безопасность:
 * - Использует constant-time сравнение (защита от timing attacks)
 * - Автоматически извлекает параметры из хеша
 * - Не логирует пароль или хеш
 * - Всегда возвращает false для неверных паролей (без утечки информации)
 */
export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  if (!plain || plain.length === 0) {
    return false;
  }

  if (!hash || hash.length === 0) {
    logger.warn('Empty hash provided for password verification');
    return false;
  }

  try {
    // Верификация пароля
    // Argon2 автоматически извлекает параметры из хеша
    const isValid = await argon2.verify(hash, plain);
    
    // ВАЖНО: Не логируем результат верификации с деталями!
    // Логируем только факт попытки верификации (без результата)
    if (isValid) {
      logger.debug('Password verification successful');
    } else {
      logger.debug('Password verification failed');
    }
    
    return isValid;
  } catch (error) {
    // Ошибка может возникнуть при неверном формате хеша
    // В этом случае считаем пароль неверным
    logger.warn('Password verification error', { 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
    return false;
  }
}

/**
 * Типичные ошибки безопасности при работе с паролями:
 * 
 * 1. ❌ Хранение паролей в открытом виде (plaintext)
 *    ✅ Всегда хранить только хеши
 * 
 * 2. ❌ Использование устаревших алгоритмов (MD5, SHA-1, SHA-256)
 *    ✅ Использовать современные алгоритмы (argon2, bcrypt, scrypt)
 * 
 * 3. ❌ Синхронное хеширование (блокирует event loop)
 *    ✅ Всегда использовать асинхронные функции
 * 
 * 4. ❌ Логирование паролей или хешей
 *    ✅ Никогда не логировать пароли, даже в debug режиме
 * 
 * 5. ❌ Использование слабых параметров хеширования
 *    ✅ Использовать достаточные параметры (memoryCost, timeCost)
 * 
 * 6. ❌ Отсутствие защиты от timing attacks
 *    ✅ Использовать constant-time сравнение (argon2 делает это автоматически)
 * 
 * 7. ❌ Хранение паролей в памяти дольше необходимого
 *    ✅ Очищать переменные после использования (но в JS это сложно)
 * 
 * 8. ❌ Использование одной соли для всех паролей
 *    ✅ Генерировать уникальную соль для каждого пароля (argon2 делает автоматически)
 * 
 * 9. ❌ Возврат разных сообщений об ошибках для неверного пароля и несуществующего пользователя
 *    ✅ Всегда возвращать одинаковое сообщение (защита от enumeration)
 * 
 * 10. ❌ Отсутствие обновления алгоритма при смене пароля
 *     ✅ Использовать passwordVersion для отслеживания версии алгоритма
 * 
 * 11. ❌ Использование слишком быстрого хеширования
 *     ✅ Баланс между безопасностью и производительностью (200-500ms приемлемо)
 * 
 * 12. ❌ Хранение паролей в коде или конфигурационных файлах
 *     ✅ Хранить только в переменных окружения или secure vault
 */

