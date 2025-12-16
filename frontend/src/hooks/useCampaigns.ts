/**
 * React Query хуки для модуля кампаний
 * 
 * Предоставляет хуки для:
 * - Получения списка и отдельной кампании
 * - Создания, обновления, удаления кампаний
 * - Действий с кампаниями (start, pause, resume, cancel)
 * - Мониторинга (progress, messages, logs, stats)
 * - Экспорта
 */

import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryOptions,
} from '@tanstack/react-query';
import { useCampaignWebSocket } from './useCampaignWebSocket';
import { useEffect, useRef } from 'react';
import { wsService } from '@/utils/websocket';
import {
  listCampaigns,
  getCampaign,
  createCampaign,
  updateCampaign,
  deleteCampaign,
  duplicateCampaign,
  archiveCampaign,
  startCampaign,
  pauseCampaign,
  resumeCampaign,
  cancelCampaign,
  getCampaignProgress,
  getCampaignMessages,
  getCampaignLogs,
  getCampaignStats,
  exportCampaign,
  updateCampaignProfiles,
  getCampaignProfiles,
  validateCampaign,
  calculateContacts,
} from '@/utils/campaigns-api';
import type {
  Campaign,
  CampaignProfile,
  CampaignProgress,
  CampaignStats,
  CampaignsListResponse,
  MessagesListResponse,
  LogsListResponse,
  ListCampaignsQuery,
  ListMessagesQuery,
  ListLogsQuery,
  CreateCampaignInput,
  UpdateCampaignInput,
  StartCampaignInput,
  DuplicateCampaignInput,
  UpdateCampaignProfilesInput,
  CampaignValidationResult,
  CalculatedContacts,
} from '@/types/campaign';
import type { ApiError } from '@/types';

// ============================================
// Query Keys
// ============================================

export const campaignsKeys = {
  all: ['campaigns'] as const,
  lists: () => [...campaignsKeys.all, 'list'] as const,
  list: (query: ListCampaignsQuery) => [...campaignsKeys.lists(), query] as const,
  details: () => [...campaignsKeys.all, 'detail'] as const,
  detail: (id: string) => [...campaignsKeys.details(), id] as const,
  progress: (id: string) => [...campaignsKeys.detail(id), 'progress'] as const,
  messages: (id: string, query?: ListMessagesQuery) => [...campaignsKeys.detail(id), 'messages', query] as const,
  logs: (id: string, query?: ListLogsQuery) => [...campaignsKeys.detail(id), 'logs', query] as const,
  stats: (id: string) => [...campaignsKeys.detail(id), 'stats'] as const,
  profiles: (id: string) => [...campaignsKeys.detail(id), 'profiles'] as const,
  validation: (id: string) => [...campaignsKeys.detail(id), 'validation'] as const,
  contacts: (id: string) => [...campaignsKeys.detail(id), 'contacts'] as const,
};

// ============================================
// Campaign List Hooks
// ============================================

/**
 * Получение списка кампаний
 */
export function useCampaigns(
  query: ListCampaignsQuery = {},
  options?: Omit<UseQueryOptions<CampaignsListResponse, ApiError>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: campaignsKeys.list(query),
    queryFn: () => listCampaigns(query),
    ...options,
  });
}

/**
 * Получение одной кампании по ID
 */
export function useCampaign(
  campaignId: string | undefined,
  options?: Omit<UseQueryOptions<Campaign, ApiError>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: campaignsKeys.detail(campaignId ?? ''),
    queryFn: () => {
      if (!campaignId) {
        throw new Error('campaignId is required');
      }
      return getCampaign(campaignId);
    },
    enabled: !!campaignId,
    ...options,
  });
}

// ============================================
// Campaign CRUD Hooks
// ============================================

/**
 * Создание кампании
 */
export function useCreateCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateCampaignInput) => createCampaign(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: campaignsKeys.lists() });
    },
  });
}

/**
 * Обновление кампании
 */
