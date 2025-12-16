import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getGlobalSettings,
  updateGlobalSettings,
  getAllLimits,
  setUserLimits,
  getUserLimits,
} from '@/utils/campaign-admin-api';
import type {
  CampaignGlobalSettings,
  UpdateGlobalSettingsInput,
  UserCampaignLimits,
  SetUserLimitsInput,
} from '@/types/campaign';
import type { ApiError } from '@/types';

const settingsKeys = {
  settings: ['campaignSettings'] as const,
  limits: ['campaignLimits'] as const,
  userLimits: (userId: string) => ['campaignLimits', userId] as const,
};

/**
 * Получить глобальные настройки кампаний (ROOT)
 */
export function useCampaignSettings() {
  return useQuery<CampaignGlobalSettings, ApiError>({
    queryKey: settingsKeys.settings,
    queryFn: getGlobalSettings,
  });
}

/**
 * Обновить глобальные настройки кампаний (ROOT)
 */
export function useUpdateCampaignSettings() {
  const queryClient = useQueryClient();

  return useMutation<CampaignGlobalSettings, ApiError, UpdateGlobalSettingsInput>({
    mutationFn: updateGlobalSettings,
    onSuccess: (data) => {
      queryClient.setQueryData(settingsKeys.settings, data);
    },
  });
}

/**
 * Получить лимиты всех пользователей (ROOT)
 */
export function useAllCampaignLimits() {
  return useQuery<UserCampaignLimits[], ApiError>({
    queryKey: settingsKeys.limits,
    queryFn: getAllLimits,
  });
}

/**
 * Получить лимиты конкретного пользователя (ROOT)
 */
export function useUserCampaignLimits(userId: string | undefined) {
  return useQuery<UserCampaignLimits, ApiError>({
    queryKey: userId ? settingsKeys.userLimits(userId) : [],
    queryFn: () => getUserLimits(userId as string),
    enabled: !!userId,
  });
}

/**
 * Установить лимиты пользователя (ROOT)
 */
export function useSetUserCampaignLimits() {
  const queryClient = useQueryClient();

  return useMutation<
    UserCampaignLimits,
    ApiError,
    { userId: string; input: SetUserLimitsInput }
  >({
    mutationFn: ({ userId, input }) => setUserLimits(userId, input),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: settingsKeys.limits });
      queryClient.setQueryData(settingsKeys.userLimits(data.userId), data);
    },
  });
}




