/**
 * API функции для админ-операций кампаний (ROOT)
 *
 * Предоставляет:
 * - Чтение/обновление глобальных настроек кампаний
 * - Чтение/установка лимитов пользователей
 */

import { API_BASE_URL } from '@/config';
import type { ApiError } from '@/types';
import type {
  CampaignGlobalSettings,
  UpdateGlobalSettingsInput,
  UserCampaignLimits,
  SetUserLimitsInput,
  AdminCampaignsListResponse,
} from '@/types/campaign';
import {
  createHeaders,
  fetchWithAutoRefresh,
  handleResponse,
} from './campaigns-api';

const ADMIN_BASE = `${API_BASE_URL}/admin/campaigns`;

/**
 * Получить глобальные настройки кампаний
 */
export async function getGlobalSettings(): Promise<CampaignGlobalSettings> {
  const response = await fetchWithAutoRefresh(`${ADMIN_BASE}/settings`, {
    method: 'GET',
    headers: createHeaders(),
  });

  return handleResponse<CampaignGlobalSettings>(response);
}

/**
 * Обновить глобальные настройки кампаний
 */
export async function updateGlobalSettings(
  input: UpdateGlobalSettingsInput
): Promise<CampaignGlobalSettings> {
  const response = await fetchWithAutoRefresh(`${ADMIN_BASE}/settings`, {
    method: 'PUT',
    headers: createHeaders(),
    body: JSON.stringify(input),
  });

  return handleResponse<CampaignGlobalSettings>(response);
}

/**
 * Получить все лимиты пользователей
 */
export async function getAllLimits(): Promise<UserCampaignLimits[]> {
  const response = await fetchWithAutoRefresh(`${ADMIN_BASE}/limits`, {
    method: 'GET',
    headers: createHeaders(),
  });

  return handleResponse<UserCampaignLimits[]>(response);
}

/**
 * Получить лимиты конкретного пользователя
 */
export async function getUserLimits(
  userId: string
): Promise<UserCampaignLimits> {
  const response = await fetchWithAutoRefresh(`${ADMIN_BASE}/limits/${userId}`, {
    method: 'GET',
    headers: createHeaders(),
  });

  return handleResponse<UserCampaignLimits>(response);
}

/**
 * Установить лимиты пользователя
 */
export async function setUserLimits(
  userId: string,
  input: SetUserLimitsInput
): Promise<UserCampaignLimits> {
  const response = await fetchWithAutoRefresh(`${ADMIN_BASE}/limits/${userId}`, {
    method: 'PUT',
    headers: createHeaders(),
    body: JSON.stringify(input),
  });

  return handleResponse<UserCampaignLimits>(response);
}

/**
 * Отменить любую кампанию (для ROOT)
 */
export async function cancelAnyCampaign(campaignId: string): Promise<{ success: boolean; message?: string }> {
  const response = await fetchWithAutoRefresh(`${ADMIN_BASE}/${campaignId}/cancel`, {
    method: 'POST',
    headers: createHeaders(),
  });

  return handleResponse<{ success: boolean; message?: string }>(response);
}

/**
 * Получить все кампании (ROOT)
 */
export async function getAllCampaigns(params?: { status?: string; userId?: string; page?: number; limit?: number }): Promise<AdminCampaignsListResponse> {
  const searchParams = new URLSearchParams();
  if (params?.status) searchParams.set('status', params.status);
  if (params?.userId) searchParams.set('userId', params.userId);
  if (params?.page) searchParams.set('page', String(params.page));
  if (params?.limit) searchParams.set('limit', String(params.limit));

  const qs = searchParams.toString();
  const url = qs ? `${ADMIN_BASE}/all?${qs}` : `${ADMIN_BASE}/all`;

  const response = await fetchWithAutoRefresh(url, {
    method: 'GET',
    headers: createHeaders(),
  });

  return handleResponse<AdminCampaignsListResponse>(response);
}

