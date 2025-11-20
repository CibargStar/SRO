/**
 * Утилиты для работы с JWT токенами на фронтенде
 * 
 * ВАЖНО: Эти функции НЕ верифицируют подпись токена (это делает backend).
 * Они используются только для декодирования payload и проверки формата/истечения.
 */

/**
 * Декодирует JWT токен без верификации подписи
 * 
 * Используется для проверки exp (expiration) на фронтенде.
 * НЕ используется для проверки подлинности токена - это делает backend.
 * 
 * @param token - JWT токен
 * @returns Payload токена или null если токен невалиден
 * 
 * @example
 * ```typescript
 * const payload = decodeJWT(token);
 * if (payload && payload.exp * 1000 > Date.now()) {
 *   // Токен еще не истек
 * }
 * ```
 */
export function decodeJWT(token: string): { exp?: number; iat?: number; [key: string]: unknown } | null {
  try {
    // JWT состоит из 3 частей, разделенных точками: header.payload.signature
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }

    // Декодируем payload (вторая часть)
    const payload = parts[1];
    
    // Base64 URL decode
    // Заменяем URL-safe символы на обычные Base64
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    
    // Добавляем padding если нужно
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    
    // Декодируем
    const decoded = atob(padded);
    
    // Парсим JSON
    return JSON.parse(decoded) as { exp?: number; iat?: number; [key: string]: unknown };
  } catch {
    return null;
  }
}

/**
 * Проверяет формат JWT токена
 * 
 * Проверяет, что токен имеет правильный формат (3 части, разделенные точками).
 * НЕ проверяет подпись или содержимое payload.
 * 
 * @param token - Токен для проверки
 * @returns true если формат валиден, false иначе
 * 
 * @example
 * ```typescript
 * if (isValidJWTFormat(token)) {
 *   // Токен имеет правильный формат
 * }
 * ```
 */
export function isValidJWTFormat(token: string): boolean {
  if (!token || typeof token !== 'string') {
    return false;
  }

  // JWT должен состоять из 3 частей, разделенных точками
  const parts = token.split('.');
  if (parts.length !== 3) {
    return false;
  }

  // Каждая часть должна быть непустой
  return parts.every((part) => part.length > 0);
}

/**
 * Проверяет, истек ли JWT токен
 * 
 * Декодирует токен и проверяет поле exp (expiration time).
 * 
 * @param token - JWT токен
 * @returns true если токен истек или невалиден, false если еще действителен
 * 
 * @example
 * ```typescript
 * if (isTokenExpired(token)) {
 *   // Токен истек, нужно обновить
 * }
 * ```
 */
export function isTokenExpired(token: string): boolean {
  const payload = decodeJWT(token);
  if (!payload || !payload.exp) {
    return true; // Если нет exp, считаем токен истекшим
  }

  // exp в секундах, Date.now() в миллисекундах
  const expirationTime = payload.exp * 1000;
  const now = Date.now();

  // Добавляем буфер в 30 секунд, чтобы обновлять токен заранее
  const buffer = 30 * 1000; // 30 секунд

  return now >= expirationTime - buffer;
}

/**
 * Проверяет, скоро ли истечет JWT токен
 * 
 * Проверяет, истечет ли токен в ближайшие N секунд.
 * Используется для предварительного обновления токена.
 * 
 * @param token - JWT токен
 * @param seconds - Количество секунд до истечения (по умолчанию 60)
 * @returns true если токен истечет в ближайшие N секунд
 * 
 * @example
 * ```typescript
 * if (isTokenExpiringSoon(token, 60)) {
 *   // Токен истечет в ближайшую минуту, обновляем заранее
 * }
 * ```
 */
export function isTokenExpiringSoon(token: string, seconds: number = 60): boolean {
  const payload = decodeJWT(token);
  if (!payload || !payload.exp) {
    return true;
  }

  const expirationTime = payload.exp * 1000;
  const now = Date.now();
  const threshold = seconds * 1000;

  return now >= expirationTime - threshold;
}

