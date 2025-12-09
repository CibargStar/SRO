/**
 * API функции для модуля кампаний
 * 
 * Предоставляет функции для работы с API кампаний:
 * - Кампании (CRUD + actions)
 * - Мониторинг (progress, messages, logs, stats)
 * - Экспорт
 */

import { API_BASE_URL } from '@/config';
import { useAuthStore } from '@/store';
import type { ApiError } from '@/types';
import type {
  Campaign,
  CampaignProfile,
  CampaignMessage,
  CampaignLog,
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
import { isValidJWTFormat, isTokenExpired } from './jwt';

/**
 * Механизм защиты от race conditions при refresh
 */
let refreshPromise: Promise<unknown> | null = null;

/**
 * Обработка ответа от API
 */
export async function handleResponse<T>(response: Response): Promise<T> {
  if (response.status === 204) {
    return {} as T;
  }

  const contentType = response.headers.get('content-type');
  const isJson = contentType?.includes('application/json');

  if (!response.ok) {
    let error: ApiError;
    if (isJson) {
      try {
        error = await response.json();
      } catch {
        error = { message: `HTTP ${response.status}: ${response.statusText}` };
      }
    } else {
      error = { message: `HTTP ${response.status}: ${response.statusText}` };
    }
    error.statusCode = response.status;
    throw error;
  }

  if (isJson) {
    try {
      return await response.json();
    } catch {
      throw { message: 'Invalid JSON response' } as ApiError;
    }
  }

  return {} as T;
}

/**
 * Создает заголовки для запроса
 */
export function createHeaders(accessToken?: string): HeadersInit {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  const token = accessToken || useAuthStore.getState().accessToken;

  if (token) {
    if (!isValidJWTFormat(token)) {
      throw { message: 'Invalid access token format' } as ApiError;
    }
    headers['Authorization'] = `Bearer ${token}`;
  }

  return headers;
}

/**
 * Выполняет fetch запрос с автоматическим refresh при 401
 */
export async function fetchWithAutoRefresh(url: string, options: RequestInit = {}): Promise<Response> {
  const { accessToken, refreshToken, updateTokens, clearAuth } = useAuthStore.getState();

  // Первая попытка запроса
  let response = await fetch(url, options);

  // Если 401 и есть refresh token - пробуем обновить
  if (response.status === 401 && refreshToken) {
    // Проверяем: если access token ещё не истёк, возможно ошибка в чём-то другом
    if (accessToken && !isTokenExpired(accessToken)) {
      return response;
    }

    // Защита от race conditions
    if (!refreshPromise) {
      refreshPromise = (async () => {
        try {
          const refreshResponse = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken }),
          });

          if (!refreshResponse.ok) {
            clearAuth();
            throw { message: 'Session expired', statusCode: 401 } as ApiError;
          }

          const data = await refreshResponse.json();
          updateTokens({
            accessToken: data.accessToken,
            refreshToken: data.refreshToken,
            expiresIn: data.expiresIn,
          });

          return data.accessToken;
        } finally {
          refreshPromise = null;
        }
      })();
    }

    try {
      const newAccessToken = (await refreshPromise) as string;

      // Повторяем оригинальный запрос с новым токеном
      const newHeaders = {
        ...Object.fromEntries(new Headers(options.headers).entries()),
        Authorization: `Bearer ${newAccessToken}`,
      };

      response = await fetch(url, { ...options, headers: newHeaders });
    } catch (error) {
      clearAuth();
      throw error;
    }
  }

  return response;
}

// ============================================
// Campaigns API
// ============================================

/**
 * Получить список кампаний
 */
export async function listCampaigns(query?: ListCampaignsQuery): Promise<CampaignsListResponse> {
  const params = new URLSearchParams();
  
  if (query?.page) params.set('page', String(query.page));
  if (query?.limit) params.set('limit', String(query.limit));
  if (query?.search) params.set('search', query.search);
  if (query?.status) {
    if (Array.isArray(query.status)) {
      query.status.forEach((s) => params.append('status', s));
    } else {
      params.set('status', query.status);
    }
  }
  if (query?.campaignType) params.set('campaignType', query.campaignType);
  if (query?.messengerType) params.set('messengerType', query.messengerType);
  if (query?.sortBy) params.set('sortBy', query.sortBy);
  if (query?.sortOrder) params.set('sortOrder', query.sortOrder);
  if (query?.includeArchived !== undefined) params.set('includeArchived', String(query.includeArchived));

  const queryString = params.toString();
  const url = `${API_BASE_URL}/api/campaigns${queryString ? `?${queryString}` : ''}`;

  const response = await fetchWithAutoRefresh(url, {
    method: 'GET',
    headers: createHeaders(),
  });

  return handleResponse<CampaignsListResponse>(response);
}

