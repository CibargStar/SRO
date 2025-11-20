/**
 * Конфигурация frontend приложения
 * 
 * Настройки приложения, константы, конфигурация API клиентов.
 */

/**
 * URL API backend сервера
 * 
 * Читается из переменной окружения VITE_API_URL или использует значение по умолчанию.
 */
export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

/**
 * Базовый путь API
 */
export const API_BASE_PATH = '/api';

/**
 * Полный URL API
 */
export const API_BASE_URL = `${API_URL}${API_BASE_PATH}`;
