/**
 * Контроллер управления аккаунтами мессенджеров
 * 
 * Обрабатывает HTTP запросы для управления аккаунтами мессенджеров:
 * - CRUD операции с аккаунтами
 * - Управление включением/выключением мессенджеров
 * - Управление конфигурацией проверок (ROOT only)
 * 
 * Безопасность:
 * - Каждый пользователь видит и управляет только аккаунтами своих профилей
 * - Проверка прав доступа при всех операциях
 * 
 * @module modules/profiles/messenger-accounts/messenger-accounts.controller
 */

import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../../../middleware/auth';
import { ValidatedRequest } from '../../../middleware/zodValidate';
import { MessengerAccountsService } from './messenger-accounts.service';
import {
  CreateMessengerAccountInput,
  UpdateMessengerAccountInput,
  UpdateMessengerCheckConfigInput,
} from './messenger-accounts.schemas';
import logger from '../../../config/logger';

/**
 * Обработчик получения всех мессенджеров (справочник)
 * 
 * GET /api/messenger-services
 */
export async function getAllServicesHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const messengerAccountsService = req.app.get(
      'messengerAccountsService'
    ) as MessengerAccountsService;

    const services = await messengerAccountsService.getAllServices();

    res.status(200).json(services);
  } catch (error) {
    logger.error('Error in getAllServicesHandler', { error });
    next(error);
  }
}

/**
 * Обработчик получения мессенджера по ID
 * 
 * GET /api/messenger-services/:id
 */
export async function getServiceByIdHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    const messengerAccountsService = req.app.get(
      'messengerAccountsService'
    ) as MessengerAccountsService;

    try {
      const service = await messengerAccountsService.getServiceById(id);

      if (!service) {
        res.status(404).json({ message: 'Service not found' });
        return;
      }

      res.status(200).json(service);
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({ message: error.message });
        return;
      }
      throw error;
    }
  } catch (error) {
    logger.error('Error in getServiceByIdHandler', { error });
    next(error);
  }
}

/**
 * Обработчик получения всех аккаунтов мессенджеров профиля
 * 
 * GET /api/profiles/:profileId/messenger-accounts
 */
export async function getAccountsByProfileHandler(
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

    const { profileId } = req.params;
    const messengerAccountsService = req.app.get(
      'messengerAccountsService'
    ) as MessengerAccountsService;

    try {
      const accounts = await messengerAccountsService.getAccountsByProfileId(
        profileId,
        currentUser.id
      );

      res.status(200).json(accounts);
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
    logger.error('Error in getAccountsByProfileHandler', { error });
    next(error);
  }
}

/**
 * Обработчик получения аккаунта мессенджера по ID
 * 
 * GET /api/profiles/:profileId/messenger-accounts/:accountId
 */
export async function getAccountByIdHandler(
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

    const { accountId } = req.params;
    const messengerAccountsService = req.app.get(
      'messengerAccountsService'
    ) as MessengerAccountsService;

    try {
      const account = await messengerAccountsService.getAccountById(
        accountId,
        currentUser.id
      );

      if (!account) {
        res.status(404).json({ message: 'Account not found' });
        return;
      }

      res.status(200).json(account);
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'Access denied') {
          res.status(403).json({ message: 'Forbidden' });
          return;
        }
        if (error.message === 'Account not found') {
          res.status(404).json({ message: 'Account not found' });
          return;
        }
      }
      throw error;
    }
  } catch (error) {
    logger.error('Error in getAccountByIdHandler', { error });
    next(error);
  }
}

/**
 * Обработчик создания аккаунта мессенджера для профиля
 * 
 * POST /api/profiles/:profileId/messenger-accounts
 */
export async function createAccountHandler(
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

    const { profileId } = req.params;
    const messengerAccountsService = req.app.get(
      'messengerAccountsService'
    ) as MessengerAccountsService;

    try {
      const account = await messengerAccountsService.createAccount(
        profileId,
        currentUser.id,
        req.body as CreateMessengerAccountInput
      );

      res.status(201).json(account);
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
        if (error.message.includes('already exists')) {
          res.status(409).json({ message: error.message });
          return;
        }
      }
      throw error;
    }
  } catch (error) {
    logger.error('Error in createAccountHandler', { error });
    next(error);
  }
}

