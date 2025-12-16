/**
 * React Query хуки для управления профилями Chrome
 * 
 * Предоставляет хуки для работы с API управления профилями:
 * - useProfiles - получение списка профилей (с пагинацией, фильтрацией, сортировкой)
 * - useProfile - получение профиля по ID
 * - useCreateProfile - создание профиля
 * - useUpdateProfile - обновление профиля
 * - useDeleteProfile - удаление профиля
 * - useProfileStatus - получение статуса профиля
 * - useStartProfile - запуск профиля
 * - useStopProfile - остановка профиля
 * - useProfileResources - получение статистики ресурсов
 * - useProfileResourcesHistory - получение истории ресурсов
 * - useProfileHealth - проверка здоровья профиля
 * - useProfileNetworkStats - получение сетевой статистики
 * - useProfileAlerts - получение алертов
 * - useProfileUnreadAlertsCount - количество непрочитанных алертов
 * - useMarkAlertAsRead - отметка алерта как прочитанного
 * - useMarkAllAlertsAsRead - отметка всех алертов как прочитанных
 * - useProfileAnalytics - получение аналитики профиля
 */

import { useQuery, useMutation, useQueryClient, type UseQueryOptions } from '@tanstack/react-query';
import {
  listProfiles,
  getProfile,
  createProfile,
  updateProfile,
  deleteProfile,
  getProfileStatus,
  startProfile,
  stopProfile,
  getProfileResources,
  getProfileResourcesHistory,
  checkProfileHealth,
  getProfileNetworkStats,
  getProfileAlerts,
  getProfileUnreadAlertsCount,
  markAlertAsRead,
  markAllAlertsAsRead,
  getProfileAnalytics,
} from '@/utils/api';
import type {
  Profile,
  ProfilesListResponse,
  ListProfilesQuery,
  CreateProfileInput,
  UpdateProfileInput,
  ProfileStatusResponse,
  StartProfileOptions,
  StartProfileResponse,
  ProcessResourceStats,
  ProfileResourcesHistoryResponse,
  ProfileHealthCheck,
  NetworkStats,
  ProfileAlertsResponse,
  ProfileUnreadAlertsCountResponse,
  ProfileAnalytics,
  AggregationPeriod,
} from '@/types';

/**
 * Ключи для React Query кэша
 */
export const profilesKeys = {
  all: ['profiles'] as const,
  lists: () => [...profilesKeys.all, 'list'] as const,
  list: (query?: ListProfilesQuery) => [...profilesKeys.lists(), query] as const,
  details: () => [...profilesKeys.all, 'detail'] as const,
  detail: (id: string) => [...profilesKeys.details(), id] as const,
  status: (id: string) => [...profilesKeys.detail(id), 'status'] as const,
  resources: (id: string) => [...profilesKeys.detail(id), 'resources'] as const,
  resourcesHistory: (id: string, limit?: number, from?: string, to?: string) =>
    [...profilesKeys.detail(id), 'resources-history', limit, from, to] as const,
  health: (id: string) => [...profilesKeys.detail(id), 'health'] as const,
  networkStats: (id: string) => [...profilesKeys.detail(id), 'network'] as const,
  alerts: (id: string, limit?: number, unreadOnly?: boolean, from?: string, to?: string) =>
    [...profilesKeys.detail(id), 'alerts', limit, unreadOnly, from, to] as const,
  unreadAlertsCount: (id: string) => [...profilesKeys.detail(id), 'unread-alerts-count'] as const,
  analytics: (id: string, period?: AggregationPeriod, from?: string, to?: string) =>
    [...profilesKeys.detail(id), 'analytics', period, from, to] as const,
};

/**
 * Хук для получения списка профилей
 * 
 * Поддерживает пагинацию, фильтрацию и сортировку.
 * 
 * @param query - Query параметры (пагинация, фильтрация, сортировка)
 * @param options - Дополнительные опции useQuery
 */
