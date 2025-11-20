/**
 * React Query хуки для управления телефонами клиентов
 * 
 * Предоставляет хуки для работы с API управления телефонами клиентов:
 * - useClientPhones - получение списка телефонов клиента
 * - useCreateClientPhone - создание телефона
 * - useUpdateClientPhone - обновление телефона
 * - useDeleteClientPhone - удаление телефона
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listClientPhones, createClientPhone, updateClientPhone, deleteClientPhone } from '@/utils/api';
import type { ClientPhone } from '@/types';
import type { CreateClientPhoneFormData, UpdateClientPhoneFormData } from '@/schemas/client-phone.schema';

/**
 * Ключи для React Query кэша
 */
export const clientPhonesKeys = {
  all: ['clientPhones'] as const,
  lists: () => [...clientPhonesKeys.all, 'list'] as const,
  list: (clientId: string) => [...clientPhonesKeys.lists(), clientId] as const,
  details: () => [...clientPhonesKeys.all, 'detail'] as const,
  detail: (clientId: string, phoneId: string) => [...clientPhonesKeys.details(), clientId, phoneId] as const,
};

/**
 * Хук для получения списка телефонов клиента
 * 
 * @param clientId - ID клиента
 */
export function useClientPhones(clientId: string) {
  return useQuery({
    queryKey: clientPhonesKeys.list(clientId),
    queryFn: () => listClientPhones(clientId),
    enabled: !!clientId,
    staleTime: 30 * 1000,
    retry: false,
  });
}

/**
 * Хук для создания телефона клиента
 */
export function useCreateClientPhone() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ clientId, phoneData }: { clientId: string; phoneData: CreateClientPhoneFormData }) =>
      createClientPhone(clientId, phoneData),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: clientPhonesKeys.list(variables.clientId) });
      // Также инвалидируем кэш клиента, чтобы обновить список телефонов
      queryClient.invalidateQueries({ queryKey: ['clients', 'detail', variables.clientId] });
    },
  });
}

/**
 * Хук для обновления телефона клиента
 */
export function useUpdateClientPhone() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      clientId,
      phoneId,
      phoneData,
    }: {
      clientId: string;
      phoneId: string;
      phoneData: UpdateClientPhoneFormData;
    }) => updateClientPhone(clientId, phoneId, phoneData),
    onSuccess: (updatedPhone: ClientPhone, variables) => {
      queryClient.invalidateQueries({ queryKey: clientPhonesKeys.list(variables.clientId) });
      queryClient.setQueryData(
        clientPhonesKeys.detail(variables.clientId, updatedPhone.id),
        updatedPhone
      );
      queryClient.invalidateQueries({ queryKey: ['clients', 'detail', variables.clientId] });
    },
  });
}

/**
 * Хук для удаления телефона клиента
 */
export function useDeleteClientPhone() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ clientId, phoneId }: { clientId: string; phoneId: string }) =>
      deleteClientPhone(clientId, phoneId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: clientPhonesKeys.list(variables.clientId) });
      queryClient.invalidateQueries({ queryKey: ['clients', 'detail', variables.clientId] });
    },
  });
}

