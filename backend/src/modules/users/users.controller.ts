/**
 * Контроллер управления пользователями
 * 
 * Обрабатывает HTTP запросы для управления пользователями:
 * - POST /api/users - создание пользователя (только ROOT)
 * - GET /api/users - список пользователей (только ROOT)
 * - PATCH /api/users/:id - обновление пользователя (только ROOT)
 * - GET /api/users/me - данные текущего пользователя (любой авторизованный)
 * 
 * @module modules/users/users.controller
 */

import { Response, NextFunction } from 'express';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { ValidatedRequest } from '../../middleware/zodValidate';
import { AuthenticatedRequest } from '../../middleware/auth';
import { CreateUserInput, UpdateUserInput } from './user.schemas';
import { hashPassword } from '../auth/password.service';
import { prisma } from '../../config';
import logger from '../../config/logger';

/**
 * Обработчик создания пользователя
 * 
 * POST /api/users
 * 
 * Логика:
 * 1. Проверяет уникальность email
 * 2. Хеширует пароль через passwordService.hashPassword
 * 3. Создает пользователя с role: USER, isActive: true
 * 4. Возвращает данные пользователя без passwordHash и passwordVersion
 * 
 * Безопасность:
 * - Доступен только ROOT (через requireRoot)
 * - Нельзя создать ROOT через API (всегда role: USER)
 * - Проверка уникальности email
 * - Не возвращает passwordHash и passwordVersion
 * - Единый формат ошибок
 * 
 * @param req - Express Request с валидированным body (CreateUserInput)
 * @param res - Express Response
 * @param next - Express NextFunction
 */
export async function createUserHandler(
  req: ValidatedRequest<CreateUserInput>,
  res: Response,
  _next: NextFunction
): Promise<void> {
  try {
    const { email, password, name } = req.body;

    // ВАЖНО: Защита от создания ROOT через API
    // Даже если кто-то попытается передать role в body (хотя схема это не позволяет),
    // мы явно проверяем и блокируем это
    // Схема createUserSchema не включает role, но для дополнительной защиты проверяем явно
    if ('role' in req.body && (req.body as Record<string, unknown>).role === 'ROOT') {
      logger.warn('Attempt to create ROOT user through API', {
        email,
        attemptedBy: (req as AuthenticatedRequest).user?.id,
      });
      res.status(403).json({ message: 'Cannot create ROOT user through API' });
      return;
    }

    // Проверка уникальности email
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      logger.warn('Attempt to create user with existing email', { email });
      res.status(409).json({ message: 'Email already in use' });
      return;
    }

    // Хеширование пароля
    const passwordHash = await hashPassword(password);

    // Создание пользователя
    // ВАЖНО: role всегда USER, нельзя создать ROOT через API
    // Защита от множественных ROOT: даже если в body будет role: 'ROOT', мы игнорируем это
    // Примечание: Для дополнительной защиты можно рассмотреть частичный индекс на уровне БД
    // (PostgreSQL: CREATE UNIQUE INDEX ON users (role) WHERE role = 'ROOT')
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const newUser = await prisma.user.create({
      data: {
        email,
        passwordHash,
        role: 'USER', // Всегда USER, ROOT создается только из env через ensureRootUser
        isActive: true,
        name: name ?? null,
      },
      select: {
        id: true,
        email: true,
        role: true,
        name: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        // НЕ возвращаем passwordHash и passwordVersion
      },
    });

    // Логирование успешного создания (без пароля)
    logger.info('User created successfully', {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      userId: newUser.id,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      email: newUser.email,
      createdBy: (req as AuthenticatedRequest).user?.id,
    });

    // Возврат 201 Created с данными пользователя
    res.status(201).json(newUser);
  } catch (error: unknown) {
    // Обработка ошибок Prisma (например, уникальный индекс)
    if (error instanceof PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        // Unique constraint violation
        logger.warn('Attempt to create user with existing email (Prisma)', {
          email: req.body.email,
        });
        res.status(409).json({ message: 'Email already in use' });
        return;
      }
    }

    // Обработка неожиданных ошибок
    logger.error('Unexpected error during user creation', {
      error: error instanceof Error ? error.message : 'Unknown error',
      email: req.body.email,
    });

    res.status(500).json({ message: 'Internal server error' });
  }
}

