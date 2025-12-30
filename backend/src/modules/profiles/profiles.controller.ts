/**
 * Контроллер управления профилями Chrome
 * 
 * Обрабатывает HTTP запросы для управления профилями:
 * - POST /api/profiles - создание профиля
 * - GET /api/profiles - список профилей пользователя
 * - GET /api/profiles/:id - получение профиля по ID
 * - PATCH /api/profiles/:id - обновление профиля
 * - DELETE /api/profiles/:id - удаление профиля
 * - GET /api/profiles/:id/status - статус профиля
 * 
 * Безопасность:
 * - Каждый пользователь видит и управляет только своими профилями
 * - Проверка прав доступа при всех операциях
 * 
 * @module modules/profiles/profiles.controller
 */

import { Response, NextFunction } from 'express';
import { ValidatedRequest, ValidatedQueryRequest } from '../../middleware/zodValidate';
import { AuthenticatedRequest } from '../../middleware/auth';
import { CreateProfileInput, UpdateProfileInput, ListProfilesQuery } from './profiles.schemas';
import { ProfilesService } from './profiles.service';
import logger from '../../config/logger';

/**
 * Обработчик создания профиля
 * 
 * POST /api/profiles
 * 
 * Логика:
 * 1. Создает профиль с userId из req.user
 * 2. Создает изолированную директорию для профиля
 * 3. Возвращает созданный профиль
 * 
 * @param req - Express Request с валидированным body (CreateProfileInput)
 * @param res - Express Response
 * @param next - Express NextFunction
 */
export async function createProfileHandler(
  req: ValidatedRequest<CreateProfileInput> & AuthenticatedRequest,
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
    const profile = await profileService.createProfile(currentUser.id, req.body);

    res.status(201).json(profile);
  } catch (error) {
    logger.error('Error in createProfileHandler', { error });
    next(error);
  }
}

/**
 * Обработчик получения списка профилей
 * 
 * GET /api/profiles
 * 
 * Логика:
 * 1. Возвращает список профилей текущего пользователя
 * 2. Поддерживает пагинацию, фильтрацию и сортировку
 * 
 * @param req - Express Request с валидированным query (ListProfilesQuery)
 * @param res - Express Response
 * @param next - Express NextFunction
 */
export async function listProfilesHandler(
  req: ValidatedQueryRequest<ListProfilesQuery> & AuthenticatedRequest,
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
    const result = await profileService.listProfiles(currentUser.id, req.validatedQuery);

    res.status(200).json(result);
  } catch (error) {
    logger.error('Error in listProfilesHandler', { error });
    next(error);
  }
}

/**
 * Обработчик получения профиля по ID
 * 
 * GET /api/profiles/:id
 * 
 * Логика:
 * 1. Проверяет права доступа (только владелец)
 * 2. Возвращает данные профиля
 * 
 * @param req - Express Request
 * @param res - Express Response
 * @param next - Express NextFunction
 */
export async function getProfileHandler(
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

    const { id } = req.params;
    const profileService = req.app.get('profilesService') as ProfilesService;

    try {
      const profile = await profileService.getProfileById(id, currentUser.id);
      if (!profile) {
        res.status(404).json({ message: 'Profile not found' });
        return;
      }

      res.status(200).json(profile);
    } catch (error) {
      if (error instanceof Error && error.message === 'Access denied') {
        res.status(403).json({ message: 'Forbidden' });
        return;
      }
      throw error;
    }
  } catch (error) {
    logger.error('Error in getProfileHandler', { error });
    next(error);
  }
}

/**
 * Обработчик обновления профиля
 * 
 * PATCH /api/profiles/:id
 * 
 * Логика:
 * 1. Проверяет права доступа (только владелец)
 * 2. Обновляет данные профиля
 * 3. Возвращает обновленный профиль
 * 
 * @param req - Express Request с валидированным body (UpdateProfileInput)
 * @param res - Express Response
 * @param next - Express NextFunction
 */
export async function updateProfileHandler(
  req: ValidatedRequest<UpdateProfileInput> & AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const currentUser = req.user;
    if (!currentUser) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const { id } = req.params;
    const profileService = req.app.get('profilesService') as ProfilesService;

    logger.info('Update profile request', { 
      profileId: id, 
      userId: currentUser.id, 
      body: req.body 
    });

    try {
      const profile = await profileService.updateProfile(id, currentUser.id, req.body);
      logger.info('Profile updated in controller', { 
        profileId: id, 
        updatedProfile: { ...profile, profilePath: '[hidden]' } 
      });
      res.status(200).json(profile);
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'Access denied') {
          res.status(403).json({ message: 'Forbidden' });
          return;
        }
        if (error.message === 'Profile not found') {
          res.status(404).json({ message: 'Profile not found' });
          return;
        }
      }
      throw error;
    }
  } catch (error) {
    logger.error('Error in updateProfileHandler', { error });
    next(error);
  }
}

