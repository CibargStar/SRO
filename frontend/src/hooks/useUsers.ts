/**
 * React Query хуки для управления пользователями
 * 
 * Предоставляет хуки для работы с API управления пользователями:
 * - useUsers - получение списка пользователей
 * - useCreateUser - создание пользователя
 * - useUpdateUser - обновление пользователя
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listUsers, createUser, updateUser } from '@/utils/api';
import type { User } from '@/types';
import type { CreateUserFormData, UpdateUserFormData } from '@/schemas/user.schema';

/**
 * Ключи для React Query кэша
 */
export const usersKeys = {
  all: ['users'] as const,
  lists: () => [...usersKeys.all, 'list'] as const,
  list: () => [...usersKeys.lists(), 'all'] as const,
  details: () => [...usersKeys.all, 'detail'] as const,
  detail: (id: string) => [...usersKeys.details(), id] as const,
};

/**
 * Хук для получения списка пользователей
 * 
 * Требует ROOT роль. Backend также проверяет роль через middleware.
 * 
 * @example
 * ```typescript
 * const { data: users, isLoading } = useUsers();
 * ```
 */
export function useUsers() {
  return useQuery({
    queryKey: usersKeys.list(),
    queryFn: () => listUsers(),
    staleTime: 30 * 1000, // Данные актуальны 30 секунд
    retry: false, // Не повторять запрос при ошибке 401/403
  });
}

/**
 * Хук для создания пользователя
 * 
 * Требует ROOT роль. Backend также проверяет роль через middleware.
 * Автоматически обновляет кэш списка пользователей после успешного создания.
 * 
 * @example
 * ```typescript
 * const createMutation = useCreateUser();
 * createMutation.mutate({ email: 'user@example.com', password: 'Password123!' });
 * ```
 */
export function useCreateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (userData: CreateUserFormData) => createUser(userData),
    onSuccess: () => {
      // Инвалидируем кэш списка пользователей, чтобы обновить данные
      queryClient.invalidateQueries({ queryKey: usersKeys.lists() });
    },
  });
}

/**
 * Хук для обновления пользователя
 * 
 * Требует ROOT роль. Backend также проверяет роль через middleware.
 * Автоматически обновляет кэш списка пользователей после успешного обновления.
 * 
 * @example
 * ```typescript
 * const updateMutation = useUpdateUser();
 * updateMutation.mutate({ userId: '123', userData: { name: 'New Name' } });
 * ```
 */
export function useUpdateUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, userData }: { userId: string; userData: UpdateUserFormData }) =>
      updateUser(userId, userData),
    onSuccess: (updatedUser: User) => {
      // Инвалидируем кэш списка пользователей
      queryClient.invalidateQueries({ queryKey: usersKeys.lists() });
      // Обновляем кэш конкретного пользователя
      queryClient.setQueryData(usersKeys.detail(updatedUser.id), updatedUser);
    },
  });
}

