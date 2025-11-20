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
    // Если есть refresh token, но нет access token или пользователя, 
    // можно попытаться обновить токен (но это будет в следующих этапах)
    if (refreshToken && !accessToken) {
      // Здесь можно вызвать refresh, но пока просто очищаем
      // В следующих этапах добавим автоматический refresh
    }

    // Если есть access token, но нет пользователя и запрос завершился с ошибкой,
    // очищаем состояние (токен невалидный)
    if (accessToken && !user && error && !isLoading) {
      useAuthStore.getState().clearAuth();
    }
  }, [accessToken, refreshToken, user, error, isLoading]);

  return <>{children}</>;
}