export function useUpdateCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ campaignId, input }: { campaignId: string; input: UpdateCampaignInput }) =>
      updateCampaign(campaignId, input),
    onSuccess: (data) => {
      queryClient.setQueryData(campaignsKeys.detail(data.id), data);
      queryClient.invalidateQueries({ queryKey: campaignsKeys.lists() });
    },
  });
}

/**
 * Удаление кампании
 */
export function useDeleteCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (campaignId: string) => deleteCampaign(campaignId),
    onSuccess: (_, campaignId) => {
      queryClient.removeQueries({ queryKey: campaignsKeys.detail(campaignId) });
      queryClient.invalidateQueries({ queryKey: campaignsKeys.lists() });
    },
  });
}

/**
 * Дублирование кампании
 */
export function useDuplicateCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ campaignId, input }: { campaignId: string; input?: DuplicateCampaignInput }) =>
      duplicateCampaign(campaignId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: campaignsKeys.lists() });
    },
  });
}

/**
 * Архивирование кампании
 */
export function useArchiveCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (campaignId: string) => archiveCampaign(campaignId),
    onSuccess: (data) => {
      queryClient.setQueryData(campaignsKeys.detail(data.id), data);
      queryClient.invalidateQueries({ queryKey: campaignsKeys.lists() });
    },
  });
}

// ============================================
// Campaign Action Hooks
// ============================================

/**
 * Запуск кампании
 */
export function useStartCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ campaignId, input }: { campaignId: string; input?: StartCampaignInput }) =>
      startCampaign(campaignId, input),
    onSuccess: (data) => {
      queryClient.setQueryData(campaignsKeys.detail(data.id), data);
      queryClient.invalidateQueries({ queryKey: campaignsKeys.lists() });
    },
  });
}

/**
 * Пауза кампании
 */
export function usePauseCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (campaignId: string) => pauseCampaign(campaignId),
    onSuccess: (data) => {
      queryClient.setQueryData(campaignsKeys.detail(data.id), data);
      queryClient.invalidateQueries({ queryKey: campaignsKeys.lists() });
    },
  });
}

/**
 * Возобновление кампании
 */
export function useResumeCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (campaignId: string) => resumeCampaign(campaignId),
    onSuccess: (data) => {
      queryClient.setQueryData(campaignsKeys.detail(data.id), data);
      queryClient.invalidateQueries({ queryKey: campaignsKeys.lists() });
    },
  });
}

/**
 * Отмена кампании
 */
export function useCancelCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (campaignId: string) => cancelCampaign(campaignId),
    onSuccess: (data) => {
      queryClient.setQueryData(campaignsKeys.detail(data.id), data);
      queryClient.invalidateQueries({ queryKey: campaignsKeys.lists() });
    },
  });
}

// ============================================
// Campaign Monitoring Hooks
// ============================================

/**
 * Получение прогресса кампании
 */
