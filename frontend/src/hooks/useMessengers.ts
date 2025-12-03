/**
 * React Query хуки для управления аккаунтами мессенджеров
 * 
 * Предоставляет хуки для работы с API управления аккаунтами мессенджеров:
 * - useMessengerServices - получение списка мессенджеров (справочник)
 * - useMessengerService - получение мессенджера по ID
 * - useMessengerAccounts - получение аккаунтов мессенджеров профиля
 * - useMessengerAccount - получение аккаунта мессенджера по ID
 * - useCreateMessengerAccount - создание аккаунта мессенджера
 * - useUpdateMessengerAccount - обновление аккаунта мессенджера
 * - useDeleteMessengerAccount - удаление аккаунта мессенджера
 * - useEnableMessengerAccount - включение мессенджера для профиля
 * - useDisableMessengerAccount - выключение мессенджера для профиля
 * - useCheckMessengerAccountStatus - проверка статуса входа аккаунта
 * - useMessengerCheckConfigs - получение всех конфигураций проверки (ROOT only)
 * - useMessengerCheckConfig - получение конфигурации проверки по serviceId (ROOT only)
 * - useUpdateMessengerCheckConfig - обновление конфигурации проверки (ROOT only)
 */

import { useQuery, useMutation, useQueryClient, type UseQueryOptions } from '@tanstack/react-query';
import {
  getAllMessengerServices,
  getMessengerServiceById,
  getMessengerAccountsByProfile,
  getMessengerAccountById,
  createMessengerAccount,
  updateMessengerAccount,
  deleteMessengerAccount,
  enableMessengerAccount,
  disableMessengerAccount,
  checkMessengerAccountStatus,
  submitCloudPassword,
  getAllMessengerCheckConfigs,
  getMessengerCheckConfigByServiceId,
  updateMessengerCheckConfig,
  type CloudPasswordResult,
} from '@/utils/api';
import type {
  MessengerService,
  ProfileMessengerAccount,
  MessengerCheckConfig,
  LoginCheckResult,
  CreateMessengerAccountInput,
  UpdateMessengerAccountInput,
  UpdateMessengerCheckConfigInput,
} from '@/types';

/**
 * Ключи для React Query кэша
 */
const messengersKeysBase = ['messengers'] as const;

export const messengersKeys = {
  all: messengersKeysBase,
  services: {
    all: [...messengersKeysBase, 'services'] as const,
    lists: () => [...messengersKeysBase, 'services', 'list'] as const,
    list: () => [...messengersKeysBase, 'services', 'list'] as const,
    details: () => [...messengersKeysBase, 'services', 'detail'] as const,
    detail: (id: string) => [...messengersKeysBase, 'services', 'detail', id] as const,
  },
  accounts: {
    all: [...messengersKeysBase, 'accounts'] as const,
    lists: () => [...messengersKeysBase, 'accounts', 'list'] as const,
    list: (profileId: string) => [...messengersKeysBase, 'accounts', 'list', profileId] as const,
    details: () => [...messengersKeysBase, 'accounts', 'detail'] as const,
    detail: (profileId: string, accountId: string) =>
      [...messengersKeysBase, 'accounts', 'detail', profileId, accountId] as const,
    status: (profileId: string, accountId: string) =>
      [...messengersKeysBase, 'accounts', 'detail', profileId, accountId, 'status'] as const,
  },
  checkConfigs: {
    all: [...messengersKeysBase, 'check-configs'] as const,
    lists: () => [...messengersKeysBase, 'check-configs', 'list'] as const,
    list: () => [...messengersKeysBase, 'check-configs', 'list'] as const,
    details: () => [...messengersKeysBase, 'check-configs', 'detail'] as const,
    detail: (serviceId: string) => [...messengersKeysBase, 'check-configs', 'detail', serviceId] as const,
  },
};

/**
 * Хук для получения всех мессенджеров (справочник)
 * 
 * @param options - Дополнительные опции useQuery
 */
export function useMessengerServices(
  options?: Omit<UseQueryOptions<MessengerService[]>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: messengersKeys.services.list(),
    queryFn: () => getAllMessengerServices(),
    staleTime: 60 * 1000, // Данные актуальны 1 минуту (справочник редко меняется)
    retry: false,
    ...options,
  });
}

