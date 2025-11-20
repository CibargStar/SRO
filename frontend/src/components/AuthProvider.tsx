/**
 * Auth Provider компонент
 * 
 * Обеспечивает автологин при наличии токенов в store.
 * Загружает данные пользователя при инициализации приложения, если есть токены.
 */

import { useEffect } from 'react';
import { useAuthStore } from '@/store';
import { useCurrentUser } from '@/hooks/useAuth';

/**
 * Auth Provider
 * 
 * Проверяет наличие токенов в store и загружает данные пользователя при монтировании.
 * 
 * @example
 * ```typescript
 * <AuthProvider>
 *   <App />
 * </AuthProvider>
 * ```
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const accessToken = useAuthStore((state) => state.accessToken);
  const refreshToken = useAuthStore((state) => state.refreshToken);
  
  // Загружаем данные пользователя, если есть access token
  const { data: user, isLoading, error } = useCurrentUser();

  useEffect(() => {
    // Автоматический refresh реализован в api.ts через fetchWithAutoRefresh
    // При получении 401 ошибки автоматически выполняется refresh и повтор запроса
    // Если refresh не удался, происходит автоматический logout и редирект на /login
    
    // Если есть access token, но нет пользователя и запрос завершился с ошибкой,
    // очищаем состояние (токен невалидный)
    // Это fallback на случай, если автоматический refresh не сработал
    if (accessToken && !user && error && !isLoading) {
      useAuthStore.getState().clearAuth();
    }
  }, [accessToken, refreshToken, user, error, isLoading]);

  return <>{children}</>;
}

