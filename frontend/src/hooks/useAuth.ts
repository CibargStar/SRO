/**
 * React Query хуки для авторизации
 * 
 * Предоставляет хуки для работы с API авторизации:
 * - useLogin - вход в систему
 * - useLogout - выход из системы
 * - useCurrentUser - получение данных текущего пользователя
 * - useRefresh - обновление токенов (внутренний хук)
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { login, logout, getCurrentUser, refresh } from '@/utils/api';
import { useAuthStore } from '@/store';
import type { LoginInput, LoginResponse, User } from '@/types';

/**
 * Ключи для React Query кэша
 */
export const authKeys = {
  all: ['auth'] as const,
  currentUser: () => [...authKeys.all, 'currentUser'] as const,
};

/**
 * Хук для входа в систему
 * 
 * Сохраняет токены и пользователя в Zustand store при успешном входе.
 * 
 * @example
 * ```typescript
 * const loginMutation = useLogin();
 * loginMutation.mutate({ email: 'user@example.com', password: 'password123' });
 * ```
 */
export function useLogin() {
  const queryClient = useQueryClient();
  const { setAuth } = useAuthStore();

  return useMutation({
    mutationFn: (credentials: LoginInput) => login(credentials),
    onSuccess: (data: LoginResponse) => {
      // Сохраняем токены и пользователя в store
      setAuth(data.accessToken, data.refreshToken, data.user as User);
      // Обновляем кэш React Query
      queryClient.setQueryData(authKeys.currentUser(), data.user as User);
    },
  });
}

/**
 * Хук для выхода из системы
 * 
 * Очищает токены и пользователя из Zustand store при успешном выходе.
 * 
 * @example
 * ```typescript
 * const logoutMutation = useLogout();
 * logoutMutation.mutate(refreshToken);
 * ```
 */
export function useLogout() {
  const queryClient = useQueryClient();
  const { clearAuth, refreshToken } = useAuthStore();

  return useMutation({
    mutationFn: (token?: string) => {
      // Используем токен из параметра или из store
      const tokenToUse = token || refreshToken || '';
      return logout(tokenToUse);
    },
    onSuccess: () => {
      // Очищаем store
      clearAuth();
      // Очищаем кэш React Query
      queryClient.removeQueries({ queryKey: authKeys.all });
    },
    onError: () => {
      // Даже при ошибке очищаем состояние (идемпотентность)
      clearAuth();
      queryClient.removeQueries({ queryKey: authKeys.all });
    },
  });
}

/**
 * Хук для получения данных текущего пользователя
 * 
 * Использует accessToken из Zustand store.
 * Автоматически обновляет пользователя в store при успешном запросе.
 * 
 * @param accessToken - Access токен для авторизации (опционально, берется из store если не указан)
 * @example
 * ```typescript
 * const { data: user, isLoading } = useCurrentUser();
 * ```
 */
export function useCurrentUser(accessToken?: string) {
  const storeAccessToken = useAuthStore((state) => state.accessToken);
  const { updateUser } = useAuthStore();
  const token = accessToken || storeAccessToken;

  return useQuery({
    queryKey: authKeys.currentUser(),
    queryFn: () => getCurrentUser(token!),
    enabled: !!token, // Запрос выполняется только если есть токен
    staleTime: 5 * 60 * 1000, // Данные актуальны 5 минут
    retry: false, // Не повторять запрос при ошибке 401
    onSuccess: (user: User) => {
      // Обновляем пользователя в store
      updateUser(user);
    },
  });
}

/**
 * Хук для обновления токенов
 * 
 * Обновляет токены в Zustand store при успешном обновлении.
 * 
 * @example
 * ```typescript
 * const refreshMutation = useRefresh();
 * refreshMutation.mutate(refreshToken);
 * ```
 */
export function useRefresh() {
  const { updateTokens, refreshToken: storeRefreshToken } = useAuthStore();

  return useMutation({
    mutationFn: (token?: string) => {
      // Используем токен из параметра или из store
      const tokenToUse = token || storeRefreshToken || '';
      return refresh(tokenToUse);
    },
    onSuccess: (data) => {
      // Обновляем токены в store
      updateTokens(data.accessToken, data.refreshToken);
    },
  });
}

