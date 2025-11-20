/**
 * API клиент утилиты
 * 
 * Базовые функции для работы с API.
 * Использует fetch для HTTP запросов.
 * 
 * Обрабатывает 401 ошибки и автоматически обновляет токены через refresh.
 * Защищен от race conditions при параллельных запросах.
 */

import { API_BASE_URL } from '@/config';
import { useAuthStore } from '@/store';
import type {
  ApiError,
  LoginInput,
  LoginResponse,
  RefreshInput,
  RefreshResponse,
  LogoutInput,
  User,
  Client,
  ClientsListResponse,
  ListClientsQuery,
  CreateClientInput,
  UpdateClientInput,
  ClientGroup,
  CreateClientGroupInput,
  UpdateClientGroupInput,
  Region,
  CreateRegionInput,
  UpdateRegionInput,
  ClientPhone,
  CreateClientPhoneInput,
  UpdateClientPhoneInput,
} from '@/types';
import { isValidJWTFormat, isTokenExpired } from './jwt';

/**
 * Механизм защиты от race conditions при refresh
 * 
 * Хранит активный Promise refresh запроса, чтобы все параллельные запросы
 * ждали одного и того же refresh вместо создания множественных запросов.
 */
let refreshPromise: Promise<RefreshResponse> | null = null;

/**
 * Выполняет refresh токенов с защитой от race conditions
 * 
 * Если уже есть активный refresh запрос, возвращает тот же Promise.
 * Это предотвращает множественные refresh запросы при параллельных 401 ошибках.
 * 
 * @returns Promise с новыми токенами
 */
async function performRefresh(): Promise<RefreshResponse> {
  // Если уже есть активный refresh, ждем его
  if (refreshPromise) {
    return refreshPromise;
  }

  const { refreshToken } = useAuthStore.getState();
  
  if (!refreshToken) {
    throw { message: 'No refresh token available' } as ApiError;
  }

  // Валидация формата refresh токена
  if (!isValidJWTFormat(refreshToken)) {
    throw { message: 'Invalid refresh token format' } as ApiError;
  }

  // Создаем новый refresh запрос
  refreshPromise = refresh(refreshToken)
    .then((response) => {
      // Обновляем токены в store
      const { updateTokens } = useAuthStore.getState();
      updateTokens(response.accessToken, response.refreshToken);
      return response;
    })
    .finally(() => {
      // Очищаем Promise после завершения (успешного или неудачного)
      refreshPromise = null;
    });

  return refreshPromise;
}

/**
 * Обработчик 401 ошибок с автоматическим refresh
 * 
 * При получении 401 ошибки:
 * 1. Пытается обновить токены через refresh
 * 2. Если refresh успешен, повторяет оригинальный запрос
 * 3. Если refresh не удался, очищает auth и редиректит на /login
 * 
 * @param originalRequest - Функция для повторного выполнения оригинального запроса
 * @returns Результат повторного запроса или выбрасывает ошибку
 */
async function handle401ErrorWithRefresh<T>(
  originalRequest: () => Promise<T>
): Promise<T> {
  try {
    // Пытаемся обновить токены
    await performRefresh();
    
    // Повторяем оригинальный запрос с новым токеном
    return await originalRequest();
  } catch (error) {
    // Если refresh не удался, очищаем auth и редиректим
    const { clearAuth } = useAuthStore.getState();
    clearAuth();
    
    // Редирект на /login
    if (window.location.pathname !== '/login') {
      window.location.href = '/login';
    }
    
    throw error;
  }
}

/**
 * Обработчик 401 ошибок (fallback для случаев, когда повтор запроса невозможен)
 * 
 * Очищает auth store и редиректит на /login.
 * Используется только когда автоматический refresh невозможен.
 */
function handle401Error(): void {
  const { clearAuth } = useAuthStore.getState();
  clearAuth();
  
  // Редирект на /login
  if (window.location.pathname !== '/login') {
    window.location.href = '/login';
  }
}

/**
 * Обработка ответа от API
 * 
 * Проверяет статус ответа и парсит JSON.
 * Выбрасывает ошибку, если статус не успешный.
 */
