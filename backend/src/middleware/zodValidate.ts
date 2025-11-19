/**
 * Middleware для валидации тела запроса с использованием Zod
 * 
 * Валидирует req.body по переданной Zod схеме и возвращает типобезопасные данные.
 * При ошибке валидации возвращает 400 с аккуратным JSON без логирования паролей.
 * 
 * @module middleware/zodValidate
 */

import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import logger from '../config/logger';

/**
 * Расширенный Express Request с типобезопасным body
 * 
 * После успешной валидации req.body содержит данные, соответствующие схеме.
 */
export interface ValidatedRequest<T> extends Request {
  body: T;
}

/**
 * Создает middleware для валидации тела запроса по Zod схеме
 * 
 * @template T - Тип данных, который должна валидировать схема
 * @param schema - Zod схема для валидации req.body
 * @returns Express middleware функция
 * 
 * @example
 * ```typescript
 * import { loginSchema } from '../modules/auth/auth.schemas';
 * import { validateBody } from '../middleware/zodValidate';
 * 
 * router.post('/auth/login',
 *   validateBody(loginSchema),
 *   loginHandler
 * );
 * ```
 * 
 * В контроллере:
 * ```typescript
 * const handler = (req: ValidatedRequest<LoginInput>, res: Response) => {
 *   // req.body.email и req.body.password типобезопасны
 *   const { email, password } = req.body;
 * };
 * ```
 * 
 * Безопасность:
 * - Не логирует пароли или другие чувствительные данные
 * - Возвращает аккуратные сообщения об ошибках
 * - Типобезопасность через TypeScript generics
 * - Валидация происходит до обработки запроса
 */
export function validateBody<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      // Валидация req.body по схеме
      // parse выбрасывает ZodError при ошибке валидации
      const validatedData = schema.parse(req.body);

      // Заменяем req.body на валидированные данные
      // Это обеспечивает типобезопасность в контроллерах
      req.body = validatedData as Request['body'];

      // Валидация прошла успешно
      next();
    } catch (error) {
      // Обработка ошибок валидации Zod
      if (error instanceof ZodError) {
        // Форматируем ошибки для клиента
        const errors = error.errors.map((err) => ({
          field: err.path.join('.') || 'root', // Путь к полю (например, "email" или "password")
          message: err.message, // Сообщение об ошибке
        }));

        // ВАЖНО: Не логируем req.body при ошибке валидации!
        // Пароли и другие чувствительные данные могут быть в req.body
        logger.warn('Request body validation failed', {
          path: req.path,
          method: req.method,
          errorCount: errors.length,
          // НЕ логируем req.body!
        });

        // Возвращаем 400 с аккуратным JSON
        res.status(400).json({
          error: 'Validation error',
          details: errors,
        });
        return;
      }

      // Неожиданная ошибка (не ZodError)
      logger.error('Unexpected error during body validation', {
        error: error instanceof Error ? error.message : 'Unknown error',
        path: req.path,
        method: req.method,
      });

      // Возвращаем общую ошибку
      res.status(500).json({
        error: 'Internal server error during validation',
      });
    }
  };
}

/**
 * Типичные ошибки безопасности при валидации входных данных:
 * 
 * 1. ❌ Логирование паролей при ошибках валидации
 *    ✅ Никогда не логировать req.body при ошибке валидации
 * 
 * 2. ❌ Возврат полного req.body в ответе об ошибке
 *    ✅ Возвращать только сообщения об ошибках, без значений полей
 * 
 * 3. ❌ Отсутствие валидации входных данных
 *    ✅ Всегда валидировать входные данные перед обработкой
 * 
 * 4. ❌ Пропуск невалидных полей (stripUnknown: false)
 *    ✅ Использовать strict() или strip() для контроля невалидных полей
 * 
 * 5. ❌ Разные сообщения об ошибках для разных полей
 *    ✅ Использовать единый формат ошибок для всех полей
 * 
 * 6. ❌ Отсутствие нормализации данных (trim, toLowerCase)
 *    ✅ Нормализовать данные в схеме (email, строки)
 * 
 * 7. ❌ Слишком мягкая валидация паролей
 *    ✅ Использовать строгие требования (длина, сложность)
 * 
 * 8. ❌ Валидация после обработки запроса
 *    ✅ Валидация должна быть первым middleware после парсинга body
 * 
 * 9. ❌ Отсутствие типобезопасности
 *    ✅ Использовать TypeScript generics для типобезопасности
 * 
 * 10. ❌ Логирование чувствительных данных в debug режиме
 *     ✅ Даже в debug режиме не логировать пароли
 * 
 * 11. ❌ Возврат stack trace в production
 *     ✅ Возвращать только сообщения об ошибках, без деталей реализации
 * 
 * 12. ❌ Отсутствие проверки на пустой объект при обновлении
 *     ✅ Проверять, что хотя бы одно поле предоставлено для обновления
 */

