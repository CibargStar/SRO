/**
 * React Query хуки для управления лимитами профилей
 * 
 * Предоставляет хуки для работы с API лимитов профилей:
 * - useMyLimits - получение собственных лимитов
 * - useAllLimits - получение всех лимитов (ROOT only)
 * - useUserLimits - получение лимитов пользователя (ROOT only)
 * - useSetUserLimits - установка лимитов пользователя (ROOT only)
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getMyLimits, getAllLimits, getUserLimits, setUserLimits } from '@/utils/api';
import type { ProfileLimits, SetProfileLimitsInput } from '@/types';

/**
 * Ключи для React Query кэша
 */
export const profileLimitsKeys = {
  all: ['profile-limits'] as const,
  my: () => [...profileLimitsKeys.all, 'my'] as const,
  allLimits: () => [...profileLimitsKeys.all, 'all'] as const,
  user: (userId: string) => [...profileLimitsKeys.all, 'user', userId] as const,
};

/**
 * Хук для получения собственных лимитов профилей
 */
export function useMyLimits() {
  return useQuery({
    queryKey: profileLimitsKeys.my(),
    queryFn: () => getMyLimits(),
    staleTime: 60 * 1000, // Лимиты актуальны 1 минуту
    retry: false,
  });
}

/**
 * Хук для получения всех лимитов профилей (ROOT only)
 */
export function useAllLimits() {
  return useQuery({
    queryKey: profileLimitsKeys.allLimits(),
    queryFn: () => getAllLimits(),
    staleTime: 60 * 1000,
    retry: false,
  });
}

/**
 * Хук для получения лимитов профилей пользователя (ROOT only)
 * 
 * @param userId - ID пользователя
 */
export function useUserLimits(userId: string) {
  return useQuery({
    queryKey: profileLimitsKeys.user(userId),
    queryFn: () => getUserLimits(userId),
    enabled: !!userId,
    staleTime: 60 * 1000,
    retry: false,
  });
}

/**
 * Хук для установки лимитов профилей для пользователя (ROOT only)
 * 
 * Автоматически обновляет кэш лимитов после успешной установки.
 */
export function useSetUserLimits() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ userId, limitsData }: { userId: string; limitsData: SetProfileLimitsInput }) =>
      setUserLimits(userId, limitsData),
    onSuccess: (updatedLimits, variables) => {
      // Инвалидируем кэш лимитов пользователя
      queryClient.invalidateQueries({ queryKey: profileLimitsKeys.user(variables.userId) });
      // Инвалидируем кэш всех лимитов
      queryClient.invalidateQueries({ queryKey: profileLimitsKeys.allLimits() });
      // Инвалидируем собственные лимиты, если обновлялись лимиты текущего пользователя
      queryClient.invalidateQueries({ queryKey: profileLimitsKeys.my() });
      // Обновляем кэш лимитов пользователя
      queryClient.setQueryData(profileLimitsKeys.user(variables.userId), updatedLimits);
    },
  });
}