async function handleResponse<T>(response: Response): Promise<T> {
  // Для 204 No Content не пытаемся парсить тело
  if (response.status === 204) {
    return {} as T;
  }

  const contentType = response.headers.get('content-type');
  const isJson = contentType?.includes('application/json');

  if (!response.ok) {
    // Обработка 401 ошибки
    // Если это 401 после попытки refresh, значит refresh не удался - делаем logout
    if (response.status === 401) {
      handle401Error();
    }

    // Пытаемся получить ошибку из JSON
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

    // Сохраняем статус код в объекте ошибки для специальной обработки
    error.statusCode = response.status;

    throw error;
  }

  // Парсим JSON только если это JSON ответ
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
 * 
 * ВАЖНО: accessToken всегда отправляется в Authorization header
 * в формате "Bearer <token>" согласно стандарту JWT.
 * 
 * @param accessToken - Access токен для авторизации (опционально, берется из store)
 * @returns Заголовки с Authorization header
 */
function createHeaders(accessToken?: string): HeadersInit {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  // Берем токен из store, если не передан явно
  const token = accessToken || useAuthStore.getState().accessToken;

  // ВАЖНО: accessToken всегда отправляется в Authorization header
  if (token) {
    // Валидация формата токена перед отправкой
    if (!isValidJWTFormat(token)) {
      throw { message: 'Invalid access token format' } as ApiError;
    }
    
    headers['Authorization'] = `Bearer ${token}`;
  }

  return headers;
}

/**
 * Выполняет fetch запрос с автоматическим refresh при 401
 * 
 * Обертка над fetch, которая:
 * 1. Проверяет истечение access token перед запросом
 * 2. Автоматически обновляет токен, если он истек или скоро истечет
 * 3. При получении 401 пытается обновить токены и повторить запрос
 * 4. Защищена от race conditions при параллельных запросах
 * 
 * @param url - URL для запроса
 * @param options - Опции fetch запроса
 * @returns Promise с ответом
 */
async function fetchWithAutoRefresh(url: string, options: RequestInit = {}): Promise<Response> {
  // Проверяем access token перед запросом
  const { accessToken } = useAuthStore.getState();
  
  // Если токен истек или скоро истечет, обновляем его заранее
  if (accessToken && isTokenExpired(accessToken)) {
    try {
      await performRefresh();
      // Обновляем токен в options для повторного запроса
      const { accessToken: newToken } = useAuthStore.getState();
      if (newToken) {
        const headers = new Headers(options.headers);
        headers.set('Authorization', `Bearer ${newToken}`);
        options.headers = headers;
      }
    } catch {
      // Если refresh не удался, продолжаем с текущим токеном
      // Сервер вернет 401, и мы обработаем это ниже
    }
  }

  // Выполняем запрос
  let response = await fetch(url, options);

  // Если получили 401, пытаемся обновить токены и повторить запрос
  if (response.status === 401) {
    try {
      // Обновляем токены
      await performRefresh();
      
      // Обновляем Authorization header с новым токеном
      const { accessToken: newToken } = useAuthStore.getState();
      if (newToken) {
        const newOptions = { ...options };
        const headers = new Headers(newOptions.headers);
        headers.set('Authorization', `Bearer ${newToken}`);
        newOptions.headers = headers;
        
        // Повторяем запрос с новым токеном
        response = await fetch(url, newOptions);
      }
    } catch {
      // Если refresh не удался, возвращаем оригинальный 401 ответ
      // handleResponse обработает это и сделает logout
    }
  }

  return response;
}

/**
 * Вход в систему
 * 
 * @param credentials - Email и пароль
 * @returns Токены и данные пользователя
 */
export async function login(credentials: LoginInput): Promise<LoginResponse> {
  // Для login не используем автоматический refresh (нет токена для обновления)
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: createHeaders(),
    body: JSON.stringify(credentials),
  });

  return handleResponse<LoginResponse>(response);
}

/**
 * Обновление токенов
 * 
 * @param refreshToken - Refresh токен
 * @returns Новые токены
 */