/**
 * Обработчик удаления профиля
 * 
 * DELETE /api/profiles/:id
 * 
 * Логика:
 * 1. Проверяет права доступа (только владелец)
 * 2. Удаляет профиль (в будущем также остановит Chrome и очистит директорию)
 * 
 * @param req - Express Request
 * @param res - Express Response
 * @param next - Express NextFunction
 */
export async function deleteProfileHandler(
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

    const { id } = req.params;
    const profileService = req.app.get('profilesService') as ProfilesService;

    try {
      await profileService.deleteProfile(id, currentUser.id);
      res.status(204).send();
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'Access denied') {
          res.status(403).json({ message: 'Forbidden' });
          return;
        }
        if (error.message === 'Profile not found') {
          res.status(404).json({ message: 'Profile not found' });
          return;
        }
      }
      throw error;
    }
  } catch (error) {
    logger.error('Error in deleteProfileHandler', { error });
    next(error);
  }
}

/**
 * Обработчик получения статуса профиля
 * 
 * GET /api/profiles/:id/status
 * 
 * Логика:
 * 1. Проверяет права доступа (только владелец)
 * 2. Возвращает статус профиля
 * 
 * @param req - Express Request
 * @param res - Express Response
 * @param next - Express NextFunction
 */
export async function getProfileStatusHandler(
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

    const { id } = req.params;
    const profileService = req.app.get('profilesService') as ProfilesService;

    try {
      const status = await profileService.getProfileStatus(id, currentUser.id);
      res.status(200).json(status);
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'Access denied') {
          res.status(403).json({ message: 'Forbidden' });
          return;
        }
        if (error.message === 'Profile not found') {
          res.status(404).json({ message: 'Profile not found' });
          return;
        }
      }
      throw error;
    }
  } catch (error) {
    logger.error('Error in getProfileStatusHandler', { error });
    next(error);
  }
}

/**
 * Обработчик запуска профиля
 * 
 * POST /api/profiles/:id/start
 * 
 * Логика:
 * 1. Проверяет права доступа (только владелец)
 * 2. Запускает Chrome для профиля
 * 3. Обновляет статус профиля
 * 
 * @param req - Express Request
 * @param res - Express Response
 * @param next - Express NextFunction
 */
export async function startProfileHandler(
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

    const { id } = req.params;
    const profileService = req.app.get('profilesService') as ProfilesService;

    // Опции запуска из body (опционально)
    const options = req.body || {};

    try {
      const result = await profileService.startProfile(id, currentUser.id, options);
      res.status(200).json(result);
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'Access denied') {
          res.status(403).json({ message: 'Forbidden' });
          return;
        }
        if (error.message === 'Profile not found') {
          res.status(404).json({ message: 'Profile not found' });
          return;
        }
      }
      throw error;
    }
  } catch (error) {
    logger.error('Error in startProfileHandler', { error });
    next(error);
  }
}

/**
 * Обработчик остановки профиля
 * 
 * POST /api/profiles/:id/stop
 * 
 * Логика:
 * 1. Проверяет права доступа (только владелец)
 * 2. Останавливает Chrome для профиля
 * 3. Обновляет статус профиля
 * 
 * @param req - Express Request
 * @param res - Express Response
 * @param next - Express NextFunction
 */
export async function stopProfileHandler(
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

    const { id } = req.params;
    const profileService = req.app.get('profilesService') as ProfilesService;

    // Опция force из query параметров
    const force = req.query.force === 'true';

    try {
      await profileService.stopProfile(id, currentUser.id, force);
      res.status(200).json({ message: 'Profile stopped successfully' });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'Access denied') {
          res.status(403).json({ message: 'Forbidden' });
          return;
        }
        if (error.message === 'Profile not found') {
          res.status(404).json({ message: 'Profile not found' });
          return;
        }
      }
      throw error;
    }
  } catch (error) {
    logger.error('Error in stopProfileHandler', { error });
    next(error);
  }
}

/**
 * Обработчик получения статистики ресурсов профиля
 * 
 * GET /api/profiles/:id/resources
 * 
 * Логика:
 * 1. Проверяет права доступа (только владелец)
 * 2. Возвращает статистику использования ресурсов Chrome процесса
 * 
 * @param req - Express Request
 * @param res - Express Response
 * @param next - Express NextFunction
 */
