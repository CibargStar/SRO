/**
 * API функции для модуля шаблонов
 * 
 * Предоставляет функции для работы с API шаблонов:
 * - Категории (CRUD)
 * - Шаблоны (CRUD + duplicate, move, preview)
 * - Элементы шаблонов (CRUD + reorder)
 * - Загрузка/удаление файлов
 */

import { API_BASE_URL } from '@/config';
import { useAuthStore } from '@/store';
import type { ApiError } from '@/types';
import type {
  TemplateCategory,
  Template,
  TemplateItem,
  FileType,
  ListTemplatesQuery,
  TemplatesListResponse,
  CreateCategoryInput,
  UpdateCategoryInput,
  CreateTemplateInput,
  UpdateTemplateInput,
  CreateTemplateItemInput,
  UpdateTemplateItemInput,
  ReorderItemsInput,
  MoveTemplateInput,
  PreviewTemplateInput,
  TemplatePreviewResponse,
  FileUploadResponse,
} from '@/types/template';
import { isValidJWTFormat, isTokenExpired } from './jwt';

/**
 * Механизм защиты от race conditions при refresh
 */
let refreshPromise: Promise<unknown> | null = null;

/**
 * Обработка ответа от API
 */
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
function createHeaders(accessToken?: string): HeadersInit {
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
async function fetchWithAutoRefresh(url: string, options: RequestInit = {}): Promise<Response> {
  const { accessToken, refreshToken, updateTokens, clearAuth } = useAuthStore.getState();
  
  // Если токен истек, обновляем его заранее
  if (accessToken && isTokenExpired(accessToken) && refreshToken) {
    try {
      if (!refreshPromise) {
        refreshPromise = fetch(`${API_BASE_URL}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        })
          .then(async (res) => {
            if (!res.ok) throw new Error('Refresh failed');
            const data = await res.json();
            updateTokens(data.accessToken, data.refreshToken);
            return data;
          })
          .finally(() => {
            refreshPromise = null;
          });
      }
      await refreshPromise;
      
      // Обновляем токен в headers
      const { accessToken: newToken } = useAuthStore.getState();
      if (newToken) {
        const headers = new Headers(options.headers);
        headers.set('Authorization', `Bearer ${newToken}`);
        options.headers = headers;
      }
    } catch {
      clearAuth();
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
      throw { message: 'Session expired' } as ApiError;
    }
  }

  let response = await fetch(url, options);

  // Если получили 401, пытаемся обновить токены
  if (response.status === 401 && refreshToken) {
    try {
      if (!refreshPromise) {
        refreshPromise = fetch(`${API_BASE_URL}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken }),
        })
          .then(async (res) => {
            if (!res.ok) throw new Error('Refresh failed');
            const data = await res.json();
            updateTokens(data.accessToken, data.refreshToken);
            return data;
          })
          .finally(() => {
            refreshPromise = null;
          });
      }
      await refreshPromise;
      
      // Повторяем запрос с новым токеном
      const { accessToken: newToken } = useAuthStore.getState();
      if (newToken) {
        const newOptions = { ...options };
        const headers = new Headers(newOptions.headers);
        headers.set('Authorization', `Bearer ${newToken}`);
        newOptions.headers = headers;
        response = await fetch(url, newOptions);
      }
    } catch {
      clearAuth();
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
  }

  return response;
}

// ============================================
// Template Categories API
// ============================================

/**
 * Получение списка категорий шаблонов
 */
export async function listTemplateCategories(): Promise<TemplateCategory[]> {
  const token = useAuthStore.getState().accessToken;
  
  if (!token) {
    throw { message: 'No access token available' } as ApiError;
  }

  const response = await fetchWithAutoRefresh(`${API_BASE_URL}/templates/categories`, {
    method: 'GET',
    headers: createHeaders(token),
  });

  const result = await handleResponse<{ data: TemplateCategory[] }>(response);
  return result.data;
}

/**
 * Получение категории по ID
 */
export async function getTemplateCategory(categoryId: string): Promise<TemplateCategory> {
  const token = useAuthStore.getState().accessToken;
  
  if (!token) {
    throw { message: 'No access token available' } as ApiError;
  }

  const response = await fetchWithAutoRefresh(`${API_BASE_URL}/templates/categories/${categoryId}`, {
    method: 'GET',
    headers: createHeaders(token),
  });

  const result = await handleResponse<{ data: TemplateCategory }>(response);
  return result.data;
}

/**
 * Создание категории
 */
export async function createTemplateCategory(data: CreateCategoryInput): Promise<TemplateCategory> {
  const token = useAuthStore.getState().accessToken;
  
  if (!token) {
    throw { message: 'No access token available' } as ApiError;
  }

  const response = await fetchWithAutoRefresh(`${API_BASE_URL}/templates/categories`, {
    method: 'POST',
    headers: createHeaders(token),
    body: JSON.stringify(data),
  });

  const result = await handleResponse<{ data: TemplateCategory }>(response);
  return result.data;
}

/**
 * Обновление категории
 */