export function useCampaignProgress(
  campaignId: string | undefined,
  options?: Omit<UseQueryOptions<CampaignProgress, ApiError>, 'queryKey' | 'queryFn'>,
  useWs: boolean = true
) {
  const queryClient = useQueryClient();
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useCampaignWebSocket(campaignId, {
    onProgress: (data) => {
      if (!campaignId || !data) return;
      if (data.campaignId && data.campaignId !== campaignId) return;
      queryClient.setQueryData(campaignsKeys.progress(campaignId), (prev: CampaignProgress | undefined) => ({
        ...(prev || {
          campaignId,
          status: 'RUNNING',
          totalContacts: 0,
          processedContacts: 0,
          successfulContacts: 0,
          failedContacts: 0,
          skippedContacts: 0,
          progressPercent: 0,
          contactsPerMinute: 0,
          estimatedSecondsRemaining: null,
          estimatedCompletionTime: null,
          profilesProgress: [],
          startedAt: null,
          lastUpdateAt: new Date().toISOString(),
        }),
        ...data,
      }));
    },
    onStatus: (data) => {
      if (!campaignId || !data) return;
      if (data.campaignId && data.campaignId !== campaignId) return;
      queryClient.setQueryData(campaignsKeys.detail(campaignId), (prev: Campaign | undefined) =>
        prev ? { ...prev, status: data.status } : prev
      );
    },
  });

  const queryResult = useQuery({
    queryKey: campaignsKeys.progress(campaignId ?? ''),
    queryFn: () => {
      if (!campaignId) {
        throw new Error('campaignId is required');
      }
      return getCampaignProgress(campaignId);
    },
    enabled: !!campaignId,
    refetchInterval: useWs ? false : 5000,
    ...options,
  });

  // Fallback на polling при разрыве WS
  useEffect(() => {
    if (!useWs || !campaignId) return;

    const startPolling = () => {
      if (pollRef.current) return;
      pollRef.current = setInterval(() => {
        void queryResult.refetch();
      }, 5000);
    };

    const stopPolling = () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };

    const handleOpen = () => stopPolling();
    const handleClose = () => startPolling();

    // Если уже не подключено — запускаем polling
    if (wsService.status === 'disconnected') {
      startPolling();
    }

    wsService.subscribe('open', handleOpen);
    wsService.subscribe('close', handleClose);

    return () => {
      wsService.unsubscribe('open', handleOpen);
      wsService.unsubscribe('close', handleClose);
      stopPolling();
    };
    // queryResult.refetch стабилен, но eslint может жаловаться - это нормально для refetch
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId, useWs]);

  return queryResult;
}

/**
 * Получение сообщений кампании
 */
export function useCampaignMessages(
  campaignId: string | undefined,
  query?: ListMessagesQuery,
  options?: Omit<UseQueryOptions<MessagesListResponse, ApiError>, 'queryKey' | 'queryFn'>,
  useWs: boolean = true
) {
  const queryClient = useQueryClient();
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useCampaignWebSocket(campaignId, useWs ? {
    onMessage: (data) => {
      if (!campaignId || !data) return;
      if (data.campaignId && data.campaignId !== campaignId) return;
      // Инвалидируем список сообщений и статистику, чтобы подтянуть актуальные данные
      if (campaignId) {
        queryClient.invalidateQueries({ queryKey: campaignsKeys.messages(campaignId, query) });
        queryClient.invalidateQueries({ queryKey: campaignsKeys.stats(campaignId) });
        queryClient.invalidateQueries({ queryKey: campaignsKeys.progress(campaignId) });
      }
    },
  } : {});

  const queryResult = useQuery({
    queryKey: campaignsKeys.messages(campaignId ?? '', query),
    queryFn: () => {
      if (!campaignId) {
        throw new Error('campaignId is required');
      }
      return getCampaignMessages(campaignId, query);
    },
    enabled: !!campaignId,
    refetchInterval: useWs ? false : 5000,
    ...options,
  });

  // Fallback на polling при разрыве WS
  useEffect(() => {
    if (!useWs || !campaignId) return;

    const startPolling = () => {
      if (pollRef.current) return;
      pollRef.current = setInterval(() => {
        void queryResult.refetch();
      }, 5000);
    };

    const stopPolling = () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };

    const handleOpen = () => stopPolling();
    const handleClose = () => startPolling();

    if (wsService.status === 'disconnected') {
      startPolling();
    }

    wsService.subscribe('open', handleOpen);
    wsService.subscribe('close', handleClose);

    return () => {
      wsService.unsubscribe('open', handleOpen);
      wsService.unsubscribe('close', handleClose);
      stopPolling();
    };
    // queryResult.refetch стабилен, но eslint может жаловаться - это нормально для refetch
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId, useWs]);

  return queryResult;
}

/**
 * Получение логов кампании
 */
export function useCampaignLogs(
  campaignId: string | undefined,
  query?: ListLogsQuery,
  options?: Omit<UseQueryOptions<LogsListResponse, ApiError>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: campaignsKeys.logs(campaignId ?? '', query),
    queryFn: () => {
      if (!campaignId) {
        throw new Error('campaignId is required');
      }
      return getCampaignLogs(campaignId, query);
    },
    enabled: !!campaignId,
    ...options,
  });
}

