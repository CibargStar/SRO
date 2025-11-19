/**
 * Middleware для авторизации и проверки прав доступа
 * 
 * Предоставляет типобезопасные middleware для защиты маршрутов:
 * - authMiddleware: проверяет access токен и подтягивает пользователя
 * - requireAuth: проверяет наличие авторизованного пользователя
 * - requireRoot: проверяет, что пользователь имеет роль ROOT
 * 
 * @module middleware/auth
 */

import { Request, Response, NextFunction, RequestHandler } from 'express';
// Prisma генерирует типы, которые ESLint не видит, но TypeScript видит
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - TypeScript видит типы, но ESLint нет
import { UserRole } from '@prisma/client';
import { verifyAccessToken, isPasswordVersionValid } from '../modules/auth/token.service';
import { prisma } from '../config';
import logger from '../config/logger';

/**
 * Тип авторизованного пользователя
 * 
 * Содержит минимально необходимые данные о пользователе для авторизации.
 * Не включает чувствительные поля (passwordHash, isActive и т.п.).
 */
export interface AuthenticatedUser {
  id: string;
  email: string;
  role: UserRole; // 'ROOT' | 'USER'
  passwordVersion: number;
}

/**
 * Расширенный Express Request с опциональным авторизованным пользователем
 * 
 * После успешной работы authMiddleware req.user содержит данные пользователя.
 */
export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

/**
 * Middleware для проверки access токена и подтягивания пользователя
 * 
 * Логика:
 * 1. Извлекает access токен из заголовка Authorization: Bearer <token>
 * 2. Верифицирует токен через tokenService.verifyAccessToken
 * 3. Подтягивает пользователя из БД по sub (userId)
 * 4. Проверяет isActive и passwordVersion
 * 5. Устанавливает req.user с данными пользователя
 * 
 * Безопасность:
 * - При отсутствии токена или невалидном токене возвращает 401
 * - Проверяет isActive (неактивные пользователи не могут быть авторизованы)
 * - Проверяет passwordVersion (токены инвалидируются при смене пароля)
 * - Не логирует токены или пароли
 * - Единый формат ошибок: { message: "Unauthorized" }
 * 
 * @param req - Express Request (будет расширен до AuthenticatedRequest)
 * @param res - Express Response
 * @param next - Express NextFunction
 * 
 * @example
 * ```typescript
 * router.get('/protected',
 *   authMiddleware,
 *   requireAuth,
 *   protectedHandler
 * );
 * ```
 */
