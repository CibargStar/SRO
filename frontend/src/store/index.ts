/**
 * State Management (Zustand)
 * 
 * Централизованное управление состоянием приложения.
 * Используйте Zustand для глобального состояния, Context API для локального.
 */

export {
  useAuthStore,
  useIsAuthenticated,
  useIsRoot,
} from './authStore';