export function useProfiles(
  query?: ListProfilesQuery,
  options?: Omit<UseQueryOptions<ProfilesListResponse>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: profilesKeys.list(query),
    queryFn: () => listProfiles(query),
    staleTime: 30 * 1000, // Данные актуальны 30 секунд
    retry: false,
    ...options,
  });
}

/**
 * Хук для получения профиля по ID
 * 
 * @param profileId - ID профиля
 * @param options - Дополнительные опции useQuery
 */
export function useProfile(
  profileId: string,
  options?: Omit<UseQueryOptions<Profile>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: profilesKeys.detail(profileId),
    queryFn: () => getProfile(profileId),
    enabled: !!profileId,
    staleTime: 30 * 1000,
    retry: false,
    ...options,
  });
}

/**
 * Хук для создания профиля
 * 
 * Автоматически обновляет кэш списка профилей после успешного создания.
 */
export function useCreateProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (profileData: CreateProfileInput) => createProfile(profileData),
    onSuccess: () => {
      // Инвалидируем кэш списка профилей
      queryClient.invalidateQueries({ queryKey: profilesKeys.lists() });
    },
  });
}

/**
 * Хук для обновления профиля
 * 
 * Автоматически обновляет кэш списка профилей и конкретного профиля после успешного обновления.
 */
export function useUpdateProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ profileId, profileData }: { profileId: string; profileData: UpdateProfileInput }) =>
      updateProfile(profileId, profileData),
    onSuccess: (updatedProfile: Profile) => {
      // Логирование для отладки (можно удалить в продакшене)
      if (process.env.NODE_ENV === 'development') {
        console.log('[useUpdateProfile] Profile updated, updating cache:', updatedProfile);
      }
      
      // Обновляем кэш конкретного профиля
      queryClient.setQueryData(profilesKeys.detail(updatedProfile.id), updatedProfile);
      
      // Обновляем профиль во ВСЕХ вариантах кэша списка профилей (независимо от параметров запроса)
      queryClient.setQueriesData<ProfilesListResponse>(
        { queryKey: profilesKeys.lists(), exact: false },
        (oldData) => {
          if (!oldData) return oldData;
          
          // Создаем новый массив, чтобы React Query увидел изменения
          const updatedData: ProfilesListResponse = {
            ...oldData,
            data: oldData.data.map((p) => 
              p.id === updatedProfile.id 
                ? { ...updatedProfile } // Создаем новый объект профиля
                : p
            ),
          };
          
          // Логирование для отладки (можно удалить в продакшене)
          if (process.env.NODE_ENV === 'development') {
            console.log('[useUpdateProfile] Updated list cache:', {
              oldHeadless: oldData.data.find(p => p.id === updatedProfile.id)?.headless,
              newHeadless: updatedProfile.headless,
              updatedData,
            });
          }
          
          return updatedData;
        }
      );
      
      // Инвалидируем кэш списка профилей (но не делаем refetch, чтобы избежать лишних запросов)
      // Обновление через setQueriesData уже обновило кэш, поэтому refetch не нужен
      queryClient.invalidateQueries({ queryKey: profilesKeys.lists(), exact: false });
      
      // Инвалидируем статус профиля
      queryClient.invalidateQueries({ queryKey: profilesKeys.status(updatedProfile.id) });
    },
  });
}

/**
 * Хук для удаления профиля
 * 
 * Автоматически обновляет кэш списка профилей после успешного удаления.
 */
export function useDeleteProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (profileId: string) => deleteProfile(profileId),
    onSuccess: (_, profileId) => {
      // Инвалидируем кэш списка профилей
      queryClient.invalidateQueries({ queryKey: profilesKeys.lists() });
      // Удаляем кэш конкретного профиля
      queryClient.removeQueries({ queryKey: profilesKeys.detail(profileId) });
    },
  });
}

/**
 * Хук для получения статуса профиля
 * 
 * @param profileId - ID профиля
 * @param options - Дополнительные опции useQuery
 */