export async function refresh(refreshToken: string): Promise<RefreshResponse> {
  // Валидация формата refresh токена
  if (!isValidJWTFormat(refreshToken)) {
    throw { message: 'Invalid refresh token format' } as ApiError;
  }

  const input: RefreshInput = { refreshToken };
  
  // Для refresh не используем автоматический refresh (чтобы избежать бесконечной рекурсии)
  const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
    method: 'POST',
    headers: createHeaders(),
    body: JSON.stringify(input),
  });

  return handleResponse<RefreshResponse>(response);
}

/**
 * Выход из системы
 * 
 * @param refreshToken - Refresh токен для отзыва
 */
export async function logout(refreshToken: string): Promise<void> {
  const input: LogoutInput = { refreshToken };
  
  const response = await fetch(`${API_BASE_URL}/auth/logout`, {
    method: 'POST',
    headers: createHeaders(),
    body: JSON.stringify(input),
  });

  await handleResponse<void>(response);
}

/**
 * Получение данных текущего пользователя
 * 
 * Использует accessToken из store, если токен не передан явно.
 * Автоматически обновляет токен при истечении.
 * 
 * @param accessToken - Access токен для авторизации (опционально, берется из store)
 * @returns Данные текущего пользователя
 */
export async function getCurrentUser(accessToken?: string): Promise<User> {
  // Берем токен из store, если не передан
  const token = accessToken || useAuthStore.getState().accessToken;
  
  if (!token) {
    throw { message: 'No access token available' } as ApiError;
  }

  const response = await fetchWithAutoRefresh(`${API_BASE_URL}/users/me`, {
    method: 'GET',
    headers: createHeaders(token),
  });

  return handleResponse<User>(response);
}

/**
 * Получение списка всех пользователей
 * 
 * Требует ROOT роль. Использует accessToken из store.
 * Автоматически обновляет токен при истечении.
 * 
 * @returns Список всех пользователей
 */
export async function listUsers(): Promise<User[]> {
  const token = useAuthStore.getState().accessToken;
  
  if (!token) {
    throw { message: 'No access token available' } as ApiError;
  }

  const response = await fetchWithAutoRefresh(`${API_BASE_URL}/users`, {
    method: 'GET',
    headers: createHeaders(token),
  });

  return handleResponse<User[]>(response);
}

/**
 * Создание пользователя
 * 
 * Требует ROOT роль. Использует accessToken из store.
 * Автоматически обновляет токен при истечении.
 * 
 * @param userData - Данные для создания пользователя
 * @returns Созданный пользователь
 */
export async function createUser(userData: { email: string; password: string; name?: string }): Promise<User> {
  const token = useAuthStore.getState().accessToken;
  
  if (!token) {
    throw { message: 'No access token available' } as ApiError;
  }

  const response = await fetchWithAutoRefresh(`${API_BASE_URL}/users`, {
    method: 'POST',
    headers: createHeaders(token),
    body: JSON.stringify(userData),
  });

  return handleResponse<User>(response);
}

/**
 * Обновление пользователя
 * 
 * Требует ROOT роль. Использует accessToken из store.
 * Автоматически обновляет токен при истечении.
 * 
 * @param userId - ID пользователя
 * @param userData - Данные для обновления пользователя
 * @returns Обновленный пользователь
 */
export async function updateUser(
  userId: string,
  userData: { email?: string; password?: string; name?: string; isActive?: boolean }
): Promise<User> {
  const token = useAuthStore.getState().accessToken;
  
  if (!token) {
    throw { message: 'No access token available' } as ApiError;
  }

  const response = await fetchWithAutoRefresh(`${API_BASE_URL}/users/${userId}`, {
    method: 'PATCH',
    headers: createHeaders(token),
    body: JSON.stringify(userData),
  });

  return handleResponse<User>(response);
}

// ============================================
// Clients API
// ============================================

/**
 * Получение списка клиентов
 * 
 * Использует accessToken из store.
 * Автоматически обновляет токен при истечении.
 * 
 * @param query - Query параметры (пагинация, поиск, фильтрация, сортировка)
 * @returns Список клиентов с метаданными пагинации
 */