/**
 * Хук для получения мессенджера по ID
 * 
 * @param serviceId - ID мессенджера
 * @param options - Дополнительные опции useQuery
 */
export function useMessengerService(
  serviceId: string,
  options?: Omit<UseQueryOptions<MessengerService>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: messengersKeys.services.detail(serviceId),
    queryFn: () => getMessengerServiceById(serviceId),
    enabled: !!serviceId,
    staleTime: 60 * 1000,
    retry: false,
    ...options,
  });
}

/**
 * Хук для получения всех аккаунтов мессенджеров профиля
 * 
 * @param profileId - ID профиля
 * @param options - Дополнительные опции useQuery
 */
export function useMessengerAccounts(
  profileId: string,
  options?: Omit<UseQueryOptions<ProfileMessengerAccount[]>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: messengersKeys.accounts.list(profileId),
    queryFn: () => getMessengerAccountsByProfile(profileId),
    enabled: !!profileId,
    staleTime: 30 * 1000, // Данные актуальны 30 секунд
    retry: false,
    ...options,
  });
}

/**
 * Хук для получения аккаунта мессенджера по ID
 * 
 * @param profileId - ID профиля
 * @param accountId - ID аккаунта
 * @param options - Дополнительные опции useQuery
 */
export function useMessengerAccount(
  profileId: string,
  accountId: string,
  options?: Omit<UseQueryOptions<ProfileMessengerAccount>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: messengersKeys.accounts.detail(profileId, accountId),
    queryFn: () => getMessengerAccountById(profileId, accountId),
    enabled: !!profileId && !!accountId,
    staleTime: 30 * 1000,
    retry: false,
    ...options,
  });
}

/**
 * Хук для создания аккаунта мессенджера
 * 
 * Автоматически обновляет кэш аккаунтов профиля после успешного создания.
 */
export function useCreateMessengerAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      profileId,
      accountData,
    }: {
      profileId: string;
      accountData: CreateMessengerAccountInput;
    }) => createMessengerAccount(profileId, accountData),
    onSuccess: (_, variables) => {
      // Инвалидируем кэш аккаунтов профиля
      queryClient.invalidateQueries({ queryKey: messengersKeys.accounts.list(variables.profileId) });
    },
  });
}

/**
 * Хук для обновления аккаунта мессенджера
 * 
 * Автоматически обновляет кэш аккаунтов профиля и конкретного аккаунта после успешного обновления.
 */
export function useUpdateMessengerAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      profileId,
      accountId,
      accountData,
    }: {
      profileId: string;
      accountId: string;
      accountData: UpdateMessengerAccountInput;
    }) => updateMessengerAccount(profileId, accountId, accountData),
    onSuccess: (updatedAccount: ProfileMessengerAccount, variables) => {
      // Обновляем кэш конкретного аккаунта
      queryClient.setQueryData(
        messengersKeys.accounts.detail(variables.profileId, updatedAccount.id),
        updatedAccount
      );
      // Инвалидируем кэш списка аккаунтов профиля
      queryClient.invalidateQueries({ queryKey: messengersKeys.accounts.list(variables.profileId) });
    },
  });
}

/**
 * Хук для удаления аккаунта мессенджера
 * 
 * Автоматически обновляет кэш аккаунтов профиля после успешного удаления.
 */
export function useDeleteMessengerAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ profileId, accountId }: { profileId: string; accountId: string }) =>
      deleteMessengerAccount(profileId, accountId),
    onSuccess: (_, variables) => {
      // Инвалидируем кэш аккаунтов профиля
      queryClient.invalidateQueries({ queryKey: messengersKeys.accounts.list(variables.profileId) });
      // Удаляем кэш конкретного аккаунта
      queryClient.removeQueries({
        queryKey: messengersKeys.accounts.detail(variables.profileId, variables.accountId),
      });
    },
  });
}

/**
 * Хук для включения мессенджера для профиля
 * 
 * Автоматически обновляет кэш аккаунтов профиля после успешного включения.
 */
export function useEnableMessengerAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ profileId, accountId }: { profileId: string; accountId: string }) =>
      enableMessengerAccount(profileId, accountId),
    onSuccess: (updatedAccount: ProfileMessengerAccount, variables) => {
      // Обновляем кэш конкретного аккаунта
      queryClient.setQueryData(
        messengersKeys.accounts.detail(variables.profileId, updatedAccount.id),
        updatedAccount
      );
      // Инвалидируем кэш списка аккаунтов профиля
      queryClient.invalidateQueries({ queryKey: messengersKeys.accounts.list(variables.profileId) });
    },
  });
}