export function useProfileStatus(
  profileId: string,
  options?: Omit<UseQueryOptions<ProfileStatusResponse>, 'queryKey' | 'queryFn'> & {
    refetchInterval?: number | false;
  }
) {
  return useQuery({
    queryKey: profilesKeys.status(profileId),
    queryFn: () => getProfileStatus(profileId),
    enabled: !!profileId,
    staleTime: 5 * 1000, // Статус актуален 5 секунд
    retry: false,
    ...options,
  });
}

/**
 * Хук для запуска профиля
 * 
 * Автоматически обновляет кэш профиля и статуса после успешного запуска.
 */
export function useStartProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ profileId, options }: { profileId: string; options?: StartProfileOptions }) =>
      startProfile(profileId, options),
    onSuccess: (data, variables) => {
      // Инвалидируем кэш профиля
      queryClient.invalidateQueries({ queryKey: profilesKeys.detail(variables.profileId) });
      // Инвалидируем статус
      queryClient.invalidateQueries({ queryKey: profilesKeys.status(variables.profileId) });
      // Инвалидируем список профилей
      queryClient.invalidateQueries({ queryKey: profilesKeys.lists() });
    },
  });
}

/**
 * Хук для остановки профиля
 * 
 * Автоматически обновляет кэш профиля и статуса после успешной остановки.
 */
export function useStopProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ profileId, force }: { profileId: string; force?: boolean }) =>
      stopProfile(profileId, force ?? false),
    onSuccess: (_, variables) => {
      // Инвалидируем кэш профиля
      queryClient.invalidateQueries({ queryKey: profilesKeys.detail(variables.profileId) });
      // Инвалидируем статус
      queryClient.invalidateQueries({ queryKey: profilesKeys.status(variables.profileId) });
      // Инвалидируем список профилей
      queryClient.invalidateQueries({ queryKey: profilesKeys.lists() });
      // Инвалидируем статистику ресурсов
      queryClient.invalidateQueries({ queryKey: profilesKeys.resources(variables.profileId) });
    },
  });
}

/**
 * Хук для получения статистики ресурсов профиля
 * 
 * @param profileId - ID профиля
 * @param options - Дополнительные опции useQuery
 */
export function useProfileResources(
  profileId: string,
  options?: Omit<UseQueryOptions<ProcessResourceStats | null>, 'queryKey' | 'queryFn'> & {
    refetchInterval?: number | false;
  }
) {
  return useQuery({
    queryKey: profilesKeys.resources(profileId),
    queryFn: () => getProfileResources(profileId),
    enabled: !!profileId,
    staleTime: 5 * 1000, // Статистика актуальна 5 секунд
    retry: false,
    ...options,
  });
}

/**
 * Хук для получения истории статистики ресурсов профиля
 * 
 * @param profileId - ID профиля
 * @param limit - Максимальное количество записей
 * @param from - Начальная дата (ISO 8601)
 * @param to - Конечная дата (ISO 8601)
 * @param options - Дополнительные опции useQuery
 */
export function useProfileResourcesHistory(
  profileId: string,
  limit?: number,
  from?: string,
  to?: string,
  options?: Omit<UseQueryOptions<ProfileResourcesHistoryResponse>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: profilesKeys.resourcesHistory(profileId, limit, from, to),
    queryFn: () => getProfileResourcesHistory(profileId, limit, from, to),
    enabled: !!profileId,
    staleTime: 30 * 1000,
    retry: false,
    ...options,
  });
}

/**
 * Хук для проверки здоровья профиля
 * 
 * @param profileId - ID профиля
 * @param options - Дополнительные опции useQuery
 */
export function useProfileHealth(
  profileId: string,
  options?: Omit<UseQueryOptions<ProfileHealthCheck>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: profilesKeys.health(profileId),
    queryFn: () => checkProfileHealth(profileId),
    enabled: !!profileId,
    staleTime: 10 * 1000,
    retry: false,
    ...options,
  });
}

/**
 * Хук для получения статистики сетевой активности профиля
 * 
 * @param profileId - ID профиля
 * @param options - Дополнительные опции useQuery
 */