export async function listClients(query?: ListClientsQuery): Promise<ClientsListResponse> {
  const token = useAuthStore.getState().accessToken;
  
  if (!token) {
    throw { message: 'No access token available' } as ApiError;
  }

  // Построение query строки
  const queryParams = new URLSearchParams();
  if (query?.page) queryParams.append('page', query.page.toString());
  if (query?.limit) queryParams.append('limit', query.limit.toString());
  if (query?.search) queryParams.append('search', query.search);
  if (query?.regionId) queryParams.append('regionId', query.regionId);
  if (query?.groupId) queryParams.append('groupId', query.groupId);
  if (query?.status) queryParams.append('status', query.status);
  if (query?.userId) queryParams.append('userId', query.userId); // Для ROOT - фильтр по пользователю
  if (query?.sortBy) queryParams.append('sortBy', query.sortBy);
  if (query?.sortOrder) queryParams.append('sortOrder', query.sortOrder);

  const queryString = queryParams.toString();
  const url = `${API_BASE_URL}/clients${queryString ? `?${queryString}` : ''}`;

  const response = await fetchWithAutoRefresh(url, {
    method: 'GET',
    headers: createHeaders(token),
  });

  return handleResponse<ClientsListResponse>(response);
}

/**
 * Получение клиента по ID
 * 
 * @param clientId - ID клиента
 * @returns Данные клиента
 */
export async function getClient(clientId: string): Promise<Client> {
  const token = useAuthStore.getState().accessToken;
  
  if (!token) {
    throw { message: 'No access token available' } as ApiError;
  }

  const response = await fetchWithAutoRefresh(`${API_BASE_URL}/clients/${clientId}`, {
    method: 'GET',
    headers: createHeaders(token),
  });

  return handleResponse<Client>(response);
}

/**
 * Создание клиента
 * 
 * @param clientData - Данные для создания клиента
 * @returns Созданный клиент
 */
export async function createClient(clientData: CreateClientInput): Promise<Client> {
  const token = useAuthStore.getState().accessToken;
  
  if (!token) {
    throw { message: 'No access token available' } as ApiError;
  }

  const response = await fetchWithAutoRefresh(`${API_BASE_URL}/clients`, {
    method: 'POST',
    headers: createHeaders(token),
    body: JSON.stringify(clientData),
  });

  return handleResponse<Client>(response);
}

/**
 * Обновление клиента
 * 
 * @param clientId - ID клиента
 * @param clientData - Данные для обновления клиента
 * @returns Обновленный клиент
 */
export async function updateClient(clientId: string, clientData: UpdateClientInput): Promise<Client> {
  const token = useAuthStore.getState().accessToken;
  
  if (!token) {
    throw { message: 'No access token available' } as ApiError;
  }

  const response = await fetchWithAutoRefresh(`${API_BASE_URL}/clients/${clientId}`, {
    method: 'PATCH',
    headers: createHeaders(token),
    body: JSON.stringify(clientData),
  });

  return handleResponse<Client>(response);
}

/**
 * Удаление клиента
 * 
 * @param clientId - ID клиента
 */
export async function deleteClient(clientId: string): Promise<void> {
  const token = useAuthStore.getState().accessToken;
  
  if (!token) {
    throw { message: 'No access token available' } as ApiError;
  }

  const response = await fetchWithAutoRefresh(`${API_BASE_URL}/clients/${clientId}`, {
    method: 'DELETE',
    headers: createHeaders(token),
  });

  await handleResponse<void>(response);
}

// ============================================
// Client Groups API
// ============================================

/**
 * Получение списка групп клиентов
 * 
 * @param userId - Опциональный ID пользователя для ROOT (для просмотра групп другого пользователя)
 * @returns Список групп клиентов
 */
export async function listClientGroups(userId?: string): Promise<ClientGroup[]> {
  const token = useAuthStore.getState().accessToken;
  
  if (!token) {
    throw { message: 'No access token available' } as ApiError;
  }

  // Построение query строки
  const queryParams = new URLSearchParams();
  if (userId) {
    queryParams.append('userId', userId);
  }

  const queryString = queryParams.toString();
  const url = `${API_BASE_URL}/client-groups${queryString ? `?${queryString}` : ''}`;

  const response = await fetchWithAutoRefresh(url, {
    method: 'GET',
    headers: createHeaders(token),
  });

  return handleResponse<ClientGroup[]>(response);
}