/**
 * Получить кампанию по ID
 */
export async function getCampaign(campaignId: string): Promise<Campaign> {
  const response = await fetchWithAutoRefresh(`${API_BASE_URL}/api/campaigns/${campaignId}`, {
    method: 'GET',
    headers: createHeaders(),
  });

  return handleResponse<Campaign>(response);
}

/**
 * Создать новую кампанию
 */
export async function createCampaign(input: CreateCampaignInput): Promise<Campaign> {
  const response = await fetchWithAutoRefresh(`${API_BASE_URL}/api/campaigns`, {
    method: 'POST',
    headers: createHeaders(),
    body: JSON.stringify(input),
  });

  return handleResponse<Campaign>(response);
}

/**
 * Обновить кампанию
 */
export async function updateCampaign(campaignId: string, input: UpdateCampaignInput): Promise<Campaign> {
  const response = await fetchWithAutoRefresh(`${API_BASE_URL}/api/campaigns/${campaignId}`, {
    method: 'PATCH',
    headers: createHeaders(),
    body: JSON.stringify(input),
  });

  return handleResponse<Campaign>(response);
}

/**
 * Удалить кампанию
 */
export async function deleteCampaign(campaignId: string): Promise<void> {
  const response = await fetchWithAutoRefresh(`${API_BASE_URL}/api/campaigns/${campaignId}`, {
    method: 'DELETE',
    headers: createHeaders(),
  });

  await handleResponse<void>(response);
}

/**
 * Дублировать кампанию
 */
export async function duplicateCampaign(campaignId: string, input?: DuplicateCampaignInput): Promise<Campaign> {
  const response = await fetchWithAutoRefresh(`${API_BASE_URL}/api/campaigns/${campaignId}/duplicate`, {
    method: 'POST',
    headers: createHeaders(),
    body: JSON.stringify(input || {}),
  });

  return handleResponse<Campaign>(response);
}

/**
 * Архивировать кампанию
 */
export async function archiveCampaign(campaignId: string): Promise<Campaign> {
  const response = await fetchWithAutoRefresh(`${API_BASE_URL}/api/campaigns/${campaignId}/archive`, {
    method: 'POST',
    headers: createHeaders(),
  });

  return handleResponse<Campaign>(response);
}

// ============================================
// Campaign Actions API
// ============================================

/**
 * Запустить кампанию
 */
export async function startCampaign(campaignId: string, input?: StartCampaignInput): Promise<Campaign> {
  const response = await fetchWithAutoRefresh(`${API_BASE_URL}/api/campaigns/${campaignId}/start`, {
    method: 'POST',
    headers: createHeaders(),
    body: JSON.stringify(input || {}),
  });

  return handleResponse<Campaign>(response);
}

/**
 * Поставить кампанию на паузу
 */
export async function pauseCampaign(campaignId: string): Promise<Campaign> {
  const response = await fetchWithAutoRefresh(`${API_BASE_URL}/api/campaigns/${campaignId}/pause`, {
    method: 'POST',
    headers: createHeaders(),
  });

  return handleResponse<Campaign>(response);
}

/**
 * Возобновить кампанию
 */
export async function resumeCampaign(campaignId: string): Promise<Campaign> {
  const response = await fetchWithAutoRefresh(`${API_BASE_URL}/api/campaigns/${campaignId}/resume`, {
    method: 'POST',
    headers: createHeaders(),
  });

  return handleResponse<Campaign>(response);
}

/**
 * Отменить кампанию
 */
export async function cancelCampaign(campaignId: string): Promise<Campaign> {
  const response = await fetchWithAutoRefresh(`${API_BASE_URL}/api/campaigns/${campaignId}/cancel`, {
    method: 'POST',
    headers: createHeaders(),
  });

  return handleResponse<Campaign>(response);
}

// ============================================
// Campaign Monitoring API
// ============================================

/**
 * Получить прогресс кампании
 */
export async function getCampaignProgress(campaignId: string): Promise<CampaignProgress> {
  const response = await fetchWithAutoRefresh(`${API_BASE_URL}/api/campaigns/${campaignId}/progress`, {
    method: 'GET',
    headers: createHeaders(),
  });

  return handleResponse<CampaignProgress>(response);
}

/**
 * Получить сообщения кампании
 */
