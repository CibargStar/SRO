/**
 * Утилиты для обработки ошибок API
 * 
 * Централизованная обработка ошибок API с преобразованием технических ошибок
 * в понятные сообщения для пользователя.
 */

import type { ApiError } from '@/types';

/**
 * Информация об ошибке для отображения пользователю
 */
export interface ErrorDisplayInfo {
  message: string;
  severity: 'error' | 'warning' | 'info';
}

/**
 * Обрабатывает ошибки авторизации и возвращает информацию для отображения
 * 
 * Преобразует технические ошибки API в понятные сообщения для пользователя.
 * Специальная обработка для различных HTTP статус кодов.
 * 
 * @param error - Ошибка из API (может быть ApiError или Error)
 * @returns Информация для отображения ошибки пользователю
 * 
 * @example
 * ```typescript
 * const { message, severity } = getAuthErrorInfo(loginMutation.error);
 * <Alert severity={severity}>{message}</Alert>
 * ```
 */
export function getAuthErrorInfo(error: unknown): ErrorDisplayInfo | null {
  if (!error) {
    return null;
  }

  // Приводим к типу ApiError
  const apiError = error as ApiError;
  const statusCode = apiError.statusCode;

  // Специальная обработка для 429 (Too Many Requests)
  if (statusCode === 429) {
    return {
      message: 'Слишком много попыток входа. Пожалуйста, подождите 15 минут и попробуйте снова.',
      severity: 'warning',
    };
  }

  // Специальная обработка для 401 (Unauthorized)
  // Для безопасности не раскрываем детали (неверный пароль, несуществующий пользователь и т.д.)
  if (statusCode === 401) {
    return {
      message: 'Неверный email или пароль',
      severity: 'error',
    };
  }

  // Специальная обработка для 403 (Forbidden)
  if (statusCode === 403) {
    return {
      message: 'Доступ запрещен. У вас нет прав для выполнения этого действия.',
      severity: 'error',
    };
  }

  // Специальная обработка для 500 (Internal Server Error)
  if (statusCode === 500) {
    return {
      message: 'Произошла ошибка на сервере. Пожалуйста, попробуйте позже.',
      severity: 'error',
    };
  }

  // Специальная обработка для 503 (Service Unavailable)
  if (statusCode === 503) {
    return {
      message: 'Сервис временно недоступен. Пожалуйста, попробуйте позже.',
      severity: 'warning',
    };
  }

  // Для остальных ошибок используем сообщение из API или общее сообщение
  // ВАЖНО: Не показываем технические детали пользователю для безопасности
  return {
    message: apiError.message || 'Произошла ошибка. Пожалуйста, попробуйте снова.',
    severity: 'error',
  };
}

/**
 * Обрабатывает общие ошибки API и возвращает информацию для отображения
 * 
 * Используется для ошибок, не связанных с авторизацией.
 * 
 * @param error - Ошибка из API (может быть ApiError или Error)
 * @returns Информация для отображения ошибки пользователю
 * 
 * @example
 * ```typescript
 * const { message, severity } = getApiErrorInfo(mutation.error);
 * <Alert severity={severity}>{message}</Alert>
 * ```
 */
export function getApiErrorInfo(error: unknown): ErrorDisplayInfo | null {
  if (!error) {
    return null;
  }

  // Приводим к типу ApiError
  const apiError = error as ApiError;
  const statusCode = apiError.statusCode;

  // Специальная обработка для различных статус кодов
  if (statusCode === 400) {
    return {
      message: apiError.message || 'Неверный запрос. Проверьте введенные данные.',
      severity: 'error',
    };
  }

  if (statusCode === 404) {
    return {
      message: 'Запрашиваемый ресурс не найден.',
      severity: 'error',
    };
  }

  if (statusCode === 409) {
    return {
      message: apiError.message || 'Конфликт данных. Возможно, ресурс уже существует.',
      severity: 'warning',
    };
  }

  if (statusCode === 422) {
    return {
      message: apiError.message || 'Данные не прошли валидацию. Проверьте введенные данные.',
      severity: 'error',
    };
  }

  if (statusCode === 500) {
    return {
      message: 'Произошла ошибка на сервере. Пожалуйста, попробуйте позже.',
      severity: 'error',
    };
  }

  if (statusCode === 503) {
    return {
      message: 'Сервис временно недоступен. Пожалуйста, попробуйте позже.',
      severity: 'warning',
    };
  }

  // Для остальных ошибок используем сообщение из API
  return {
    message: apiError.message || 'Произошла ошибка. Пожалуйста, попробуйте снова.',
    severity: 'error',
  };
}

