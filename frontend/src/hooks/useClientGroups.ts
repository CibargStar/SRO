/**
 * React Query хуки для управления группами клиентов
 * 
 * Предоставляет хуки для работы с API управления группами клиентов:
 * - useClientGroups - получение списка групп
 * - useClientGroup - получение группы по ID
 * - useCreateClientGroup - создание группы
 * - useUpdateClientGroup - обновление группы
 * - useDeleteClientGroup - удаление группы
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listClientGroups, getClientGroup, createClientGroup, updateClientGroup, deleteClientGroup } from '@/utils/api';
import type { ClientGroup } from '@/types';
import type { CreateClientGroupFormData, UpdateClientGroupFormData } from '@/schemas/client-group.schema';

/**
 * Ключи для React Query кэша
 */
export const clientGroupsKeys = {
  all: ['clientGroups'] as const,
  lists: () => [...clientGroupsKeys.all, 'list'] as const,
  list: () => [...clientGroupsKeys.lists(), 'all'] as const,
  details: () => [...clientGroupsKeys.all, 'detail'] as const,
  detail: (id: string) => [...clientGroupsKeys.details(), id] as const,
};

/**
 * Хук для получения списка групп клиентов
 * 
 * @param userId - Опциональный ID пользователя для ROOT (для просмотра групп другого пользователя)
 * @example
 * ```typescript
 * const { data: groups, isLoading } = useClientGroups();
 * const { data: userGroups } = useClientGroups('user-id'); // Для ROOT
 * ```
 */
export function useClientGroups(userId?: string) {
  return useQuery({
    queryKey: [...clientGroupsKeys.list(), userId || 'current'],
    queryFn: () => listClientGroups(userId),
    staleTime: 30 * 1000,
    retry: false,
  });
}

/**
 * Хук для получения группы клиентов по ID
 * 
 * @param groupId - ID группы
 * @example
 * ```typescript
 * const { data: group, isLoading } = useClientGroup('123');
 * ```
 */
export function useClientGroup(groupId: string) {
  return useQuery({
    queryKey: clientGroupsKeys.detail(groupId),
    queryFn: () => getClientGroup(groupId),
    enabled: !!groupId,
    staleTime: 30 * 1000,
    retry: false,
  });
}

/**
 * Хук для создания группы клиентов
 * 
 * Автоматически обновляет кэш списка групп после успешного создания.
 * 
 * @example
 * ```typescript
 * const createMutation = useCreateClientGroup();
 * createMutation.mutate({ name: 'VIP клиенты' });
 * ```
 */
export function useCreateClientGroup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (groupData: CreateClientGroupFormData) => createClientGroup(groupData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: clientGroupsKeys.lists() });
    },
  });
}

/**
 * Хук для обновления группы клиентов
 * 
 * Автоматически обновляет кэш списка групп и конкретной группы после успешного обновления.
 * 
 * @example
 * ```typescript
 * const updateMutation = useUpdateClientGroup();
 * updateMutation.mutate({ groupId: '123', groupData: { name: 'Новое название' } });
 * ```
 */
export function useUpdateClientGroup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ groupId, groupData }: { groupId: string; groupData: UpdateClientGroupFormData }) =>
      updateClientGroup(groupId, groupData),
    onSuccess: (updatedGroup: ClientGroup) => {
      queryClient.invalidateQueries({ queryKey: clientGroupsKeys.lists() });
      queryClient.setQueryData(clientGroupsKeys.detail(updatedGroup.id), updatedGroup);
    },
  });
}

/**
 * Хук для удаления группы клиентов
 * 
 * Автоматически обновляет кэш списка групп после успешного удаления.
 * 
 * @example
 * ```typescript
 * const deleteMutation = useDeleteClientGroup();
 * deleteMutation.mutate('123');
 * ```
 */
export function useDeleteClientGroup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (groupId: string) => deleteClientGroup(groupId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: clientGroupsKeys.lists() });
    },
  });
}