/**
 * Обработчик обновления аккаунта мессенджера
 * 
 * PATCH /api/profiles/:profileId/messenger-accounts/:accountId
 */
export async function updateAccountHandler(
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

    const { accountId } = req.params;
    const messengerAccountsService = req.app.get(
      'messengerAccountsService'
    ) as MessengerAccountsService;

    try {
      const account = await messengerAccountsService.updateAccount(
        accountId,
        currentUser.id,
        req.body as UpdateMessengerAccountInput
      );

      res.status(200).json(account);
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'Access denied') {
          res.status(403).json({ message: 'Forbidden' });
          return;
        }
        if (error.message === 'Account not found') {
          res.status(404).json({ message: 'Account not found' });
          return;
        }
      }
      throw error;
    }
  } catch (error) {
    logger.error('Error in updateAccountHandler', { error });
    next(error);
  }
}

/**
 * Обработчик удаления аккаунта мессенджера
 * 
 * DELETE /api/profiles/:profileId/messenger-accounts/:accountId
 */
export async function deleteAccountHandler(
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

    const { accountId } = req.params;
    const messengerAccountsService = req.app.get(
      'messengerAccountsService'
    ) as MessengerAccountsService;

    try {
      await messengerAccountsService.deleteAccount(accountId, currentUser.id);

      res.status(204).send();
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'Access denied') {
          res.status(403).json({ message: 'Forbidden' });
          return;
        }
        if (error.message === 'Account not found') {
          res.status(404).json({ message: 'Account not found' });
          return;
        }
      }
      throw error;
    }
  } catch (error) {
    logger.error('Error in deleteAccountHandler', { error });
    next(error);
  }
}

/**
 * Обработчик включения мессенджера для профиля
 * 
 * POST /api/profiles/:profileId/messenger-accounts/:accountId/enable
 */
export async function enableAccountHandler(
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

    const { accountId } = req.params;
    const messengerAccountsService = req.app.get(
      'messengerAccountsService'
    ) as MessengerAccountsService;

    try {
      const account = await messengerAccountsService.enableAccount(
        accountId,
        currentUser.id
      );

      res.status(200).json(account);
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'Access denied') {
          res.status(403).json({ message: 'Forbidden' });
          return;
        }
        if (error.message === 'Account not found') {
          res.status(404).json({ message: 'Account not found' });
          return;
        }
      }
      throw error;
    }
  } catch (error) {
    logger.error('Error in enableAccountHandler', { error });
    next(error);
  }
}

/**
 * Обработчик выключения мессенджера для профиля
 * 
 * POST /api/profiles/:profileId/messenger-accounts/:accountId/disable
 */
export async function disableAccountHandler(
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

    const { accountId } = req.params;
    const messengerAccountsService = req.app.get(
      'messengerAccountsService'
    ) as MessengerAccountsService;

    try {
      const account = await messengerAccountsService.disableAccount(
        accountId,
        currentUser.id
      );

      res.status(200).json(account);
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'Access denied') {
          res.status(403).json({ message: 'Forbidden' });
          return;
        }
        if (error.message === 'Account not found') {
          res.status(404).json({ message: 'Account not found' });
          return;
        }
      }
      throw error;
    }
  } catch (error) {
    logger.error('Error in disableAccountHandler', { error });
    next(error);
  }
}

/**
 * Обработчик проверки статуса входа аккаунта
 * 
 * POST /api/profiles/:profileId/messenger-accounts/:accountId/check
 */
export async function checkAccountStatusHandler(
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

    const { accountId } = req.params;
    const messengerAccountsService = req.app.get(
      'messengerAccountsService'
    ) as MessengerAccountsService;

    try {
      const result = await messengerAccountsService.checkAccountStatus(
        accountId,
        currentUser.id
      );

      res.status(200).json(result);
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'Access denied') {
          res.status(403).json({ message: 'Forbidden' });
          return;
        }
        if (error.message === 'Account not found' || error.message === 'Profile not found') {
          res.status(404).json({ message: error.message });
          return;
        }
        if (error.message.includes('not running') || error.message.includes('not initialized')) {
          res.status(400).json({ message: error.message });
          return;
        }
      }
      throw error;
    }
  } catch (error) {
    logger.error('Error in checkAccountStatusHandler', { error });
    next(error);
  }
}

