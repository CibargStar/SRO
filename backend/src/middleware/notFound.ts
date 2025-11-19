/**
 * Middleware для обработки 404 ошибок
 * 
 * Обрабатывает запросы к несуществующим маршрутам.
 * Должен быть установлен после всех маршрутов, но перед errorHandler.
 */

import { Request, Response } from 'express';

/**
 * Обработчик для несуществующих маршрутов
 * 
 * Возвращает 404 статус для всех запросов, которые не соответствуют
 * ни одному определенному маршруту.
 * 
 * @param _req - Express Request (не используется)
 * @param res - Express Response
 */
export const notFoundHandler = (_req: Request, res: Response): void => {
  res.status(404).json({ error: 'Route not found' });
};

