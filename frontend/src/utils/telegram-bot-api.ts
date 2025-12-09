import { API_BASE_URL } from '@/config';
import { useAuthStore } from '@/store';
import type { ApiError, TelegramBotSettings, SetupTelegramBotResponse, VerifyTelegramBotResponse, UpdateTelegramNotificationsInput, TestTelegramBotResponse } from '@/types';
import { isValidJWTFormat, isTokenExpired } from './jwt';

let refreshPromise: Promise<unknown> | null = null;

async function handleResponse<T>(response: Response): Promise<T> {
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
    throw error;
  }

  if (isJson) {
    return (await response.json()) as T;
  }

  return (await response.text()) as unknown as T;
}

async function refreshTokens(): Promise<void> {
  if (refreshPromise) {
    await refreshPromise;
    return;
  }

  const { refreshToken, updateTokens, logout } = useAuthStore.getState();
  if (!refreshToken || !isValidJWTFormat(refreshToken)) {
    logout();
    throw { message: 'Unauthorized' } as ApiError;
  }

  refreshPromise = fetch(`${API_BASE_URL}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  })
    .then(handleResponse)
    .then((data: { accessToken: string; refreshToken: string }) => {
      updateTokens(data.accessToken, data.refreshToken);
    })
    .finally(() => {
      refreshPromise = null;
    });

  await refreshPromise;
}

async function authorizedRequest(input: RequestInfo, init: RequestInit = {}): Promise<Response> {
  const { accessToken, refreshToken, logout } = useAuthStore.getState();

  if (!accessToken || !isValidJWTFormat(accessToken)) {
    logout();
    throw { message: 'Unauthorized' } as ApiError;
  }

  const headers: Record<string, string> = {
    ...(init.headers as Record<string, string>),
    Authorization: `Bearer ${accessToken}`,
  };

  let response = await fetch(input, { ...init, headers });

  if (response.status === 401 && refreshToken && !isTokenExpired(refreshToken)) {
    await refreshTokens();
    const newAccessToken = useAuthStore.getState().accessToken;
    const retryHeaders: Record<string, string> = {
      ...(init.headers as Record<string, string>),
      Authorization: `Bearer ${newAccessToken}`,
    };
    response = await fetch(input, { ...init, headers: retryHeaders });
  }

  if (response.status === 401) {
    logout();
  }

  return response;
}

export async function getTelegramBotSettings(): Promise<TelegramBotSettings> {
  const response = await authorizedRequest(`${API_BASE_URL}/telegram-bot`, {
    method: 'GET',
  });
  return handleResponse<TelegramBotSettings>(response);
}

export async function setupTelegramBot(botToken: string): Promise<SetupTelegramBotResponse> {
  const response = await authorizedRequest(`${API_BASE_URL}/telegram-bot/setup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ botToken }),
  });
  return handleResponse<SetupTelegramBotResponse>(response);
}

export async function verifyTelegramBot(code: string): Promise<VerifyTelegramBotResponse> {
  const response = await authorizedRequest(`${API_BASE_URL}/telegram-bot/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  });
  return handleResponse<VerifyTelegramBotResponse>(response);
}

export async function disconnectTelegramBot(): Promise<{ message: string }> {
  const response = await authorizedRequest(`${API_BASE_URL}/telegram-bot`, {
    method: 'DELETE',
  });
  return handleResponse<{ message: string }>(response);
}

export async function updateTelegramNotifications(
  payload: UpdateTelegramNotificationsInput
): Promise<{ message: string }> {
  const response = await authorizedRequest(`${API_BASE_URL}/telegram-bot/notifications`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return handleResponse<{ message: string }>(response);
}

export async function sendTestTelegramNotification(): Promise<TestTelegramBotResponse> {
  const response = await authorizedRequest(`${API_BASE_URL}/telegram-bot/test`, {
    method: 'POST',
  });
  return handleResponse<TestTelegramBotResponse>(response);
}