/**
 * Обработчик ввода облачного пароля (2FA) для Telegram
 * 
 * POST /api/profiles/:profileId/messenger-accounts/:accountId/cloud-password
 */
export async function submitCloudPasswordHandler(
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

    const { accountId, profileId } = req.params;
    const { password } = req.body as { password: string };

    if (!password || typeof password !== 'string') {
      res.status(400).json({ message: 'Password is required' });
      return;
    }

    const messengerAccountsService = req.app.get(
      'messengerAccountsService'
    ) as MessengerAccountsService;

    try {
      const result = await messengerAccountsService.submitCloudPassword(
        profileId,
        accountId,
        password,
        currentUser.id
      );

      res.status(200).json(result);
    } catch (error) {
      if (error instanceof Error) {
        if (error.message === 'Access denied') {
          res.status(403).json({ message: 'Forbidden' });
          return;
        }
        if (error.message === 'Account not found' || error.message === 'Profile not found') {
          res.status(404).json({ message: error.message });
          return;
        }
        if (error.message.includes('not running') || error.message.includes('not supported')) {
          res.status(400).json({ message: error.message });
          return;
        }
      }
      throw error;
    }
  } catch (error) {
    logger.error('Error in submitCloudPasswordHandler', { error });
    next(error);
  }
}

/**
 * Обработчик получения всех конфигураций проверки (ROOT only)
 * 
 * GET /api/messenger-check-configs
 */
export async function getAllCheckConfigsHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const messengerAccountsService = req.app.get(
      'messengerAccountsService'
    ) as MessengerAccountsService;

    const configs = await messengerAccountsService.getAllCheckConfigs();

    res.status(200).json(configs);
  } catch (error) {
    logger.error('Error in getAllCheckConfigsHandler', { error });
    next(error);
  }
}

/**
 * Обработчик получения конфигурации проверки по serviceId (ROOT only)
 * 
 * GET /api/messenger-check-configs/:serviceId
 */
export async function getCheckConfigByServiceIdHandler(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { serviceId } = req.params;
    const messengerAccountsService = req.app.get(
      'messengerAccountsService'
    ) as MessengerAccountsService;

    try {
      const config = await messengerAccountsService.getCheckConfig(serviceId);

      if (!config) {
        res.status(404).json({ message: 'Check config not found for this service' });
        return;
      }

      res.status(200).json(config);
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({ message: error.message });
        return;
      }
      throw error;
    }
  } catch (error) {
    logger.error('Error in getCheckConfigByServiceIdHandler', { error });
    next(error);
  }
}

/**
 * Обработчик получения количества аккаунтов мессенджеров для списка профилей
 * 
 * POST /api/messenger-accounts/counts
 */
export async function getAccountsCountsHandler(
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

    const { profileIds } = req.body as { profileIds: string[] };

    if (!Array.isArray(profileIds)) {
      res.status(400).json({ message: 'profileIds must be an array' });
      return;
    }

    if (profileIds.length === 0) {
      res.status(200).json({});
      return;
    }

    const messengerAccountsService = req.app.get(
      'messengerAccountsService'
    ) as MessengerAccountsService;

    const counts = await messengerAccountsService.getAccountsCountByProfileIds(profileIds);

    res.status(200).json(counts);
  } catch (error) {
    logger.error('Error in getAccountsCountsHandler', { error });
    next(error);
  }
}

/**
 * Обработчик обновления конфигурации проверки (ROOT only)
 * 
 * PUT /api/messenger-check-configs/:serviceId
 */
export async function updateCheckConfigHandler(
  req: ValidatedRequest<UpdateMessengerCheckConfigInput> & AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const currentUser = req.user;
    if (!currentUser) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const { serviceId } = req.params;
    // req.body уже валидирован через Zod schema в middleware validateBody
    const validatedBody = req.body as UpdateMessengerCheckConfigInput;
    const { checkIntervalSeconds, enabled } = validatedBody;

    const messengerAccountsService = req.app.get(
      'messengerAccountsService'
    ) as MessengerAccountsService;

    try {
      const config = await messengerAccountsService.updateCheckConfig(
        serviceId,
        checkIntervalSeconds,
        enabled ?? true,
        currentUser.id
      );

      res.status(200).json(config);
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({ message: error.message });
        return;
      }
      throw error;
    }
  } catch (error) {
    logger.error('Error in updateCheckConfigHandler', { error });
    next(error);
  }
}
