/**
 * React Query хуки для управления регионами
 * 
 * Предоставляет хуки для работы с API управления регионами:
 * - useRegions - получение списка регионов (доступно всем)
 * - useRegion - получение региона по ID (доступно всем)
 * - useCreateRegion - создание региона (только ROOT)
 * - useUpdateRegion - обновление региона (только ROOT)
 * - useDeleteRegion - удаление региона (только ROOT)
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listRegions, getRegion, createRegion, updateRegion, deleteRegion } from '@/utils/api';
import type { Region } from '@/types';
import type { CreateRegionFormData, UpdateRegionFormData } from '@/schemas/region.schema';

/**
 * Ключи для React Query кэша
 */
export const regionsKeys = {
  all: ['regions'] as const,
  lists: () => [...regionsKeys.all, 'list'] as const,
  list: () => [...regionsKeys.lists(), 'all'] as const,
  details: () => [...regionsKeys.all, 'detail'] as const,
  detail: (id: string) => [...regionsKeys.details(), id] as const,
};

/**
 * Хук для получения списка регионов
 * 
 * Доступно всем авторизованным пользователям.
 * 
 * @example
 * ```typescript
 * const { data: regions, isLoading } = useRegions();
 * ```
 */
export function useRegions() {
  return useQuery({
    queryKey: regionsKeys.list(),
    queryFn: () => listRegions(),
    staleTime: 5 * 60 * 1000, // Регионы меняются редко, кэш на 5 минут
    retry: false,
  });
}

/**
 * Хук для получения региона по ID
 * 
 * Доступно всем авторизованным пользователям.
 * 
 * @param regionId - ID региона
 * @example
 * ```typescript
 * const { data: region, isLoading } = useRegion('123');
 * ```
 */
export function useRegion(regionId: string) {
  return useQuery({
    queryKey: regionsKeys.detail(regionId),
    queryFn: () => getRegion(regionId),
    enabled: !!regionId,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}

/**
 * Хук для создания региона
 * 
 * Требует ROOT роль. Backend также проверяет роль через middleware.
 * Автоматически обновляет кэш списка регионов после успешного создания.
 * 
 * @example
 * ```typescript
 * const createMutation = useCreateRegion();
 * createMutation.mutate({ name: 'Москва' });
 * ```
 */
export function useCreateRegion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (regionData: CreateRegionFormData) => createRegion(regionData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: regionsKeys.lists() });
    },
  });
}

/**
 * Хук для обновления региона
 * 
 * Требует ROOT роль. Backend также проверяет роль через middleware.
 * Автоматически обновляет кэш списка регионов и конкретного региона после успешного обновления.
 * 
 * @example
 * ```typescript
 * const updateMutation = useUpdateRegion();
 * updateMutation.mutate({ regionId: '123', regionData: { name: 'Санкт-Петербург' } });
 * ```
 */
export function useUpdateRegion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ regionId, regionData }: { regionId: string; regionData: UpdateRegionFormData }) =>
      updateRegion(regionId, regionData),
    onSuccess: (updatedRegion: Region) => {
      queryClient.invalidateQueries({ queryKey: regionsKeys.lists() });
      queryClient.setQueryData(regionsKeys.detail(updatedRegion.id), updatedRegion);
    },
  });
}

/**
 * Хук для удаления региона
 * 
 * Требует ROOT роль. Backend также проверяет роль через middleware.
 * Автоматически обновляет кэш списка регионов после успешного удаления.
 * 
 * @example
 * ```typescript
 * const deleteMutation = useDeleteRegion();
 * deleteMutation.mutate('123');
 * ```
 */
export function useDeleteRegion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (regionId: string) => deleteRegion(regionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: regionsKeys.lists() });
    },
  });
}

