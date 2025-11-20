/**
 * React Query хуки для управления клиентами
 * 
 * Предоставляет хуки для работы с API управления клиентами:
 * - useClients - получение списка клиентов (с пагинацией, поиском, фильтрацией)
 * - useClient - получение клиента по ID
 * - useCreateClient - создание клиента
 * - useUpdateClient - обновление клиента
 * - useDeleteClient - удаление клиента
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listClients, getClient, createClient, updateClient, deleteClient } from '@/utils/api';
import type { Client, ListClientsQuery } from '@/types';
import type { CreateClientFormData, UpdateClientFormData } from '@/schemas/client.schema';

/**
 * Ключи для React Query кэша
 */
export const clientsKeys = {
  all: ['clients'] as const,
  lists: () => [...clientsKeys.all, 'list'] as const,
  list: (query?: ListClientsQuery) => [...clientsKeys.lists(), query] as const,
  details: () => [...clientsKeys.all, 'detail'] as const,
  detail: (id: string) => [...clientsKeys.details(), id] as const,
};

/**
 * Хук для получения списка клиентов
 * 
 * Поддерживает пагинацию, поиск, фильтрацию и сортировку.
 * 
 * @param query - Query параметры (пагинация, поиск, фильтрация, сортировка)
 * @example
 * ```typescript
 * const { data, isLoading } = useClients({ page: 1, limit: 10, search: 'Иванов' });
 * ```
 */
export function useClients(query?: ListClientsQuery) {
  return useQuery({
    queryKey: clientsKeys.list(query),
    queryFn: () => listClients(query),
    staleTime: 30 * 1000, // Данные актуальны 30 секунд
    retry: false, // Не повторять запрос при ошибке 401/403
  });
}

/**
 * Хук для получения клиента по ID
 * 
 * @param clientId - ID клиента
 * @example
 * ```typescript
 * const { data: client, isLoading } = useClient('123');
 * ```
 */
export function useClient(clientId: string) {
  return useQuery({
    queryKey: clientsKeys.detail(clientId),
    queryFn: () => getClient(clientId),
    enabled: !!clientId, // Запрос выполняется только если clientId указан
    staleTime: 30 * 1000,
    retry: false,
  });
}

/**
 * Хук для создания клиента
 * 
 * Автоматически обновляет кэш списка клиентов после успешного создания.
 * 
 * @example
 * ```typescript
 * const createMutation = useCreateClient();
 * createMutation.mutate({ lastName: 'Иванов', firstName: 'Иван' });
 * ```
 */
export function useCreateClient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (clientData: CreateClientFormData) => createClient(clientData),
    onSuccess: () => {
      // Инвалидируем кэш списка клиентов, чтобы обновить данные
      queryClient.invalidateQueries({ queryKey: clientsKeys.lists() });
    },
  });
}

/**
 * Хук для обновления клиента
 * 
 * Автоматически обновляет кэш списка клиентов и конкретного клиента после успешного обновления.
 * 
 * @example
 * ```typescript
 * const updateMutation = useUpdateClient();
 * updateMutation.mutate({ clientId: '123', clientData: { lastName: 'Петров' } });
 * ```
 */
export function useUpdateClient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ clientId, clientData }: { clientId: string; clientData: UpdateClientFormData }) =>
      updateClient(clientId, clientData),
    onSuccess: (updatedClient: Client) => {
      // Инвалидируем кэш списка клиентов
      queryClient.invalidateQueries({ queryKey: clientsKeys.lists() });
      // Обновляем кэш конкретного клиента
      queryClient.setQueryData(clientsKeys.detail(updatedClient.id), updatedClient);
    },
  });
}

/**
 * Хук для удаления клиента
 * 
 * Автоматически обновляет кэш списка клиентов после успешного удаления.
 * 
 * @example
 * ```typescript
 * const deleteMutation = useDeleteClient();
 * deleteMutation.mutate('123');
 * ```
 */
export function useDeleteClient() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (clientId: string) => deleteClient(clientId),
    onSuccess: () => {
      // Инвалидируем кэш списка клиентов
      queryClient.invalidateQueries({ queryKey: clientsKeys.lists() });
    },
  });
}