export const authMiddleware: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Извлечение токена из заголовка Authorization
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      logger.debug('Missing or invalid Authorization header');
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    // Извлекаем токен (убираем префикс "Bearer ")
    const token = authHeader.substring(7);

    if (!token || token.trim().length === 0) {
      logger.debug('Empty token in Authorization header');
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    // Верификация access токена
    const tokenPayload = verifyAccessToken(token);

    if (!tokenPayload) {
      logger.debug('Access token verification failed');
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    // Подтягивание пользователя из БД по userId (sub)
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const user = await prisma.user.findUnique({
      where: { id: tokenPayload.sub },
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
        passwordVersion: true,
      },
    });

    if (!user) {
      logger.warn('User not found during authentication', { userId: tokenPayload.sub });
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    // После проверки на null TypeScript знает, что user не null
    // Проверка активности пользователя
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (!user.isActive) {
      logger.warn('Inactive user attempted to access protected resource', {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        userId: user.id,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        email: user.email,
      });
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    // Проверка passwordVersion (токен мог быть инвалидирован при смене пароля)
    // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access
    if (!isPasswordVersionValid(tokenPayload, user.passwordVersion)) {
      logger.warn('Access token invalidated due to password change', {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        userId: user.id,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        email: user.email,
        tokenPasswordVersion: tokenPayload.passwordVersion,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        userPasswordVersion: user.passwordVersion,
      });
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    // Установка req.user с данными пользователя
    // Приводим req к AuthenticatedRequest для типобезопасности
    (req as AuthenticatedRequest).user = {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      id: user.id,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      email: user.email,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      role: user.role,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      passwordVersion: user.passwordVersion,
    };

    // Логирование успешной авторизации (без токена)
    logger.debug('User authenticated successfully', {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      userId: user.id,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      email: user.email,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      role: user.role,
    });

    // Передача управления следующему middleware
    next();
  } catch (error) {
    // Обработка неожиданных ошибок
    logger.error('Unexpected error during authentication', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    // Возвращаем общее сообщение об ошибке
    res.status(401).json({ message: 'Unauthorized' });
  }
}

/**
 * Middleware для проверки наличия авторизованного пользователя
 * 
 * Предполагает, что authMiddleware уже отработал.
 * Проверяет наличие req.user и возвращает 401, если пользователь не авторизован.
 * 
 * Безопасность:
 * - Всегда используется после authMiddleware
 * - Возвращает единый формат ошибки: { message: "Unauthorized" }
 * 
 * @param req - Express Request (должен быть AuthenticatedRequest после authMiddleware)
 * @param res - Express Response
 * @param next - Express NextFunction
 * 
 * @example
 * ```typescript
 * router.get('/protected',
 *   authMiddleware,
 *   requireAuth,
 *   protectedHandler
 * );
 * ```
 */
export const requireAuth: RequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const authenticatedReq = req as AuthenticatedRequest;

  if (!authenticatedReq.user) {
    logger.warn('Unauthorized access attempt (requireAuth)', {
      path: req.path,
      method: req.method,
    });
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  next();
}

/**
 * Middleware для проверки прав доступа ROOT
 * 
 * Проверяет, что авторизованный пользователь имеет роль ROOT.
 * Возвращает 403, если пользователь не ROOT.
 * 
 * Безопасность:
 * - Всегда используется после authMiddleware и requireAuth
 * - Возвращает единый формат ошибки: { message: "Forbidden" }
 * - Не раскрывает деталей, почему доступ запрещен
 * 
 * @param req - Express Request (должен быть AuthenticatedRequest после authMiddleware)
 * @param res - Express Response
 * @param next - Express NextFunction
 * 
 * @example
 * ```typescript
 * router.post('/admin/users',
 *   authMiddleware,
 *   requireAuth,
 *   requireRoot,
 *   createUserHandler
 * );
 * ```
 */
export const requireRoot: RequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const authenticatedReq = req as AuthenticatedRequest;

  if (!authenticatedReq.user) {
    logger.warn('Unauthorized access attempt (requireRoot)', {
      path: req.path,
      method: req.method,
    });
    res.status(401).json({ message: 'Unauthorized' });
    return;
  }

  if (authenticatedReq.user.role !== 'ROOT') {
    logger.warn('Forbidden access attempt (requireRoot)', {
      userId: authenticatedReq.user.id,
      email: authenticatedReq.user.email,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      role: authenticatedReq.user.role,
      path: req.path,
      method: req.method,
    });
    res.status(403).json({ message: 'Forbidden' });
    return;
  }

  next();
}

/**
 * Типичные ошибки безопасности при реализации middleware авторизации:
 * 
 * 1. ❌ Доверие только фронту (не проверять токен на бэкенде)
 *    ✅ Всегда проверять токен на бэкенде через verifyAccessToken
 * 
 * 2. ❌ Отсутствие проверки isActive
 *    ✅ Всегда проверять isActive перед установкой req.user
 * 
 * 3. ❌ Отсутствие проверки passwordVersion
 *    ✅ Проверять passwordVersion для инвалидации токенов при смене пароля
 * 
 * 4. ❌ Утечка данных токена в логи
 *    ✅ Никогда не логировать токены (даже в debug режиме)
 * 
 * 5. ❌ Разные сообщения об ошибке для разных случаев
 *    ✅ Всегда возвращать единое сообщение "Unauthorized" (401)
 * 
 * 6. ❌ Возврат чувствительных данных в req.user
 *    ✅ Включать только необходимые данные (id, email, role, passwordVersion)
 * 
 * 7. ❌ Отсутствие проверки наличия пользователя в БД
 *    ✅ Всегда подтягивать пользователя из БД и проверять его существование
 * 
 * 8. ❌ Использование данных из токена без проверки в БД
 *    ✅ Всегда проверять актуальность данных пользователя в БД
 * 
 * 9. ❌ Разные HTTP статусы для разных ошибок авторизации
 *    ✅ Использовать 401 для всех ошибок авторизации, 403 для недостатка прав
 * 
 * 10. ❌ Отсутствие проверки формата Authorization header
 *     ✅ Проверять формат "Bearer <token>" перед извлечением токена
 * 
 * 11. ❌ Логирование паролей или других чувствительных данных
 *     ✅ Логировать только факт операции, без чувствительных данных
 * 
 * 12. ❌ Отсутствие обработки неожиданных ошибок
 *     ✅ Всегда обрабатывать ошибки и возвращать безопасные ответы
 */