/**
 * Получение группы клиентов по ID
 * 
 * @param groupId - ID группы
 * @returns Данные группы
 */
export async function getClientGroup(groupId: string): Promise<ClientGroup> {
  const token = useAuthStore.getState().accessToken;
  
  if (!token) {
    throw { message: 'No access token available' } as ApiError;
  }

  const response = await fetchWithAutoRefresh(`${API_BASE_URL}/client-groups/${groupId}`, {
    method: 'GET',
    headers: createHeaders(token),
  });

  return handleResponse<ClientGroup>(response);
}

/**
 * Создание группы клиентов
 * 
 * @param groupData - Данные для создания группы (может включать userId для ROOT)
 * @returns Созданная группа
 */
export async function createClientGroup(groupData: CreateClientGroupInput): Promise<ClientGroup> {
  const token = useAuthStore.getState().accessToken;
  
  if (!token) {
    throw { message: 'No access token available' } as ApiError;
  }

  const response = await fetchWithAutoRefresh(`${API_BASE_URL}/client-groups`, {
    method: 'POST',
    headers: createHeaders(token),
    body: JSON.stringify(groupData),
  });

  return handleResponse<ClientGroup>(response);
}

/**
 * Обновление группы клиентов
 * 
 * @param groupId - ID группы
 * @param groupData - Данные для обновления группы
 * @returns Обновленная группа
 */
export async function updateClientGroup(groupId: string, groupData: UpdateClientGroupInput): Promise<ClientGroup> {
  const token = useAuthStore.getState().accessToken;
  
  if (!token) {
    throw { message: 'No access token available' } as ApiError;
  }

  const response = await fetchWithAutoRefresh(`${API_BASE_URL}/client-groups/${groupId}`, {
    method: 'PATCH',
    headers: createHeaders(token),
    body: JSON.stringify(groupData),
  });

  return handleResponse<ClientGroup>(response);
}

/**
 * Удаление группы клиентов
 * 
 * @param groupId - ID группы
 */
export async function deleteClientGroup(groupId: string): Promise<void> {
  const token = useAuthStore.getState().accessToken;
  
  if (!token) {
    throw { message: 'No access token available' } as ApiError;
  }

  const response = await fetchWithAutoRefresh(`${API_BASE_URL}/client-groups/${groupId}`, {
    method: 'DELETE',
    headers: createHeaders(token),
  });

  await handleResponse<void>(response);
}

// ============================================
// Regions API
// ============================================

/**
 * Получение списка регионов
 * 
 * Доступно всем авторизованным пользователям.
 * 
 * @returns Список всех регионов
 */
export async function listRegions(): Promise<Region[]> {
  const token = useAuthStore.getState().accessToken;
  
  if (!token) {
    throw { message: 'No access token available' } as ApiError;
  }

  const response = await fetchWithAutoRefresh(`${API_BASE_URL}/regions`, {
    method: 'GET',
    headers: createHeaders(token),
  });

  return handleResponse<Region[]>(response);
}

/**
 * Получение региона по ID
 * 
 * @param regionId - ID региона
 * @returns Данные региона
 */
export async function getRegion(regionId: string): Promise<Region> {
  const token = useAuthStore.getState().accessToken;
  
  if (!token) {
    throw { message: 'No access token available' } as ApiError;
  }

  const response = await fetchWithAutoRefresh(`${API_BASE_URL}/regions/${regionId}`, {
    method: 'GET',
    headers: createHeaders(token),
  });

  return handleResponse<Region>(response);
}

/**
 * Создание региона
 * 
 * Требует ROOT роль.
 * 
 * @param regionData - Данные для создания региона
 * @returns Созданный регион
 */
export async function createRegion(regionData: CreateRegionInput): Promise<Region> {
  const token = useAuthStore.getState().accessToken;
  
  if (!token) {
    throw { message: 'No access token available' } as ApiError;
  }

  const response = await fetchWithAutoRefresh(`${API_BASE_URL}/regions`, {
    method: 'POST',
    headers: createHeaders(token),
    body: JSON.stringify(regionData),
  });

  return handleResponse<Region>(response);
}

