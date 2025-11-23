/**
 * React Query хуки для работы с конфигурациями импорта
 * 
 * Предоставляет хуки для управления конфигурациями импорта клиентов.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getImportConfigs,
  getImportConfig,
  getDefaultImportConfig,
  createImportConfig,
  updateImportConfig,
  deleteImportConfig,
  createConfigFromTemplate,
  type ImportConfig,
} from '@/utils/api';

/**
 * Ключи для React Query кэша
 */
export const importConfigsKeys = {
  all: ['importConfigs'] as const,
  lists: () => [...importConfigsKeys.all, 'list'] as const,
  list: (includeTemplates?: boolean) => [...importConfigsKeys.lists(), includeTemplates] as const,
  details: () => [...importConfigsKeys.all, 'detail'] as const,
  detail: (id: string) => [...importConfigsKeys.details(), id] as const,
  default: () => [...importConfigsKeys.all, 'default'] as const,
};

/**
 * Хук для получения списка конфигураций импорта
 * 
 * @param includeTemplates - Включить предустановленные шаблоны
 */
export function useImportConfigs(includeTemplates = false) {
  return useQuery({
    queryKey: importConfigsKeys.list(includeTemplates),
    queryFn: () => getImportConfigs(includeTemplates),
    staleTime: 30 * 1000,
    retry: false,
  });
}

/**
 * Хук для получения конфигурации по ID
 * 
 * @param configId - ID конфигурации
 */
export function useImportConfig(configId: string | null) {
  return useQuery({
    queryKey: importConfigsKeys.detail(configId || ''),
    queryFn: () => (configId ? getImportConfig(configId) : null),
    enabled: !!configId,
    staleTime: 30 * 1000,
    retry: false,
  });
}

/**
 * Хук для получения конфигурации по умолчанию
 */
export function useDefaultImportConfig() {
  return useQuery({
    queryKey: importConfigsKeys.default(),
    queryFn: () => getDefaultImportConfig(),
    staleTime: 30 * 1000,
    retry: false,
  });
}

/**
 * Хук для создания конфигурации
 */
export function useCreateImportConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (config: Omit<ImportConfig, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) =>
      createImportConfig(config),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: importConfigsKeys.lists() });
      queryClient.invalidateQueries({ queryKey: importConfigsKeys.default() });
    },
  });
}

/**
 * Хук для обновления конфигурации
 */
export function useUpdateImportConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ configId, config }: { configId: string; config: Partial<Omit<ImportConfig, 'id' | 'userId' | 'createdAt' | 'updatedAt'>> }) =>
      updateImportConfig(configId, config),
    onSuccess: (updatedConfig) => {
      queryClient.invalidateQueries({ queryKey: importConfigsKeys.lists() });
      queryClient.invalidateQueries({ queryKey: importConfigsKeys.detail(updatedConfig.id || '') });
      queryClient.invalidateQueries({ queryKey: importConfigsKeys.default() });
    },
  });
}

/**
 * Хук для удаления конфигурации
 */
export function useDeleteImportConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (configId: string) => deleteImportConfig(configId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: importConfigsKeys.lists() });
      queryClient.invalidateQueries({ queryKey: importConfigsKeys.default() });
    },
  });
}

/**
 * Хук для создания конфигурации из шаблона
 */
export function useCreateConfigFromTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ templateName, customName }: { templateName: string; customName?: string }) =>
      createConfigFromTemplate(templateName, customName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: importConfigsKeys.lists() });
    },
  });
}

