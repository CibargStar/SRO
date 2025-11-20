/**
 * Auth Provider компонент
 * 
 * Обеспечивает автологин при наличии токенов в store.
 * Загружает данные пользователя при инициализации приложения, если есть токены.
 */

import { useEffect } from 'react';
import { Box, CircularProgress } from '@mui/material';
import { useAuthStore } from '@/store';
import { useCurrentUser } from '@/hooks/useAuth';

/**
 * Auth Provider
 * 
 * Проверяет наличие токенов в store и загружает данные пользователя при монтировании.
 * Показывает индикатор загрузки, пока загружается пользователь (если есть токен).
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
  const user = useAuthStore((state) => state.user);
  
  // Загружаем данные пользователя, если есть access token
  const { data: loadedUser, isLoading, error, isFetching } = useCurrentUser();

  useEffect(() => {
    // Автоматический refresh реализован в api.ts через fetchWithAutoRefresh
    // При получении 401 ошибки автоматически выполняется refresh и повтор запроса
    // Если refresh не удался, происходит автоматический logout и редирект на /login
    
    // Если есть access token, но нет пользователя и запрос завершился с ошибкой,
    // очищаем состояние (токен невалидный)
    // Это fallback на случай, если автоматический refresh не сработал
    if (accessToken && !loadedUser && error && !isLoading && !isFetching) {
      useAuthStore.getState().clearAuth();
    }
  }, [accessToken, refreshToken, loadedUser, error, isLoading, isFetching]);

  // Если есть токен, но пользователь еще не загружен, показываем загрузку
  // Это предотвращает редирект на /login до завершения загрузки пользователя
  // Проверяем как isLoading, так и isFetching, чтобы покрыть все состояния загрузки
  // Если user уже есть в store (из localStorage), не показываем загрузку
  const isAuthLoading = accessToken && !user && (isLoading || isFetching) && !error;
  
  if (isAuthLoading) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  return <>{children}</>;
}