/**
 * Обработчик получения списка пользователей
 * 
 * GET /api/users
 * 
 * Логика:
 * 1. Получает всех пользователей из БД
 * 2. Возвращает массив пользователей с безопасными полями
 * 
 * Безопасность:
 * - Доступен только ROOT (через requireRoot)
 * - Не возвращает passwordHash и passwordVersion
 * - В будущем можно добавить пагинацию
 * 
 * @param req - Express Request
 * @param res - Express Response
 * @param next - Express NextFunction
 */
export async function listUsersHandler(
  req: AuthenticatedRequest,
  res: Response,
  _next: NextFunction
): Promise<void> {
  try {
    // Получение всех пользователей
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        role: true,
        name: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        // НЕ возвращаем passwordHash и passwordVersion
      },
      orderBy: {
        createdAt: 'desc', // Сначала новые
      },
    });

    // Логирование успешного получения списка
    logger.debug('Users list retrieved', {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      count: users.length,
      requestedBy: req.user?.id,
    });

    // Возврат списка пользователей
    res.status(200).json(users);
  } catch (error) {
    // Обработка неожиданных ошибок
    logger.error('Unexpected error during users list retrieval', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    res.status(500).json({ message: 'Internal server error' });
  }
}

/**
 * Обработчик обновления пользователя
 * 
 * PATCH /api/users/:id
 * 
 * Логика:
 * 1. Находит пользователя по id
 * 2. Проверяет, что это не ROOT (запрещено изменять ROOT через API)
 * 3. Хеширует пароль, если он указан, и инкрементирует passwordVersion
 * 4. Обновляет email/name/isActive
 * 5. Возвращает обновленного пользователя
 * 
 * Безопасность:
 * - Доступен только ROOT (через requireRoot)
 * - Запрещено изменять ROOT через этот эндпоинт (403)
 * - При смене пароля инкрементируется passwordVersion (инвалидирует все токены)
 * - Не возвращает passwordHash и passwordVersion
 * - Проверка существования пользователя (404)
 * 
 * @param req - Express Request с валидированным body (UpdateUserInput) и параметром :id
 * @param res - Express Response
 * @param next - Express NextFunction
 */
export async function updateUserHandler(
  req: ValidatedRequest<UpdateUserInput> & AuthenticatedRequest & { params: { id: string } },
  res: Response,
  _next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const updateData = req.body;

    // Поиск пользователя по id
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const existingUser = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        role: true,
        name: true,
        isActive: true,
        passwordVersion: true,
      },
    });

    if (!existingUser) {
      logger.warn('Attempt to update non-existent user', { userId: id });
      res.status(404).json({ message: 'User not found' });
      return;
    }

    // После проверки на null TypeScript знает, что existingUser не null
    // ВАЖНО: Запрет на изменение ROOT через API
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (existingUser.role === 'ROOT') {
      logger.warn('Attempt to update ROOT user through API', {
        userId: id,
        attemptedBy: req.user?.id,
      });
      res.status(403).json({ message: 'Operation not allowed for ROOT user' });
      return;
    }

    // ВАЖНО: Защита от изменения role на ROOT
    // Даже если кто-то попытается передать role в body (хотя схема это не позволяет),
    // мы явно проверяем и блокируем это
    if ('role' in updateData && (updateData as Record<string, unknown>).role === 'ROOT') {
      logger.warn('Attempt to update user role to ROOT through API', {
        userId: id,
        attemptedBy: req.user?.id,
      });
      res.status(403).json({ message: 'Cannot set role to ROOT through API' });
      return;
    }

    // Подготовка данных для обновления
    // Тип для данных обновления пользователя (Prisma генерирует типы динамически)
    const updatePayload: Record<string, unknown> = {};

    // Обновление email (если указан)
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (updateData.email !== undefined) {
      // Проверка уникальности email (если он изменился)
      // После проверки на null TypeScript знает, что existingUser не null
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      if (updateData.email !== (existingUser as { email: string }).email) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        const emailExists = await prisma.user.findUnique({
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
          where: { email: updateData.email },
        });

        if (emailExists) {
          logger.warn('Attempt to update user with existing email', {
            userId: id,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
            email: updateData.email,
          });
          res.status(409).json({ message: 'Email already in use' });
          return;
        }
      }
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      updatePayload.email = updateData.email as string;
    }

    // Обновление пароля (если указан)
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (updateData.password !== undefined) {
      // Хеширование нового пароля
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument
      const passwordHash = await hashPassword(updateData.password);
      updatePayload.passwordHash = passwordHash;
      // Инкремент passwordVersion для инвалидации всех токенов
      updatePayload.passwordVersion = { increment: 1 };
    }

    // Обновление name (если указан)
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (updateData.name !== undefined) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      updatePayload.name = (updateData.name ?? null) as string | null;
    }

    // Обновление isActive (если указан)
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (updateData.isActive !== undefined) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      updatePayload.isActive = updateData.isActive as boolean;
    }

    // Обновление пользователя
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const updatedUser = await prisma.user.update({
      where: { id },
      data: updatePayload,
      select: {
        id: true,
        email: true,
        role: true,
        name: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        // НЕ возвращаем passwordHash и passwordVersion
      },
    });

    // Логирование успешного обновления (без пароля)
    logger.info('User updated successfully', {
      userId: id,
      updatedFields: Object.keys(updateData as Record<string, unknown>),
      updatedBy: req.user?.id,
    });

    // Возврат обновленного пользователя
    res.status(200).json(updatedUser);
  } catch (error: unknown) {
    // Обработка ошибок Prisma
    if (error instanceof PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        // Unique constraint violation
        logger.warn('Attempt to update user with existing email (Prisma)', {
          userId: req.params.id,
        });
        res.status(409).json({ message: 'Email already in use' });
        return;
      }
      if (error.code === 'P2025') {
        // Record not found
        logger.warn('Attempt to update non-existent user (Prisma)', {
          userId: req.params.id,
        });
        res.status(404).json({ message: 'User not found' });
        return;
      }
    }

    // Обработка неожиданных ошибок
    logger.error('Unexpected error during user update', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: req.params.id,
    });

    res.status(500).json({ message: 'Internal server error' });
  }
}

