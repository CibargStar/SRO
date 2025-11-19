/**
 * Конфигурация логирования (Winston)
 * 
 * Настраивает структурированное логирование с:
 * - Записью в файлы (error.log для ошибок, combined.log для всех логов)
 * - Консольным выводом в development режиме
 * - JSON форматом для production
 * - Временными метками и стеком ошибок
 */

import winston from 'winston';

/**
 * Winston logger instance
 * 
 * Уровни логирования: error, warn, info, debug
 * В production логируются только error и warn в файлы
 * В development также выводятся в консоль с цветами
 */
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL ?? 'info',
  format: winston.format.combine(
    winston.format.timestamp(), // Добавляет временную метку
    winston.format.errors({ stack: true }), // Включает стек ошибок
    winston.format.json() // JSON формат для структурированных логов
  ),
  defaultMeta: { service: 'bm-tools-backend' },
  transports: [
    // Файл только для ошибок
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    // Файл для всех логов
    new winston.transports.File({ filename: 'logs/combined.log' }),
  ],
});

// В development режиме добавляем консольный вывод с цветами
if (process.env.NODE_ENV !== 'production') {
  logger.add(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(), // Цветной вывод
        winston.format.simple() // Простой читаемый формат
      ),
    })
  );
}

export default logger;

