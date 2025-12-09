/**
 * Глобальный обработчик ошибок
 * 
 * Обрабатывает все ошибки приложения, включая ошибки валидации Zod.
 * Логирует ошибки и возвращает соответствующие HTTP статусы.
 */

import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import logger from '../config/logger';

/**
 * Расширенный интерфейс Error с опциональным statusCode
 * Позволяет устанавливать HTTP статус код для ошибок
 */
export interface AppError extends Error {
  statusCode?: number;
  code?: string;
}

/**
 * Глобальный обработчик ошибок Express
 * 
 * Обрабатывает два типа ошибок:
 * 1. ZodError - ошибки валидации (400 Bad Request)
 * 2. AppError - пользовательские ошибки с statusCode
 * 3. Остальные ошибки - 500 Internal Server Error
 * 
 * В development режиме возвращает стек ошибки для отладки.
 * 
 * @param err - Ошибка для обработки
 * @param _req - Express Request (не используется)
 * @param res - Express Response
 * @param _next - Express NextFunction (не используется)
 */
export const errorHandler = (
  err: AppError | ZodError,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  // Обработка ошибок валидации Zod
  if (err instanceof ZodError) {
    logger.warn('Validation error', {
      errorCount: err.errors.length,
      errors: err.errors.map((e) => ({
        path: e.path.join('.'),
        message: e.message,
      })),
    });
    res.status(400).json({
      error: 'Validation error',
      details: err.errors.map((e) => ({
        field: e.path.join('.') || 'root',
        message: e.message,
      })),
    });
    return;
  }

  // Обработка остальных ошибок
  const statusCode = err.statusCode ?? 500;
  const message = err.message ?? 'Internal server error';
  const errorCode = (err as any).code;

  // Логирование ошибки с полным стеком
  logger.error({
    error: message,
    code: errorCode,
    stack: err.stack,
    statusCode,
  });

  // Возврат ошибки клиенту
  res.status(statusCode).json({
    error: message,
    ...(errorCode ? { code: errorCode } : {}),
    // В development режиме возвращаем стек для отладки
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