export async function getCampaignMessages(campaignId: string, query?: ListMessagesQuery): Promise<MessagesListResponse> {
  const params = new URLSearchParams();
  
  if (query?.page) params.set('page', String(query.page));
  if (query?.limit) params.set('limit', String(query.limit));
  if (query?.status) {
    if (Array.isArray(query.status)) {
      query.status.forEach((s) => params.append('status', s));
    } else {
      params.set('status', query.status);
    }
  }
  if (query?.messenger) params.set('messenger', query.messenger);
  if (query?.profileId) params.set('profileId', query.profileId);

  const queryString = params.toString();
  const url = `${API_BASE_URL}/api/campaigns/${campaignId}/messages${queryString ? `?${queryString}` : ''}`;

  const response = await fetchWithAutoRefresh(url, {
    method: 'GET',
    headers: createHeaders(),
  });

  return handleResponse<MessagesListResponse>(response);
}

/**
 * Получить логи кампании
 */
export async function getCampaignLogs(campaignId: string, query?: ListLogsQuery): Promise<LogsListResponse> {
  const params = new URLSearchParams();
  
  if (query?.page) params.set('page', String(query.page));
  if (query?.limit) params.set('limit', String(query.limit));
  if (query?.level) {
    if (Array.isArray(query.level)) {
      query.level.forEach((l) => params.append('level', l));
    } else {
      params.set('level', query.level);
    }
  }
  if (query?.action) params.set('action', query.action);

  const queryString = params.toString();
  const url = `${API_BASE_URL}/api/campaigns/${campaignId}/logs${queryString ? `?${queryString}` : ''}`;

  const response = await fetchWithAutoRefresh(url, {
    method: 'GET',
    headers: createHeaders(),
  });

  return handleResponse<LogsListResponse>(response);
}

/**
 * Получить статистику кампании
 */
export async function getCampaignStats(campaignId: string): Promise<CampaignStats> {
  const response = await fetchWithAutoRefresh(`${API_BASE_URL}/api/campaigns/${campaignId}/stats`, {
    method: 'GET',
    headers: createHeaders(),
  });

  return handleResponse<CampaignStats>(response);
}

/**
 * Экспортировать результаты кампании
 */
export async function exportCampaign(campaignId: string): Promise<Blob> {
  const response = await fetchWithAutoRefresh(`${API_BASE_URL}/api/campaigns/${campaignId}/export`, {
    method: 'GET',
    headers: {
      ...createHeaders(),
      Accept: 'text/csv',
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw error as ApiError;
  }

  return response.blob();
}

// ============================================
// Campaign Profiles API
// ============================================

/**
 * Обновить профили кампании
 */
export async function updateCampaignProfiles(
  campaignId: string,
  input: UpdateCampaignProfilesInput
): Promise<CampaignProfile[]> {
  const response = await fetchWithAutoRefresh(`${API_BASE_URL}/api/campaigns/${campaignId}/profiles`, {
    method: 'PUT',
    headers: createHeaders(),
    body: JSON.stringify(input),
  });

  return handleResponse<CampaignProfile[]>(response);
}

/**
 * Получить профили кампании
 */
export async function getCampaignProfiles(campaignId: string): Promise<CampaignProfile[]> {
  const response = await fetchWithAutoRefresh(`${API_BASE_URL}/api/campaigns/${campaignId}/profiles`, {
    method: 'GET',
    headers: createHeaders(),
  });

  return handleResponse<CampaignProfile[]>(response);
}

// ============================================
// Campaign Validation API
// ============================================

/**
 * Валидация кампании перед запуском
 */
export async function validateCampaign(campaignId: string): Promise<CampaignValidationResult> {
  const response = await fetchWithAutoRefresh(`${API_BASE_URL}/api/campaigns/${campaignId}/validate`, {
    method: 'GET',
    headers: createHeaders(),
  });

  return handleResponse<CampaignValidationResult>(response);
}

/**
 * Расчёт количества контактов
 */
export async function calculateContacts(campaignId: string): Promise<CalculatedContacts> {
  const response = await fetchWithAutoRefresh(`${API_BASE_URL}/api/campaigns/${campaignId}/calculate-contacts`, {
    method: 'GET',
    headers: createHeaders(),
  });

  return handleResponse<CalculatedContacts>(response);
}

// ============================================
// Export all
// ============================================

export const campaignsApi = {
  // Campaigns CRUD
  list: listCampaigns,
  get: getCampaign,
  create: createCampaign,
  update: updateCampaign,
  delete: deleteCampaign,
  duplicate: duplicateCampaign,
  archive: archiveCampaign,
  
  // Actions
  start: startCampaign,
  pause: pauseCampaign,
  resume: resumeCampaign,
  cancel: cancelCampaign,
  
  // Monitoring
  getProgress: getCampaignProgress,
  getMessages: getCampaignMessages,
  getLogs: getCampaignLogs,
  getStats: getCampaignStats,
  export: exportCampaign,
  
  // Profiles
  updateProfiles: updateCampaignProfiles,
  getProfiles: getCampaignProfiles,
  
  // Validation
  validate: validateCampaign,
  calculateContacts,
};