export async function updateTemplateCategory(
  categoryId: string,
  data: UpdateCategoryInput
): Promise<TemplateCategory> {
  const token = useAuthStore.getState().accessToken;
  
  if (!token) {
    throw { message: 'No access token available' } as ApiError;
  }

  const response = await fetchWithAutoRefresh(`${API_BASE_URL}/templates/categories/${categoryId}`, {
    method: 'PUT',
    headers: createHeaders(token),
    body: JSON.stringify(data),
  });

  const result = await handleResponse<{ data: TemplateCategory }>(response);
  return result.data;
}

/**
 * Удаление категории
 */
export async function deleteTemplateCategory(categoryId: string): Promise<void> {
  const token = useAuthStore.getState().accessToken;
  
  if (!token) {
    throw { message: 'No access token available' } as ApiError;
  }

  const response = await fetchWithAutoRefresh(`${API_BASE_URL}/templates/categories/${categoryId}`, {
    method: 'DELETE',
    headers: createHeaders(token),
  });

  await handleResponse<void>(response);
}

// ============================================
// Templates API
// ============================================

/**
 * Получение списка шаблонов
 */
export async function listTemplates(query?: ListTemplatesQuery): Promise<TemplatesListResponse> {
  const token = useAuthStore.getState().accessToken;
  
  if (!token) {
    throw { message: 'No access token available' } as ApiError;
  }

  const queryParams = new URLSearchParams();
  if (query?.page) queryParams.append('page', query.page.toString());
  if (query?.limit) queryParams.append('limit', query.limit.toString());
  if (query?.search) queryParams.append('search', query.search);
  if (query?.categoryId) queryParams.append('categoryId', query.categoryId);
  if (query?.type) queryParams.append('type', query.type);
  if (query?.messengerTarget) queryParams.append('messengerTarget', query.messengerTarget);
  if (query?.sortBy) queryParams.append('sortBy', query.sortBy);
  if (query?.sortOrder) queryParams.append('sortOrder', query.sortOrder);

  const queryString = queryParams.toString();
  const url = `${API_BASE_URL}/templates${queryString ? `?${queryString}` : ''}`;

  const response = await fetchWithAutoRefresh(url, {
    method: 'GET',
    headers: createHeaders(token),
  });

  return handleResponse<TemplatesListResponse>(response);
}

/**
 * Получение шаблона по ID
 */
export async function getTemplate(templateId: string): Promise<Template> {
  const token = useAuthStore.getState().accessToken;
  
  if (!token) {
    throw { message: 'No access token available' } as ApiError;
  }

  const response = await fetchWithAutoRefresh(`${API_BASE_URL}/templates/${templateId}`, {
    method: 'GET',
    headers: createHeaders(token),
  });

  const result = await handleResponse<{ data: Template }>(response);
  return result.data;
}

/**
 * Создание шаблона
 */
export async function createTemplate(data: CreateTemplateInput): Promise<Template> {
  const token = useAuthStore.getState().accessToken;
  
  if (!token) {
    throw { message: 'No access token available' } as ApiError;
  }

  const response = await fetchWithAutoRefresh(`${API_BASE_URL}/templates`, {
    method: 'POST',
    headers: createHeaders(token),
    body: JSON.stringify(data),
  });

  const result = await handleResponse<{ data: Template }>(response);
  return result.data;
}

/**
 * Обновление шаблона
 */
export async function updateTemplate(
  templateId: string,
  data: UpdateTemplateInput
): Promise<Template> {
  const token = useAuthStore.getState().accessToken;
  
  if (!token) {
    throw { message: 'No access token available' } as ApiError;
  }

  const response = await fetchWithAutoRefresh(`${API_BASE_URL}/templates/${templateId}`, {
    method: 'PUT',
    headers: createHeaders(token),
    body: JSON.stringify(data),
  });

  const result = await handleResponse<{ data: Template }>(response);
  return result.data;
}

/**
 * Удаление шаблона
 */
export async function deleteTemplate(templateId: string): Promise<void> {
  const token = useAuthStore.getState().accessToken;
  
  if (!token) {
    throw { message: 'No access token available' } as ApiError;
  }

  const response = await fetchWithAutoRefresh(`${API_BASE_URL}/templates/${templateId}`, {
    method: 'DELETE',
    headers: createHeaders(token),
  });

  await handleResponse<void>(response);
}

/**
 * Дублирование шаблона
 */
export async function duplicateTemplate(
  templateId: string,
  name?: string
): Promise<Template> {
  const token = useAuthStore.getState().accessToken;
  
  if (!token) {
    throw { message: 'No access token available' } as ApiError;
  }

  const response = await fetchWithAutoRefresh(`${API_BASE_URL}/templates/${templateId}/duplicate`, {
    method: 'POST',
    headers: createHeaders(token),
    body: JSON.stringify({ name }),
  });

  const result = await handleResponse<{ data: Template }>(response);
  return result.data;
}

/**
 * Перемещение шаблона в категорию
 */