/**
 * Хук для выключения мессенджера для профиля
 * 
 * Автоматически обновляет кэш аккаунтов профиля после успешного выключения.
 */
export function useDisableMessengerAccount() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ profileId, accountId }: { profileId: string; accountId: string }) =>
      disableMessengerAccount(profileId, accountId),
    onSuccess: (updatedAccount: ProfileMessengerAccount, variables) => {
      // Обновляем кэш конкретного аккаунта
      queryClient.setQueryData(
        messengersKeys.accounts.detail(variables.profileId, updatedAccount.id),
        updatedAccount
      );
      // Инвалидируем кэш списка аккаунтов профиля
      queryClient.invalidateQueries({ queryKey: messengersKeys.accounts.list(variables.profileId) });
    },
  });
}

/**
 * Хук для проверки статуса входа аккаунта мессенджера
 * 
 * Это mutation, так как проверка выполняется через POST запрос.
 */
export function useCheckMessengerAccountStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ profileId, accountId }: { profileId: string; accountId: string }) =>
      checkMessengerAccountStatus(profileId, accountId),
    onSuccess: (result: LoginCheckResult, variables) => {
      // Инвалидируем кэш аккаунтов профиля для обновления статуса
      queryClient.invalidateQueries({ queryKey: messengersKeys.accounts.list(variables.profileId) });
      queryClient.invalidateQueries({
        queryKey: messengersKeys.accounts.detail(variables.profileId, variables.accountId),
      });
    },
  });
}

/**
 * Хук для ввода облачного пароля (2FA) для Telegram
 * 
 * Автоматически обновляет кэш аккаунтов после успешного ввода пароля.
 */
export function useSubmitCloudPassword() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      profileId,
      accountId,
      password,
    }: {
      profileId: string;
      accountId: string;
      password: string;
    }) => submitCloudPassword(profileId, accountId, password),
    onSuccess: (result: CloudPasswordResult, variables) => {
      // Инвалидируем кэш аккаунтов профиля для обновления статуса
      queryClient.invalidateQueries({ queryKey: messengersKeys.accounts.list(variables.profileId) });
      queryClient.invalidateQueries({
        queryKey: messengersKeys.accounts.detail(variables.profileId, variables.accountId),
      });
    },
  });
}

/**
 * Хук для получения всех конфигураций проверки (ROOT only)
 * 
 * @param options - Дополнительные опции useQuery
 */
export function useMessengerCheckConfigs(
  options?: Omit<UseQueryOptions<MessengerCheckConfig[]>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: messengersKeys.checkConfigs.list(),
    queryFn: () => getAllMessengerCheckConfigs(),
    staleTime: 60 * 1000, // Данные актуальны 1 минуту
    retry: false,
    ...options,
  });
}

/**
 * Хук для получения конфигурации проверки по serviceId (ROOT only)
 * 
 * @param serviceId - ID мессенджера
 * @param options - Дополнительные опции useQuery
 */
export function useMessengerCheckConfig(
  serviceId: string,
  options?: Omit<UseQueryOptions<MessengerCheckConfig>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: messengersKeys.checkConfigs.detail(serviceId),
    queryFn: () => getMessengerCheckConfigByServiceId(serviceId),
    enabled: !!serviceId,
    staleTime: 60 * 1000,
    retry: false,
    ...options,
  });
}

/**
 * Хук для обновления конфигурации проверки (ROOT only)
 * 
 * Автоматически обновляет кэш конфигураций после успешного обновления.
 */
export function useUpdateMessengerCheckConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      serviceId,
      configData,
    }: {
      serviceId: string;
      configData: UpdateMessengerCheckConfigInput;
    }) => updateMessengerCheckConfig(serviceId, configData),
    onSuccess: (updatedConfig: MessengerCheckConfig, variables) => {
      // Обновляем кэш конкретной конфигурации
      queryClient.setQueryData(messengersKeys.checkConfigs.detail(variables.serviceId), updatedConfig);
      // Инвалидируем кэш списка конфигураций
      queryClient.invalidateQueries({ queryKey: messengersKeys.checkConfigs.list() });
    },
  });
}