/**
 * Обработчик получения данных текущего пользователя
 * 
 * GET /api/users/me
 * 
 * Логика:
 * 1. Использует req.user.id для получения данных пользователя
 * 2. Возвращает данные текущего пользователя
 * 
 * Безопасность:
 * - Доступен любому авторизованному пользователю (через requireAuth)
 * - Не возвращает passwordHash и passwordVersion
 * - Удобно для фронтенда, чтобы получить данные текущего пользователя
 * 
 * @param req - Express Request с req.user (AuthenticatedRequest)
 * @param res - Express Response
 * @param next - Express NextFunction
 */
export async function getMeHandler(
  req: AuthenticatedRequest,
  res: Response,
  _next: NextFunction
): Promise<void> {
  try {
    // req.user гарантированно существует после requireAuth
    if (!req.user) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    // Подтягивание актуальных данных пользователя из БД
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        email: true,
        role: true,
        name: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        // НЕ возвращаем passwordHash и passwordVersion
      },
    });

    if (!user) {
      logger.warn('User not found in database (getMe)', { userId: req.user.id });
      res.status(404).json({ message: 'User not found' });
      return;
    }

    // Возврат данных пользователя
    res.status(200).json(user);
  } catch (error) {
    // Обработка неожиданных ошибок
    logger.error('Unexpected error during getMe', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: req.user?.id,
    });

    res.status(500).json({ message: 'Internal server error' });
  }
}

/**
 * Обработчик удаления пользователя
 * 
 * DELETE /api/users/:id
 * 
 * Логика:
 * 1. Находит пользователя по id
 * 2. Проверяет, что это не ROOT (запрещено удалять ROOT через API)
 * 3. Удаляет пользователя (каскадное удаление всех связанных данных)
 * 4. Возвращает 204 No Content
 * 
 * Безопасность:
 * - Доступен только ROOT (через requireRoot)
 * - Запрещено удалять ROOT через этот эндпоинт (403)
 * - Каскадное удаление всех связанных данных (refreshTokens, clientGroups, clients, importConfigs)
 * - Проверка существования пользователя (404)
 * 
 * @param req - Express Request с параметром :id
 * @param res - Express Response
 * @param next - Express NextFunction
 */