export async function getProfileResourcesHandler(
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

    const { id } = req.params;
    const profileService = req.app.get('profilesService') as ProfilesService;

    try {
      const stats = await profileService.getProfileResourceStats(id, currentUser.id);
      if (!stats) {
        res.status(404).json({ message: 'Profile is not running or not found' });
        return;
      }

      res.status(200).json(stats);
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'Access denied') {
          res.status(403).json({ message: 'Forbidden' });
          return;
        }
        if (error.message === 'Profile not found') {
          res.status(404).json({ message: 'Profile not found' });
          return;
        }
      }
      throw error;
    }
  } catch (error) {
    logger.error('Error in getProfileResourcesHandler', { error });
    next(error);
  }
}

/**
 * Обработчик получения истории статистики ресурсов профиля
 * 
 * GET /api/profiles/:id/resources/history
 * 
 * Логика:
 * 1. Проверяет права доступа (только владелец)
 * 2. Возвращает историю статистики использования ресурсов
 * 
 * @param req - Express Request
 * @param res - Express Response
 * @param next - Express NextFunction
 */
export async function getProfileResourcesHistoryHandler(
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

    const { id } = req.params;
    const profileService = req.app.get('profilesService') as ProfilesService;

    // Параметры запроса
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 100;
    const from = req.query.from ? new Date(req.query.from as string) : undefined;
    const to = req.query.to ? new Date(req.query.to as string) : undefined;

    try {
      const history = await profileService.getProfileResourceStatsHistory(
        id,
        currentUser.id,
        limit,
        from,
        to
      );

      res.status(200).json({
        profileId: id,
        history,
        count: history.length,
      });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'Access denied') {
          res.status(403).json({ message: 'Forbidden' });
          return;
        }
        if (error.message === 'Profile not found') {
          res.status(404).json({ message: 'Profile not found' });
          return;
        }
      }
      throw error;
    }
  } catch (error) {
    logger.error('Error in getProfileResourcesHistoryHandler', { error });
    next(error);
  }
}

/**
 * Обработчик проверки здоровья профиля
 * 
 * GET /api/profiles/:id/health
 * 
 * Логика:
 * 1. Проверяет права доступа (только владелец)
 * 2. Возвращает результат проверки здоровья профиля
 * 
 * @param req - Express Request
 * @param res - Express Response
 * @param next - Express NextFunction
 */
export async function checkProfileHealthHandler(
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

    const { id } = req.params;
    const profileService = req.app.get('profilesService') as ProfilesService;

    try {
      const healthCheck = await profileService.checkProfileHealth(id, currentUser.id);
      res.status(200).json(healthCheck);
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'Access denied') {
          res.status(403).json({ message: 'Forbidden' });
          return;
        }
        if (error.message === 'Profile not found') {
          res.status(404).json({ message: 'Profile not found' });
          return;
        }
      }
      throw error;
    }
  } catch (error) {
    logger.error('Error in checkProfileHealthHandler', { error });
    next(error);
  }
}

/**
 * Обработчик получения статистики сетевой активности профиля
 * 
 * GET /api/profiles/:id/network
 * 
 * Логика:
 * 1. Проверяет права доступа (только владелец)
 * 2. Возвращает статистику сетевой активности
 * 
 * @param req - Express Request
 * @param res - Express Response
 * @param next - Express NextFunction
 */
export async function getProfileNetworkStatsHandler(
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

    const { id } = req.params;
    const profileService = req.app.get('profilesService') as ProfilesService;

    try {
      const stats = await profileService.getProfileNetworkStats(id, currentUser.id);
      if (!stats) {
        res.status(404).json({ message: 'Profile is not running or not found' });
        return;
      }

      res.status(200).json(stats);
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'Access denied') {
          res.status(403).json({ message: 'Forbidden' });
          return;
        }
        if (error.message === 'Profile not found') {
          res.status(404).json({ message: 'Profile not found' });
          return;
        }
      }
      throw error;
    }
  } catch (error) {
    logger.error('Error in getProfileNetworkStatsHandler', { error });
    next(error);
  }
}

/**
 * Обработчик получения алертов профиля
 * 
 * GET /api/profiles/:id/alerts
 * 
 * Логика:
 * 1. Проверяет права доступа (только владелец)
 * 2. Возвращает список алертов профиля
 * 
 * @param req - Express Request
 * @param res - Express Response
 * @param next - Express NextFunction
 */
