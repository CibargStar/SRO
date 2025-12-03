/**
 * Middleware для логирования HTTP запросов
 * 
 * Логирует все входящие запросы с информацией о:
 * - HTTP методе (GET, POST, etc.)
 * - URL запроса
 * - HTTP статусе ответа
 * - Времени выполнения запроса
 * - IP адресе клиента
 */

import { Request, Response, NextFunction } from 'express';
import logger from '../config/logger';

/**
 * Middleware для логирования запросов
 * 
 * Записывает информацию о каждом HTTP запросе после его завершения.
 * Использует событие 'finish' для получения финального статуса ответа.
 * 
 * @param req - Express Request объект
 * @param res - Express Response объект
 * @param next - Express NextFunction для передачи управления следующему middleware
 */
export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  const start = Date.now();

  // Логируем после завершения ответа, чтобы получить финальный статус
  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info('HTTP request', {
      method: req.method,
      url: req.url,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
    });
  });

  next();
};