/**
 * Получение статистики кампании
 */
export function useCampaignStats(
  campaignId: string | undefined,
  options?: Omit<UseQueryOptions<CampaignStats, ApiError>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: campaignsKeys.stats(campaignId ?? ''),
    queryFn: () => {
      if (!campaignId) {
        throw new Error('campaignId is required');
      }
      return getCampaignStats(campaignId);
    },
    enabled: !!campaignId,
    ...options,
  });
}

/**
 * Экспорт кампании
 */
export function useExportCampaign() {
  return useMutation({
    mutationFn: (campaignId: string) => exportCampaign(campaignId),
    onSuccess: (blob, campaignId) => {
      // Создаем ссылку для скачивания
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `campaign_${campaignId}_export.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    },
  });
}

// ============================================
// Campaign Profiles Hooks
// ============================================

/**
 * Получение профилей кампании
 */
export function useCampaignProfiles(
  campaignId: string | undefined,
  options?: Omit<UseQueryOptions<CampaignProfile[], ApiError>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: campaignsKeys.profiles(campaignId ?? ''),
    queryFn: () => {
      if (!campaignId) {
        throw new Error('campaignId is required');
      }
      return getCampaignProfiles(campaignId);
    },
    enabled: !!campaignId,
    ...options,
  });
}

/**
 * Обновление профилей кампании
 */
export function useUpdateCampaignProfiles() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ campaignId, input }: { campaignId: string; input: UpdateCampaignProfilesInput }) =>
      updateCampaignProfiles(campaignId, input),
    onSuccess: (_, { campaignId }) => {
      queryClient.invalidateQueries({ queryKey: campaignsKeys.profiles(campaignId) });
      queryClient.invalidateQueries({ queryKey: campaignsKeys.detail(campaignId) });
    },
  });
}

// ============================================
// Campaign Validation Hooks
// ============================================

/**
 * Валидация кампании
 */
export function useCampaignValidation(
  campaignId: string | undefined,
  options?: Omit<UseQueryOptions<CampaignValidationResult, ApiError>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: campaignsKeys.validation(campaignId ?? ''),
    queryFn: () => {
      if (!campaignId) {
        throw new Error('campaignId is required');
      }
      return validateCampaign(campaignId);
    },
    enabled: !!campaignId,
    staleTime: 0, // Всегда свежие данные
    ...options,
  });
}

/**
 * Мутация для валидации кампании (для ручного вызова)
 */
export function useValidateCampaignMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (campaignId: string) => validateCampaign(campaignId),
    onSuccess: (data, campaignId) => {
      queryClient.setQueryData(campaignsKeys.validation(campaignId), data);
    },
  });
}

/**
 * Расчёт количества контактов
 */
export function useCampaignContacts(
  campaignId: string | undefined,
  options?: Omit<UseQueryOptions<CalculatedContacts, ApiError>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: campaignsKeys.contacts(campaignId ?? ''),
    queryFn: () => {
      if (!campaignId) {
        throw new Error('campaignId is required');
      }
      return calculateContacts(campaignId);
    },
    enabled: !!campaignId,
    ...options,
  });
}

/**
 * Мутация для расчёта контактов (для ручного вызова)
 */
export function useCalculateContactsMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (campaignId: string) => calculateContacts(campaignId),
    onSuccess: (data, campaignId) => {
      queryClient.setQueryData(campaignsKeys.contacts(campaignId), data);
    },
  });
}

// ============================================
// Utility Hooks
// ============================================

/**
 * Инвалидация всех данных кампаний
 */
export function useInvalidateCampaigns() {
  const queryClient = useQueryClient();

  return () => {
    queryClient.invalidateQueries({ queryKey: campaignsKeys.all });
  };
}

/**
 * Prefetch кампании
 */
export function usePrefetchCampaign() {
  const queryClient = useQueryClient();

  return (campaignId: string) => {
    queryClient.prefetchQuery({
      queryKey: campaignsKeys.detail(campaignId),
      queryFn: () => getCampaign(campaignId),
    });
  };
}

