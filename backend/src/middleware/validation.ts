/**
 * Middleware для валидации запросов с express-validator
 * 
 * Применяет цепочку валидаций к запросу и возвращает ошибки,
 * если валидация не прошла.
 */

import { Request, Response, NextFunction } from 'express';
import { validationResult, ValidationChain } from 'express-validator';

/**
 * Создает middleware для валидации запросов
 * 
 * Применяет все валидации параллельно и проверяет результат.
 * Если есть ошибки валидации, возвращает 400 с массивом ошибок.
 * Если валидация прошла успешно, передает управление следующему middleware.
 * 
 * @param validations - Массив цепочек валидации express-validator
 * @returns Express middleware функция
 * 
 * @example
 * ```typescript
 * router.post('/users', 
 *   validate([
 *     body('email').isEmail(),
 *     body('name').notEmpty()
 *   ]),
 *   createUserHandler
 * );
 * ```
 */
export const validate = (validations: ValidationChain[]) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // Выполняем все валидации параллельно
    await Promise.all(validations.map((validation) => validation.run(req)));

    // Проверяем результат валидации
    const errors = validationResult(req);
    if (errors.isEmpty()) {
      next(); // Валидация прошла, продолжаем
      return;
    }

    // Возвращаем ошибки валидации
    res.status(400).json({ errors: errors.array() });
  };
};