export async function moveTemplate(
  templateId: string,
  data: MoveTemplateInput
): Promise<Template> {
  const token = useAuthStore.getState().accessToken;
  
  if (!token) {
    throw { message: 'No access token available' } as ApiError;
  }

  const response = await fetchWithAutoRefresh(`${API_BASE_URL}/templates/${templateId}/move`, {
    method: 'POST',
    headers: createHeaders(token),
    body: JSON.stringify(data),
  });

  const result = await handleResponse<{ data: Template }>(response);
  return result.data;
}

/**
 * Предпросмотр шаблона с подстановкой переменных
 */
export async function previewTemplate(
  templateId: string,
  data?: PreviewTemplateInput
): Promise<TemplatePreviewResponse> {
  const token = useAuthStore.getState().accessToken;
  
  if (!token) {
    throw { message: 'No access token available' } as ApiError;
  }

  const response = await fetchWithAutoRefresh(`${API_BASE_URL}/templates/${templateId}/preview`, {
    method: 'POST',
    headers: createHeaders(token),
    body: JSON.stringify(data || {}),
  });

  const result = await handleResponse<{ data: TemplatePreviewResponse }>(response);
  return result.data;
}

// ============================================
// Template Items API
// ============================================

/**
 * Добавление элемента в шаблон
 */
export async function addTemplateItem(
  templateId: string,
  data: CreateTemplateItemInput
): Promise<TemplateItem> {
  const token = useAuthStore.getState().accessToken;
  
  if (!token) {
    throw { message: 'No access token available' } as ApiError;
  }

  const response = await fetchWithAutoRefresh(`${API_BASE_URL}/templates/${templateId}/items`, {
    method: 'POST',
    headers: createHeaders(token),
    body: JSON.stringify(data),
  });

  const result = await handleResponse<{ data: TemplateItem }>(response);
  return result.data;
}

/**
 * Обновление элемента шаблона
 */
export async function updateTemplateItem(
  templateId: string,
  itemId: string,
  data: UpdateTemplateItemInput
): Promise<TemplateItem> {
  const token = useAuthStore.getState().accessToken;
  
  if (!token) {
    throw { message: 'No access token available' } as ApiError;
  }

  const response = await fetchWithAutoRefresh(
    `${API_BASE_URL}/templates/${templateId}/items/${itemId}`,
    {
      method: 'PUT',
      headers: createHeaders(token),
      body: JSON.stringify(data),
    }
  );

  const result = await handleResponse<{ data: TemplateItem }>(response);
  return result.data;
}

/**
 * Удаление элемента шаблона
 */
export async function deleteTemplateItem(templateId: string, itemId: string): Promise<void> {
  const token = useAuthStore.getState().accessToken;
  
  if (!token) {
    throw { message: 'No access token available' } as ApiError;
  }

  const response = await fetchWithAutoRefresh(
    `${API_BASE_URL}/templates/${templateId}/items/${itemId}`,
    {
      method: 'DELETE',
      headers: createHeaders(token),
    }
  );

  await handleResponse<void>(response);
}

/**
 * Переупорядочивание элементов шаблона
 */
export async function reorderTemplateItems(
  templateId: string,
  data: ReorderItemsInput
): Promise<void> {
  const token = useAuthStore.getState().accessToken;
  
  if (!token) {
    throw { message: 'No access token available' } as ApiError;
  }

  const response = await fetchWithAutoRefresh(
    `${API_BASE_URL}/templates/${templateId}/items/reorder`,
    {
      method: 'PUT',
      headers: createHeaders(token),
      body: JSON.stringify(data),
    }
  );

  await handleResponse<void>(response);
}

// ============================================
// File Upload API
// ============================================

/**
 * Загрузка файла для элемента шаблона
 */
export async function uploadTemplateFile(
  templateId: string,
  itemId: string,
  file: File
): Promise<FileUploadResponse> {
  const token = useAuthStore.getState().accessToken;
  
  if (!token) {
    throw { message: 'No access token available' } as ApiError;
  }

  const formData = new FormData();
  formData.append('file', file);

  const response = await fetchWithAutoRefresh(
    `${API_BASE_URL}/templates/${templateId}/items/${itemId}/upload`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        // НЕ устанавливаем Content-Type - браузер установит автоматически с boundary
      },
      body: formData,
    }
  );

  const result = await handleResponse<{ data: { filePath: string; fileName: string; fileType: FileType; fileSize: number; fileMimeType: string; isLargeFile: boolean }; warning?: string }>(response);

  return {
    itemId,
    fileName: result.data.fileName,
    filePath: result.data.filePath,
    fileUrl: `/uploads/templates/${result.data.filePath}`,
    fileSize: result.data.fileSize,
    mimeType: result.data.fileMimeType,
    fileType: result.data.fileType,
    sizeWarning: result.data.isLargeFile || undefined,
  };
}

/**
 * Удаление файла элемента шаблона
 */
export async function deleteTemplateFile(templateId: string, itemId: string): Promise<void> {
  const token = useAuthStore.getState().accessToken;
  
  if (!token) {
    throw { message: 'No access token available' } as ApiError;
  }

  const response = await fetchWithAutoRefresh(
    `${API_BASE_URL}/templates/${templateId}/items/${itemId}/file`,
    {
      method: 'DELETE',
      headers: createHeaders(token),
    }
  );

  await handleResponse<void>(response);
}