export async function deleteUserHandler(
  req: AuthenticatedRequest & { params: { id: string } },
  res: Response,
  _next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params;

    // Поиск пользователя по id
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const existingUser = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        role: true,
      },
    });

    if (!existingUser) {
      logger.warn('Attempt to delete non-existent user', { userId: id });
      res.status(404).json({ message: 'User not found' });
      return;
    }

    // ВАЖНО: Запрет на удаление ROOT через API (даже другим ROOT)
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (existingUser.role === 'ROOT') {
      logger.warn('Attempt to delete ROOT user through API', {
        userId: id,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        userEmail: existingUser.email,
        attemptedBy: req.user?.id,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
        attemptedByEmail: req.user?.email,
      });
      res.status(403).json({ message: 'Operation not allowed for ROOT user' });
      return;
    }

    // Дополнительная защита: ROOT не может удалить самого себя
    if (req.user?.id === id) {
      logger.warn('Attempt to delete own user account', {
        userId: id,
        attemptedBy: req.user.id,
      });
      res.status(403).json({ message: 'Cannot delete your own account' });
      return;
    }

    // Удаление пользователя (каскадное удаление всех связанных данных)
    // Prisma автоматически удаляет все связанные данные благодаря onDelete: Cascade в схеме:
    // - RefreshToken (onDelete: Cascade)
    // - ClientGroup (onDelete: Cascade) → Client (onDelete: Cascade от ClientGroup) → ClientPhone (onDelete: Cascade от Client)
    // - ImportConfig (onDelete: Cascade)
    // Все данные пользователя будут полностью удалены из БД
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    await prisma.user.delete({
      where: { id },
    });

    // Логирование успешного удаления
    logger.info('User deleted successfully', {
      userId: id,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      email: existingUser.email,
      deletedBy: req.user?.id,
    });

    // Возврат 204 No Content (успешное удаление без тела ответа)
    res.status(204).send();
  } catch (error: unknown) {
    // Обработка ошибок Prisma
    if (error instanceof PrismaClientKnownRequestError) {
      if (error.code === 'P2025') {
        // Record not found
        logger.warn('Attempt to delete non-existent user (Prisma)', {
          userId: req.params.id,
        });
        res.status(404).json({ message: 'User not found' });
        return;
      }
    }

    // Обработка неожиданных ошибок
    logger.error('Unexpected error during user deletion', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: req.params.id,
    });

    res.status(500).json({ message: 'Internal server error' });
  }
}

/**
 * Типичные ошибки безопасности при реализации контроллеров управления пользователями:
 * 
 * 1. ❌ Возможность создания ROOT через API
 *    ✅ Всегда создавать пользователей с role: USER, ROOT создается только из env
 * 
 * 2. ❌ Возможность изменения ROOT через API
 *    ✅ Запретить изменение ROOT через API (403)
 * 
 * 3. ❌ Возможность понижения ROOT до USER
 *    ✅ Запретить изменение ROOT вообще (403)
 * 
 * 4. ❌ Возможность деактивации ROOT
 *    ✅ Запретить изменение ROOT вообще (403)
 * 
 * 5. ❌ Возврат passwordHash и passwordVersion в ответах
 *    ✅ Всегда использовать select для исключения чувствительных полей
 * 
 * 6. ❌ Отсутствие проверки уникальности email
 *    ✅ Проверять уникальность email перед созданием/обновлением
 * 
 * 7. ❌ Отсутствие хеширования пароля
 *    ✅ Всегда хешировать пароль через passwordService.hashPassword
 * 
 * 8. ❌ Отсутствие инкремента passwordVersion при смене пароля
 *    ✅ Инкрементировать passwordVersion для инвалидации всех токенов
 * 
 * 9. ❌ Разные сообщения об ошибке для разных случаев
 *    ✅ Использовать единый формат ошибок
 * 
 * 10. ❌ Логирование паролей или других чувствительных данных
 *     ✅ Никогда не логировать пароли, токены или другие чувствительные данные
 * 
 * 11. ❌ Отсутствие проверки существования пользователя при обновлении
 *     ✅ Всегда проверять существование пользователя перед обновлением (404)
 * 
 * 12. ❌ Отсутствие проверки прав доступа (только ROOT)
 *     ✅ Использовать requireRoot для всех операций управления пользователями
 */

