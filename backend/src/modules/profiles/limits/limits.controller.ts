/**
 * Контроллер управления лимитами профилей
 * 
 * Обрабатывает HTTP запросы для управления лимитами профилей.
 * Доступно только для ROOT пользователя.
 * 
 * @module modules/profiles/limits/limits.controller
 */

import { Response, NextFunction } from 'express';
import { ValidatedRequest } from '../../../middleware/zodValidate';
import { AuthenticatedRequest } from '../../../middleware/auth';
import { SetProfileLimitsInput } from './limits.schemas';
import { ProfileLimitsService } from './limits.service';
import logger from '../../../config/logger';
import type { ProfilesService } from '../profiles.service';

/**
 * Обработчик получения лимитов пользователя
 * 
 * GET /api/profiles/limits/:userId
 * 
 * Логика:
 * 1. Проверяет, что пользователь - ROOT
 * 2. Возвращает лимиты указанного пользователя
 * 
 * @param req - Express Request
 * @param res - Express Response
 * @param next - Express NextFunction
 */
export async function getUserLimitsHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const currentUser = req.user;
    if (!currentUser) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    // Проверка прав доступа выполняется через requireRoot middleware

    const { userId } = req.params;
    const limitsService = req.app.get('profileLimitsService') as ProfileLimitsService;

    try {
      const limits = await limitsService.getUserLimitsForAdmin(userId);
      res.status(200).json(limits);
    } catch (error) {
      logger.error('Error in getUserLimitsHandler', { error });
      next(error);
    }
  } catch (error) {
    logger.error('Error in getUserLimitsHandler', { error });
    next(error);
  }
}

/**
 * Обработчик установки лимитов пользователя
 * 
 * PUT /api/profiles/limits/:userId
 * 
 * Логика:
 * 1. Проверяет, что пользователь - ROOT
 * 2. Устанавливает лимиты для указанного пользователя
 * 
 * @param req - Express Request с валидированным body (SetProfileLimitsInput)
 * @param res - Express Response
 * @param next - Express NextFunction
 */
export async function setUserLimitsHandler(
  req: ValidatedRequest<SetProfileLimitsInput> & AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const currentUser = req.user;
    if (!currentUser) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    // Проверка прав доступа выполняется через requireRoot middleware

    const { userId } = req.params;
    const limitsService = req.app.get('profileLimitsService') as ProfileLimitsService;

    try {
      const limits = await limitsService.setUserLimits(userId, req.body, currentUser.id);
      res.status(200).json(limits);
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('Profile limit exceeded')) {
          res.status(400).json({ message: error.message });
          return;
        }
        if (error.message.includes('must be')) {
          res.status(400).json({ message: error.message });
          return;
        }
      }
      logger.error('Error in setUserLimitsHandler', { error });
      next(error);
    }
  } catch (error) {
    logger.error('Error in setUserLimitsHandler', { error });
    next(error);
  }
}

/**
 * Обработчик получения всех лимитов
 * 
 * GET /api/profiles/limits
 * 
 * Логика:
 * 1. Проверяет, что пользователь - ROOT
 * 2. Возвращает список всех лимитов
 * 
 * @param req - Express Request
 * @param res - Express Response
 * @param next - Express NextFunction
 */
export async function getAllLimitsHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const currentUser = req.user;
    if (!currentUser) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    // Проверка прав доступа выполняется через requireRoot middleware

    const limitsService = req.app.get('profileLimitsService') as ProfileLimitsService;

    try {
      const limits = await limitsService.getAllLimits();
      res.status(200).json(limits);
    } catch (error) {
      logger.error('Error in getAllLimitsHandler', { error });
      next(error);
    }
  } catch (error) {
    logger.error('Error in getAllLimitsHandler', { error });
    next(error);
  }
}

/**
 * Обработчик получения собственных лимитов пользователя
 * 
 * GET /api/profiles/limits/me
 * 
 * Логика:
 * 1. Возвращает лимиты текущего пользователя
 * 
 * @param req - Express Request
 * @param res - Express Response
 * @param next - Express NextFunction
 */
export async function getMyLimitsHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const currentUser = req.user;
    if (!currentUser) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const profileService = req.app.get('profilesService') as ProfilesService;

    try {
      const limits = await profileService.getUserLimits(currentUser.id);
      res.status(200).json(limits);
    } catch (error) {
      logger.error('Error in getMyLimitsHandler', { error });
      next(error);
    }
  } catch (error) {
    logger.error('Error in getMyLimitsHandler', { error });
    next(error);
  }
}