/**
 * Обновление региона
 * 
 * Требует ROOT роль.
 * 
 * @param regionId - ID региона
 * @param regionData - Данные для обновления региона
 * @returns Обновленный регион
 */
export async function updateRegion(regionId: string, regionData: UpdateRegionInput): Promise<Region> {
  const token = useAuthStore.getState().accessToken;
  
  if (!token) {
    throw { message: 'No access token available' } as ApiError;
  }

  const response = await fetchWithAutoRefresh(`${API_BASE_URL}/regions/${regionId}`, {
    method: 'PATCH',
    headers: createHeaders(token),
    body: JSON.stringify(regionData),
  });

  return handleResponse<Region>(response);
}

/**
 * Удаление региона
 * 
 * Требует ROOT роль.
 * 
 * @param regionId - ID региона
 */
export async function deleteRegion(regionId: string): Promise<void> {
  const token = useAuthStore.getState().accessToken;
  
  if (!token) {
    throw { message: 'No access token available' } as ApiError;
  }

  const response = await fetchWithAutoRefresh(`${API_BASE_URL}/regions/${regionId}`, {
    method: 'DELETE',
    headers: createHeaders(token),
  });

  await handleResponse<void>(response);
}

// ============================================
// Client Phones API
// ============================================

/**
 * Получение списка телефонов клиента
 * 
 * @param clientId - ID клиента
 * @returns Список телефонов клиента
 */
export async function listClientPhones(clientId: string): Promise<ClientPhone[]> {
  const token = useAuthStore.getState().accessToken;
  
  if (!token) {
    throw { message: 'No access token available' } as ApiError;
  }

  const response = await fetchWithAutoRefresh(`${API_BASE_URL}/clients/${clientId}/phones`, {
    method: 'GET',
    headers: createHeaders(token),
  });

  return handleResponse<ClientPhone[]>(response);
}

/**
 * Создание телефона клиента
 * 
 * @param clientId - ID клиента
 * @param phoneData - Данные для создания телефона
 * @returns Созданный телефон
 */
export async function createClientPhone(clientId: string, phoneData: CreateClientPhoneInput): Promise<ClientPhone> {
  const token = useAuthStore.getState().accessToken;
  
  if (!token) {
    throw { message: 'No access token available' } as ApiError;
  }

  const response = await fetchWithAutoRefresh(`${API_BASE_URL}/clients/${clientId}/phones`, {
    method: 'POST',
    headers: createHeaders(token),
    body: JSON.stringify(phoneData),
  });

  return handleResponse<ClientPhone>(response);
}

/**
 * Обновление телефона клиента
 * 
 * @param clientId - ID клиента
 * @param phoneId - ID телефона
 * @param phoneData - Данные для обновления телефона
 * @returns Обновленный телефон
 */
export async function updateClientPhone(
  clientId: string,
  phoneId: string,
  phoneData: UpdateClientPhoneInput
): Promise<ClientPhone> {
  const token = useAuthStore.getState().accessToken;
  
  if (!token) {
    throw { message: 'No access token available' } as ApiError;
  }

  const response = await fetchWithAutoRefresh(`${API_BASE_URL}/clients/${clientId}/phones/${phoneId}`, {
    method: 'PATCH',
    headers: createHeaders(token),
    body: JSON.stringify(phoneData),
  });

  return handleResponse<ClientPhone>(response);
}

/**
 * Удаление телефона клиента
 * 
 * @param clientId - ID клиента
 * @param phoneId - ID телефона
 */
export async function deleteClientPhone(clientId: string, phoneId: string): Promise<void> {
  const token = useAuthStore.getState().accessToken;
  
  if (!token) {
    throw { message: 'No access token available' } as ApiError;
  }

  const response = await fetchWithAutoRefresh(`${API_BASE_URL}/clients/${clientId}/phones/${phoneId}`, {
    method: 'DELETE',
    headers: createHeaders(token),
  });

  await handleResponse<void>(response);
}