export function useProfileNetworkStats(
  profileId: string,
  options?: Omit<UseQueryOptions<NetworkStats | null>, 'queryKey' | 'queryFn'> & {
    refetchInterval?: number | false;
  }
) {
  return useQuery({
    queryKey: profilesKeys.networkStats(profileId),
    queryFn: () => getProfileNetworkStats(profileId),
    enabled: !!profileId,
    staleTime: 5 * 1000,
    retry: false,
    ...options,
  });
}

/**
 * Хук для получения алертов профиля
 * 
 * @param profileId - ID профиля
 * @param limit - Максимальное количество алертов
 * @param unreadOnly - Только непрочитанные
 * @param from - Начальная дата (ISO 8601)
 * @param to - Конечная дата (ISO 8601)
 * @param options - Дополнительные опции useQuery
 */
export function useProfileAlerts(
  profileId: string,
  limit?: number,
  unreadOnly?: boolean,
  from?: string,
  to?: string,
  options?: Omit<UseQueryOptions<ProfileAlertsResponse>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: profilesKeys.alerts(profileId, limit, unreadOnly, from, to),
    queryFn: () => getProfileAlerts(profileId, limit, unreadOnly, from, to),
    enabled: !!profileId,
    staleTime: 30 * 1000,
    retry: false,
    ...options,
  });
}

/**
 * Хук для получения количества непрочитанных алертов
 * 
 * @param profileId - ID профиля
 * @param options - Дополнительные опции useQuery
 */
export function useProfileUnreadAlertsCount(
  profileId: string,
  options?: Omit<UseQueryOptions<ProfileUnreadAlertsCountResponse>, 'queryKey' | 'queryFn'> & {
    refetchInterval?: number | false;
  }
) {
  return useQuery({
    queryKey: profilesKeys.unreadAlertsCount(profileId),
    queryFn: () => getProfileUnreadAlertsCount(profileId),
    enabled: !!profileId,
    staleTime: 10 * 1000,
    retry: false,
    ...options,
  });
}

/**
 * Хук для отметки алерта как прочитанного
 * 
 * Автоматически обновляет кэш алертов после успешной отметки.
 */
export function useMarkAlertAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ profileId, alertId }: { profileId: string; alertId: string }) =>
      markAlertAsRead(profileId, alertId),
    onSuccess: (_, variables) => {
      // Инвалидируем кэш алертов
      queryClient.invalidateQueries({ queryKey: profilesKeys.alerts(variables.profileId) });
      // Инвалидируем количество непрочитанных
      queryClient.invalidateQueries({ queryKey: profilesKeys.unreadAlertsCount(variables.profileId) });
    },
  });
}

/**
 * Хук для отметки всех алертов как прочитанных
 * 
 * Автоматически обновляет кэш алертов после успешной отметки.
 */
export function useMarkAllAlertsAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (profileId: string) => markAllAlertsAsRead(profileId),
    onSuccess: (_, profileId) => {
      // Инвалидируем кэш алертов
      queryClient.invalidateQueries({ queryKey: profilesKeys.alerts(profileId) });
      // Инвалидируем количество непрочитанных
      queryClient.invalidateQueries({ queryKey: profilesKeys.unreadAlertsCount(profileId) });
    },
  });
}

/**
 * Хук для получения аналитики профиля
 * 
 * @param profileId - ID профиля
 * @param period - Период агрегации
 * @param from - Начальная дата (ISO 8601)
 * @param to - Конечная дата (ISO 8601)
 * @param options - Дополнительные опции useQuery
 */
export function useProfileAnalytics(
  profileId: string,
  period?: AggregationPeriod,
  from?: string,
  to?: string,
  options?: Omit<UseQueryOptions<ProfileAnalytics>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: profilesKeys.analytics(profileId, period, from, to),
    queryFn: () => getProfileAnalytics(profileId, period, from, to),
    enabled: !!profileId,
    staleTime: 60 * 1000, // Аналитика актуальна 1 минуту
    retry: false,
    ...options,
  });
}