export async function getProfileAlertsHandler(
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

    const { id } = req.params;
    const profileService = req.app.get('profilesService') as ProfilesService;

    // Параметры запроса
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 100;
    const unreadOnly = req.query.unreadOnly === 'true';
    const from = req.query.from ? new Date(req.query.from as string) : undefined;
    const to = req.query.to ? new Date(req.query.to as string) : undefined;

    try {
      const alerts = await profileService.getProfileAlerts(
        id,
        currentUser.id,
        limit,
        unreadOnly,
        from,
        to
      );

      res.status(200).json({
        profileId: id,
        alerts,
        count: alerts.length,
      });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'Access denied') {
          res.status(403).json({ message: 'Forbidden' });
          return;
        }
        if (error.message === 'Profile not found') {
          res.status(404).json({ message: 'Profile not found' });
          return;
        }
      }
      throw error;
    }
  } catch (error) {
    logger.error('Error in getProfileAlertsHandler', { error });
    next(error);
  }
}

/**
 * Обработчик получения количества непрочитанных алертов
 * 
 * GET /api/profiles/:id/alerts/unread-count
 * 
 * @param req - Express Request
 * @param res - Express Response
 * @param next - Express NextFunction
 */
export async function getProfileUnreadAlertsCountHandler(
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

    const { id } = req.params;
    const profileService = req.app.get('profilesService') as ProfilesService;

    try {
      const count = await profileService.getProfileUnreadAlertsCount(id, currentUser.id);

      res.status(200).json({
        profileId: id,
        unreadCount: count,
      });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'Access denied') {
          res.status(403).json({ message: 'Forbidden' });
          return;
        }
        if (error.message === 'Profile not found') {
          res.status(404).json({ message: 'Profile not found' });
          return;
        }
      }
      throw error;
    }
  } catch (error) {
    logger.error('Error in getProfileUnreadAlertsCountHandler', { error });
    next(error);
  }
}

/**
 * Обработчик отметки алерта как прочитанного
 * 
 * POST /api/profiles/:id/alerts/:alertId/read
 * 
 * @param req - Express Request
 * @param res - Express Response
 * @param next - Express NextFunction
 */
export async function markAlertAsReadHandler(
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

    const { id, alertId } = req.params;
    const profileService = req.app.get('profilesService') as ProfilesService;

    try {
      const success = await profileService.markAlertAsRead(id, currentUser.id, alertId);

      if (!success) {
        res.status(404).json({ message: 'Alert not found' });
        return;
      }

      res.status(200).json({ message: 'Alert marked as read' });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'Access denied') {
          res.status(403).json({ message: 'Forbidden' });
          return;
        }
        if (error.message === 'Profile not found') {
          res.status(404).json({ message: 'Profile not found' });
          return;
        }
      }
      throw error;
    }
  } catch (error) {
    logger.error('Error in markAlertAsReadHandler', { error });
    next(error);
  }
}

/**
 * Обработчик отметки всех алертов как прочитанных
 * 
 * POST /api/profiles/:id/alerts/read-all
 * 
 * @param req - Express Request
 * @param res - Express Response
 * @param next - Express NextFunction
 */
export async function markAllAlertsAsReadHandler(
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

    const { id } = req.params;
    const profileService = req.app.get('profilesService') as ProfilesService;

    try {
      const count = await profileService.markAllAlertsAsRead(id, currentUser.id);

      res.status(200).json({
        message: 'All alerts marked as read',
        markedCount: count,
      });
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'Access denied') {
          res.status(403).json({ message: 'Forbidden' });
          return;
        }
        if (error.message === 'Profile not found') {
          res.status(404).json({ message: 'Profile not found' });
          return;
        }
      }
      throw error;
    }
  } catch (error) {
    logger.error('Error in markAllAlertsAsReadHandler', { error });
    next(error);
  }
}

/**
 * Обработчик получения аналитики профиля
 * 
 * GET /api/profiles/:id/analytics
 * 
 * Логика:
 * 1. Проверяет права доступа (только владелец)
 * 2. Возвращает агрегированную аналитику профиля
 * 
 * @param req - Express Request
 * @param res - Express Response
 * @param next - Express NextFunction
 */
export async function getProfileAnalyticsHandler(
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

    const { id } = req.params;
    const profileService = req.app.get('profilesService') as ProfilesService;

    // Параметры запроса
    const period = (req.query.period as 'hour' | 'day' | 'week' | 'month') || 'day';
    const from = req.query.from ? new Date(req.query.from as string) : undefined;
    const to = req.query.to ? new Date(req.query.to as string) : undefined;

    try {
      const analytics = await profileService.getProfileAnalytics(
        id,
        currentUser.id,
        period,
        from,
        to
      );

      res.status(200).json(analytics);
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'Access denied') {
          res.status(403).json({ message: 'Forbidden' });
          return;
        }
        if (error.message === 'Profile not found') {
          res.status(404).json({ message: 'Profile not found' });
          return;
        }
      }
      throw error;
    }
  } catch (error) {
    logger.error('Error in getProfileAnalyticsHandler', { error });
    next(error);
  }
}

