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
  Profile,
  ProfilesListResponse,
  ListProfilesQuery,
  CreateProfileInput,
  UpdateProfileInput,
  ProfileStatusResponse,
  StartProfileOptions,
  StartProfileResponse,
  ProcessResourceStats,
  ProfileResourcesHistoryResponse,
  ProfileHealthCheck,
  NetworkStats,
  ProfileAlertsResponse,
  ProfileUnreadAlertsCountResponse,
  ProfileAnalytics,
  AggregationPeriod,
  ProfileLimits,
  SetProfileLimitsInput,
  MessengerService,
  ProfileMessengerAccount,
  MessengerCheckConfig,
  LoginCheckResult,
  CreateMessengerAccountInput,
  UpdateMessengerAccountInput,
  UpdateMessengerCheckConfigInput,
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

/**
 * Удаление пользователя
 * 
 * @param userId - ID пользователя для удаления
 */
export async function deleteUser(userId: string): Promise<void> {
  const token = useAuthStore.getState().accessToken;
  
  if (!token) {
    throw { message: 'No access token available' } as ApiError;
  }

  const response = await fetchWithAutoRefresh(`${API_BASE_URL}/users/${userId}`, {
    method: 'DELETE',
    headers: createHeaders(token),
  });

  await handleResponse<void>(response);
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

/**
 * Результат импорта клиентов
 */
export interface ImportClientsResponse {
  success: boolean;
  statistics: {
    total: number;
    created: number;
    updated: number;
    skipped: number;
    errors: number;
    regionsCreated: number;
  };
  message: string;
  errors?: Array<{
    rowNumber: number;
    message: string;
    data?: {
      name: string | null;
      phone: string;
      region: string;
    };
  }>;
  groupId: string;
  groupName: string;
}

/**
 * Импорт клиентов из Excel файла
 * 
 * @param groupId - ID группы клиентов
 * @param file - Excel файл для импорта
 * @returns Результат импорта со статистикой
 */
export async function importClients(
  groupId: string, 
  file: File, 
  configId?: string
): Promise<ImportClientsResponse> {
  const token = useAuthStore.getState().accessToken;
  
  if (!token) {
    throw { message: 'No access token available' } as ApiError;
  }

  // Создаем FormData для загрузки файла
  const formData = new FormData();
  formData.append('file', file);

  // Формируем URL с параметрами
  const params = new URLSearchParams({ groupId });
  if (configId) {
    params.append('configId', configId);
  }

  const response = await fetchWithAutoRefresh(`${API_BASE_URL}/import/clients?${params.toString()}`, {
    method: 'POST',
    headers: {
      // НЕ устанавливаем Content-Type - браузер установит автоматически с boundary для multipart/form-data
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  return handleResponse<ImportClientsResponse>(response);
}

// ============================================
// Импорт конфигураций
// ============================================

/**
 * Конфигурация импорта
 */
export interface ImportConfig {
  id?: string;
  name: string;
  description?: string;
  userId: string;
  isDefault?: boolean;
  searchScope: {
    scopes: Array<'none' | 'current_group' | 'owner_groups' | 'all_users'>;
    matchCriteria: 'phone' | 'phone_and_name' | 'name';
  };
  duplicateAction: {
    defaultAction: 'skip' | 'update' | 'create';
    updateName: boolean;
    updateRegion: boolean;
    addPhones: boolean;
    addToGroup: boolean;
    moveToGroup: boolean;
  };
  noDuplicateAction: 'create' | 'skip';
  validation: {
    requireName: boolean;
    requirePhone: boolean;
    requireRegion: boolean;
    errorHandling: 'stop' | 'skip' | 'warn';
  };
  additional: {
    newClientStatus: 'NEW' | 'OLD' | 'from_file';
    updateStatus: boolean;
  };
  createdAt?: string;
  updatedAt?: string;
}

/**
 * Список конфигураций с шаблонами
 */
export interface ImportConfigsListResponse {
  configs: ImportConfig[];
  templates: Array<{
    id: string;
    name: string;
    description?: string;
    isTemplate: true;
  }>;
}

/**
 * Получает список конфигураций импорта
 */
export async function getImportConfigs(includeTemplates = false): Promise<ImportConfigsListResponse> {
  const params = new URLSearchParams();
  if (includeTemplates) {
    params.append('includeTemplates', 'true');
  }

  const response = await fetchWithAutoRefresh(
    `${API_BASE_URL}/import/configs${params.toString() ? `?${params.toString()}` : ''}`,
    {
      method: 'GET',
      headers: createHeaders(),
    }
  );

  return handleResponse<ImportConfigsListResponse>(response);
}

/**
 * Получает конфигурацию по ID
 */
export async function getImportConfig(configId: string): Promise<ImportConfig> {
  const response = await fetchWithAutoRefresh(`${API_BASE_URL}/import/configs/${configId}`, {
    method: 'GET',
    headers: createHeaders(),
  });

  return handleResponse<ImportConfig>(response);
}

/**
 * Получает конфигурацию по умолчанию
 */
export async function getDefaultImportConfig(): Promise<ImportConfig> {
  const response = await fetchWithAutoRefresh(`${API_BASE_URL}/import/configs/default`, {
    method: 'GET',
    headers: createHeaders(),
  });

  return handleResponse<ImportConfig>(response);
}

/**
 * Создает новую конфигурацию
 */
export async function createImportConfig(config: Omit<ImportConfig, 'id' | 'userId' | 'createdAt' | 'updatedAt'>): Promise<ImportConfig> {
  const response = await fetchWithAutoRefresh(`${API_BASE_URL}/import/configs`, {
    method: 'POST',
    headers: createHeaders(),
    body: JSON.stringify(config),
  });

  return handleResponse<ImportConfig>(response);
}

/**
 * Обновляет конфигурацию
 */
export async function updateImportConfig(
  configId: string,
  config: Partial<Omit<ImportConfig, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>
): Promise<ImportConfig> {
  const response = await fetchWithAutoRefresh(`${API_BASE_URL}/import/configs/${configId}`, {
    method: 'PUT',
    headers: createHeaders(),
    body: JSON.stringify(config),
  });

  return handleResponse<ImportConfig>(response);
}

/**
 * Удаляет конфигурацию
 */
export async function deleteImportConfig(configId: string): Promise<void> {
  const response = await fetchWithAutoRefresh(`${API_BASE_URL}/import/configs/${configId}`, {
    method: 'DELETE',
    headers: createHeaders(),
  });

  if (!response.ok) {
    throw await handleErrorResponse(response);
  }
}

/**
 * Создает конфигурацию из шаблона
 */
export async function createConfigFromTemplate(
  templateName: string,
  customName?: string
): Promise<ImportConfig> {
  const response = await fetchWithAutoRefresh(`${API_BASE_URL}/import/configs/template/${templateName}`, {
    method: 'POST',
    headers: createHeaders(),
    body: JSON.stringify({ name: customName }),
  });

  return handleResponse<ImportConfig>(response);
}

// ============================================
// Export API
// ============================================

/**
 * Экспортирует группу клиентов в файл
 * 
 * @param groupId - ID группы для экспорта
 * @param format - Формат файла (xlsx, xls, csv)
 * @returns Promise, который резолвится после успешного скачивания файла
 */
export async function exportGroup(groupId: string, format: 'xlsx' | 'xls' | 'csv' = 'xlsx'): Promise<void> {
  const token = useAuthStore.getState().accessToken;
  
  if (!token) {
    throw { message: 'No access token available' } as ApiError;
  }

  const url = `${API_BASE_URL}/export/groups/${groupId}?format=${format}`;

  const response = await fetchWithAutoRefresh(url, {
    method: 'GET',
    headers: createHeaders(token),
  });

  if (!response.ok) {
    await handleResponse<never>(response);
    return;
  }

  // Получаем имя файла из заголовков
  // Сначала пробуем получить из X-Filename (самый надежный способ)
  let filename = response.headers.get('X-Filename');
  
  // Отладочное логирование (можно убрать после проверки)
  if (process.env.NODE_ENV === 'development') {
    console.log('Export headers:', {
      'X-Filename': response.headers.get('X-Filename'),
      'Content-Disposition': response.headers.get('Content-Disposition'),
      'All headers': Array.from(response.headers.entries()),
    });
  }
  
  if (!filename) {
    // Если нет X-Filename, пытаемся извлечь из Content-Disposition
    const contentDisposition = response.headers.get('Content-Disposition');
    if (contentDisposition) {
      // Сначала пытаемся извлечь из RFC 5987 формата (filename*=UTF-8''...)
      const rfc5987Match = contentDisposition.match(/filename\*=UTF-8''([^;\s]+)/);
      if (rfc5987Match && rfc5987Match[1]) {
        try {
          filename = decodeURIComponent(rfc5987Match[1]);
        } catch {
          // Если декодирование не удалось, пробуем другой формат
        }
      }
      
      // Если RFC 5987 не сработал, пробуем обычный формат (filename="...")
      if (!filename) {
        const filenameMatch = contentDisposition.match(/filename=["']?([^"';]+)["']?/i);
        if (filenameMatch && filenameMatch[1]) {
          filename = filenameMatch[1].trim();
        }
      }
    }
  }
  
  // Fallback на дефолтное имя, если ничего не получилось
  if (!filename) {
    filename = `group_${groupId}.${format}`;
  }

  // Создаем blob и скачиваем файл
  const blob = await response.blob();
  const downloadUrl = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = downloadUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(downloadUrl);
}

// ============================================
// Profiles API
// ============================================

/**
 * Создание профиля
 * 
 * @param profileData - Данные для создания профиля
 * @returns Созданный профиль
 */
export async function createProfile(profileData: CreateProfileInput): Promise<Profile> {
  const token = useAuthStore.getState().accessToken;
  
  if (!token) {
    throw { message: 'No access token available' } as ApiError;
  }

  const response = await fetchWithAutoRefresh(`${API_BASE_URL}/profiles`, {
    method: 'POST',
    headers: createHeaders(token),
    body: JSON.stringify(profileData),
  });

  return handleResponse<Profile>(response);
}

/**
 * Получение списка профилей
 * 
 * @param query - Query параметры (пагинация, фильтрация, сортировка)
 * @returns Список профилей с метаданными пагинации
 */
export async function listProfiles(query?: ListProfilesQuery): Promise<ProfilesListResponse> {
  const token = useAuthStore.getState().accessToken;
  
  if (!token) {
    throw { message: 'No access token available' } as ApiError;
  }

  // Построение query строки
  const queryParams = new URLSearchParams();
  if (query?.page) queryParams.append('page', query.page.toString());
  if (query?.limit) queryParams.append('limit', query.limit.toString());
  if (query?.status) queryParams.append('status', query.status);
  if (query?.sortBy) queryParams.append('sortBy', query.sortBy);
  if (query?.sortOrder) queryParams.append('sortOrder', query.sortOrder);

  const queryString = queryParams.toString();
  const url = `${API_BASE_URL}/profiles${queryString ? `?${queryString}` : ''}`;

  const response = await fetchWithAutoRefresh(url, {
    method: 'GET',
    headers: createHeaders(token),
  });

  return handleResponse<ProfilesListResponse>(response);
}

/**
 * Получение профиля по ID
 * 
 * @param profileId - ID профиля
 * @returns Данные профиля
 */
export async function getProfile(profileId: string): Promise<Profile> {
  const token = useAuthStore.getState().accessToken;
  
  if (!token) {
    throw { message: 'No access token available' } as ApiError;
  }

  const response = await fetchWithAutoRefresh(`${API_BASE_URL}/profiles/${profileId}`, {
    method: 'GET',
    headers: createHeaders(token),
  });

  return handleResponse<Profile>(response);
}

/**
 * Обновление профиля
 * 
 * @param profileId - ID профиля
 * @param profileData - Данные для обновления профиля
 * @returns Обновленный профиль
 */
export async function updateProfile(profileId: string, profileData: UpdateProfileInput): Promise<Profile> {
  const token = useAuthStore.getState().accessToken;
  
  if (!token) {
    throw { message: 'No access token available' } as ApiError;
  }

  const response = await fetchWithAutoRefresh(`${API_BASE_URL}/profiles/${profileId}`, {
    method: 'PATCH',
    headers: createHeaders(token),
    body: JSON.stringify(profileData),
  });

  return handleResponse<Profile>(response);
}

/**
 * Удаление профиля
 * 
 * @param profileId - ID профиля
 */
export async function deleteProfile(profileId: string): Promise<void> {
  const token = useAuthStore.getState().accessToken;
  
  if (!token) {
    throw { message: 'No access token available' } as ApiError;
  }

  const response = await fetchWithAutoRefresh(`${API_BASE_URL}/profiles/${profileId}`, {
    method: 'DELETE',
    headers: createHeaders(token),
  });

  await handleResponse<void>(response);
}

/**
 * Получение статуса профиля
 * 
 * @param profileId - ID профиля
 * @returns Статус профиля
 */
export async function getProfileStatus(profileId: string): Promise<ProfileStatusResponse> {
  const token = useAuthStore.getState().accessToken;
  
  if (!token) {
    throw { message: 'No access token available' } as ApiError;
  }

  const response = await fetchWithAutoRefresh(`${API_BASE_URL}/profiles/${profileId}/status`, {
    method: 'GET',
    headers: createHeaders(token),
  });

  return handleResponse<ProfileStatusResponse>(response);
}

/**
 * Запуск профиля
 * 
 * @param profileId - ID профиля
 * @param options - Опции запуска (опционально)
 * @returns Информация о запущенном процессе
 */
export async function startProfile(profileId: string, options?: StartProfileOptions): Promise<StartProfileResponse> {
  const token = useAuthStore.getState().accessToken;
  
  if (!token) {
    throw { message: 'No access token available' } as ApiError;
  }

  const response = await fetchWithAutoRefresh(`${API_BASE_URL}/profiles/${profileId}/start`, {
    method: 'POST',
    headers: createHeaders(token),
    body: options ? JSON.stringify(options) : undefined,
  });

  return handleResponse<StartProfileResponse>(response);
}

/**
 * Остановка профиля
 * 
 * @param profileId - ID профиля
 * @param force - Принудительная остановка
 * @returns Сообщение об успешной остановке
 */
export async function stopProfile(profileId: string, force: boolean = false): Promise<{ message: string }> {
  const token = useAuthStore.getState().accessToken;
  
  if (!token) {
    throw { message: 'No access token available' } as ApiError;
  }

  const queryParams = new URLSearchParams();
  if (force) queryParams.append('force', 'true');

  const queryString = queryParams.toString();
  const url = `${API_BASE_URL}/profiles/${profileId}/stop${queryString ? `?${queryString}` : ''}`;

  const response = await fetchWithAutoRefresh(url, {
    method: 'POST',
    headers: createHeaders(token),
  });

  return handleResponse<{ message: string }>(response);
}

/**
 * Получение статистики ресурсов профиля
 * 
 * @param profileId - ID профиля
 * @returns Статистика ресурсов или null, если профиль не запущен
 */
export async function getProfileResources(profileId: string): Promise<ProcessResourceStats | null> {
  const token = useAuthStore.getState().accessToken;
  
  if (!token) {
    throw { message: 'No access token available' } as ApiError;
  }

  const response = await fetchWithAutoRefresh(`${API_BASE_URL}/profiles/${profileId}/resources`, {
    method: 'GET',
    headers: createHeaders(token),
  });

  // Если профиль не запущен, может вернуться 404
  if (response.status === 404) {
    return null;
  }

  return handleResponse<ProcessResourceStats | null>(response);
}

/**
 * Получение истории статистики ресурсов профиля
 * 
 * @param profileId - ID профиля
 * @param limit - Максимальное количество записей
 * @param from - Начальная дата (ISO 8601)
 * @param to - Конечная дата (ISO 8601)
 * @returns История статистики ресурсов
 */
export async function getProfileResourcesHistory(
  profileId: string,
  limit?: number,
  from?: string,
  to?: string
): Promise<ProfileResourcesHistoryResponse> {
  const token = useAuthStore.getState().accessToken;
  
  if (!token) {
    throw { message: 'No access token available' } as ApiError;
  }

  const queryParams = new URLSearchParams();
  if (limit) queryParams.append('limit', limit.toString());
  if (from) queryParams.append('from', from);
  if (to) queryParams.append('to', to);

  const queryString = queryParams.toString();
  const url = `${API_BASE_URL}/profiles/${profileId}/resources/history${queryString ? `?${queryString}` : ''}`;

  const response = await fetchWithAutoRefresh(url, {
    method: 'GET',
    headers: createHeaders(token),
  });

  return handleResponse<ProfileResourcesHistoryResponse>(response);
}

/**
 * Проверка здоровья профиля
 * 
 * @param profileId - ID профиля
 * @returns Результат проверки здоровья
 */
export async function checkProfileHealth(profileId: string): Promise<ProfileHealthCheck> {
  const token = useAuthStore.getState().accessToken;
  
  if (!token) {
    throw { message: 'No access token available' } as ApiError;
  }

  const response = await fetchWithAutoRefresh(`${API_BASE_URL}/profiles/${profileId}/health`, {
    method: 'GET',
    headers: createHeaders(token),
  });

  return handleResponse<ProfileHealthCheck>(response);
}

/**
 * Получение статистики сетевой активности профиля
 * 
 * @param profileId - ID профиля
 * @returns Статистика сетевой активности или null, если профиль не запущен
 */
export async function getProfileNetworkStats(profileId: string): Promise<NetworkStats | null> {
  const token = useAuthStore.getState().accessToken;
  
  if (!token) {
    throw { message: 'No access token available' } as ApiError;
  }

  const response = await fetchWithAutoRefresh(`${API_BASE_URL}/profiles/${profileId}/network`, {
    method: 'GET',
    headers: createHeaders(token),
  });

  // Если профиль не запущен, может вернуться 404
  if (response.status === 404) {
    return null;
  }

  return handleResponse<NetworkStats | null>(response);
}

/**
 * Получение алертов профиля
 * 
 * @param profileId - ID профиля
 * @param limit - Максимальное количество алертов
 * @param unreadOnly - Только непрочитанные
 * @param from - Начальная дата (ISO 8601)
 * @param to - Конечная дата (ISO 8601)
 * @returns Список алертов
 */
export async function getProfileAlerts(
  profileId: string,
  limit?: number,
  unreadOnly?: boolean,
  from?: string,
  to?: string
): Promise<ProfileAlertsResponse> {
  const token = useAuthStore.getState().accessToken;
  
  if (!token) {
    throw { message: 'No access token available' } as ApiError;
  }

  const queryParams = new URLSearchParams();
  if (limit) queryParams.append('limit', limit.toString());
  if (unreadOnly) queryParams.append('unreadOnly', 'true');
  if (from) queryParams.append('from', from);
  if (to) queryParams.append('to', to);

  const queryString = queryParams.toString();
  const url = `${API_BASE_URL}/profiles/${profileId}/alerts${queryString ? `?${queryString}` : ''}`;

  const response = await fetchWithAutoRefresh(url, {
    method: 'GET',
    headers: createHeaders(token),
  });

  return handleResponse<ProfileAlertsResponse>(response);
}

/**
 * Получение количества непрочитанных алертов
 * 
 * @param profileId - ID профиля
 * @returns Количество непрочитанных алертов
 */
export async function getProfileUnreadAlertsCount(profileId: string): Promise<ProfileUnreadAlertsCountResponse> {
  const token = useAuthStore.getState().accessToken;
  
  if (!token) {
    throw { message: 'No access token available' } as ApiError;
  }

  const response = await fetchWithAutoRefresh(`${API_BASE_URL}/profiles/${profileId}/alerts/unread-count`, {
    method: 'GET',
    headers: createHeaders(token),
  });

  return handleResponse<ProfileUnreadAlertsCountResponse>(response);
}

/**
 * Отметка алерта как прочитанного
 * 
 * @param profileId - ID профиля
 * @param alertId - ID алерта
 * @returns Сообщение об успехе
 */
export async function markAlertAsRead(profileId: string, alertId: string): Promise<{ message: string }> {
  const token = useAuthStore.getState().accessToken;
  
  if (!token) {
    throw { message: 'No access token available' } as ApiError;
  }

  const response = await fetchWithAutoRefresh(`${API_BASE_URL}/profiles/${profileId}/alerts/${alertId}/read`, {
    method: 'POST',
    headers: createHeaders(token),
  });

  return handleResponse<{ message: string }>(response);
}

/**
 * Отметка всех алертов как прочитанных
 * 
 * @param profileId - ID профиля
 * @returns Сообщение и количество отмеченных алертов
 */
export async function markAllAlertsAsRead(profileId: string): Promise<{ message: string; markedCount: number }> {
  const token = useAuthStore.getState().accessToken;
  
  if (!token) {
    throw { message: 'No access token available' } as ApiError;
  }

  const response = await fetchWithAutoRefresh(`${API_BASE_URL}/profiles/${profileId}/alerts/read-all`, {
    method: 'POST',
    headers: createHeaders(token),
  });

  return handleResponse<{ message: string; markedCount: number }>(response);
}

/**
 * Получение аналитики профиля
 * 
 * @param profileId - ID профиля
 * @param period - Период агрегации
 * @param from - Начальная дата (ISO 8601)
 * @param to - Конечная дата (ISO 8601)
 * @returns Аналитика профиля
 */
export async function getProfileAnalytics(
  profileId: string,
  period?: AggregationPeriod,
  from?: string,
  to?: string
): Promise<ProfileAnalytics> {
  const token = useAuthStore.getState().accessToken;
  
  if (!token) {
    throw { message: 'No access token available' } as ApiError;
  }

  const queryParams = new URLSearchParams();
  if (period) queryParams.append('period', period);
  if (from) queryParams.append('from', from);
  if (to) queryParams.append('to', to);

  const queryString = queryParams.toString();
  const url = `${API_BASE_URL}/profiles/${profileId}/analytics${queryString ? `?${queryString}` : ''}`;

  const response = await fetchWithAutoRefresh(url, {
    method: 'GET',
    headers: createHeaders(token),
  });

  return handleResponse<ProfileAnalytics>(response);
}

// ============================================
// Profile Limits API
// ============================================

/**
 * Получение собственных лимитов профилей
 * 
 * @returns Лимиты профилей текущего пользователя
 */
export async function getMyLimits(): Promise<ProfileLimits> {
  const token = useAuthStore.getState().accessToken;
  
  if (!token) {
    throw { message: 'No access token available' } as ApiError;
  }

  const response = await fetchWithAutoRefresh(`${API_BASE_URL}/profiles/limits/me`, {
    method: 'GET',
    headers: createHeaders(token),
  });

  return handleResponse<ProfileLimits>(response);
}

/**
 * Получение всех лимитов профилей (ROOT only)
 * 
 * @returns Список всех лимитов
 */
export async function getAllLimits(): Promise<ProfileLimits[]> {
  const token = useAuthStore.getState().accessToken;
  
  if (!token) {
    throw { message: 'No access token available' } as ApiError;
  }

  const response = await fetchWithAutoRefresh(`${API_BASE_URL}/profiles/limits`, {
    method: 'GET',
    headers: createHeaders(token),
  });

  return handleResponse<ProfileLimits[]>(response);
}

/**
 * Получение лимитов профилей пользователя (ROOT only)
 * 
 * @param userId - ID пользователя
 * @returns Лимиты профилей пользователя
 */
export async function getUserLimits(userId: string): Promise<ProfileLimits> {
  const token = useAuthStore.getState().accessToken;
  
  if (!token) {
    throw { message: 'No access token available' } as ApiError;
  }

  const response = await fetchWithAutoRefresh(`${API_BASE_URL}/profiles/limits/${userId}`, {
    method: 'GET',
    headers: createHeaders(token),
  });

  return handleResponse<ProfileLimits>(response);
}

/**
 * Установка лимитов профилей для пользователя (ROOT only)
 * 
 * @param userId - ID пользователя
 * @param limitsData - Данные для установки лимитов
 * @returns Установленные лимиты
 */
export async function setUserLimits(userId: string, limitsData: SetProfileLimitsInput): Promise<ProfileLimits> {
  const token = useAuthStore.getState().accessToken;
  
  if (!token) {
    throw { message: 'No access token available' } as ApiError;
  }

  const response = await fetchWithAutoRefresh(`${API_BASE_URL}/profiles/limits/${userId}`, {
    method: 'PUT',
    headers: createHeaders(token),
    body: JSON.stringify(limitsData),
  });

  return handleResponse<ProfileLimits>(response);
}

// ============================================
// Messenger Accounts API
// ============================================

/**
 * Получение всех мессенджеров (справочник)
 * 
 * @returns Список всех доступных мессенджеров в системе
 */
export async function getAllMessengerServices(): Promise<MessengerService[]> {
  const token = useAuthStore.getState().accessToken;
  
  if (!token) {
    throw { message: 'No access token available' } as ApiError;
  }

  const response = await fetchWithAutoRefresh(`${API_BASE_URL}/services`, {
    method: 'GET',
    headers: createHeaders(token),
  });

  return handleResponse<MessengerService[]>(response);
}

/**
 * Получение мессенджера по ID
 * 
 * @param serviceId - ID мессенджера
 * @returns Информация о мессенджере
 */
export async function getMessengerServiceById(serviceId: string): Promise<MessengerService> {
  const token = useAuthStore.getState().accessToken;
  
  if (!token) {
    throw { message: 'No access token available' } as ApiError;
  }

  const response = await fetchWithAutoRefresh(`${API_BASE_URL}/services/${serviceId}`, {
    method: 'GET',
    headers: createHeaders(token),
  });

  return handleResponse<MessengerService>(response);
}

/**
 * Получение всех аккаунтов мессенджеров профиля
 * 
 * @param profileId - ID профиля
 * @returns Список аккаунтов мессенджеров профиля
 */
export async function getMessengerAccountsByProfile(profileId: string): Promise<ProfileMessengerAccount[]> {
  const token = useAuthStore.getState().accessToken;
  
  if (!token) {
    throw { message: 'No access token available' } as ApiError;
  }

  const response = await fetchWithAutoRefresh(`${API_BASE_URL}/profiles/${profileId}/messenger-accounts`, {
    method: 'GET',
    headers: createHeaders(token),
  });

  return handleResponse<ProfileMessengerAccount[]>(response);
}

/**
 * Получение аккаунта мессенджера по ID
 * 
 * @param profileId - ID профиля
 * @param accountId - ID аккаунта
 * @returns Информация об аккаунте мессенджера
 */
export async function getMessengerAccountById(profileId: string, accountId: string): Promise<ProfileMessengerAccount> {
  const token = useAuthStore.getState().accessToken;
  
  if (!token) {
    throw { message: 'No access token available' } as ApiError;
  }

  const response = await fetchWithAutoRefresh(`${API_BASE_URL}/profiles/${profileId}/messenger-accounts/${accountId}`, {
    method: 'GET',
    headers: createHeaders(token),
  });

  return handleResponse<ProfileMessengerAccount>(response);
}

/**
 * Создание аккаунта мессенджера для профиля
 * 
 * @param profileId - ID профиля
 * @param accountData - Данные для создания аккаунта
 * @returns Созданный аккаунт мессенджера
 */
export async function createMessengerAccount(
  profileId: string,
  accountData: CreateMessengerAccountInput
): Promise<ProfileMessengerAccount> {
  const token = useAuthStore.getState().accessToken;
  
  if (!token) {
    throw { message: 'No access token available' } as ApiError;
  }

  const response = await fetchWithAutoRefresh(`${API_BASE_URL}/profiles/${profileId}/messenger-accounts`, {
    method: 'POST',
    headers: createHeaders(token),
    body: JSON.stringify(accountData),
  });

  return handleResponse<ProfileMessengerAccount>(response);
}

/**
 * Обновление аккаунта мессенджера
 * 
 * @param profileId - ID профиля
 * @param accountId - ID аккаунта
 * @param accountData - Данные для обновления аккаунта
 * @returns Обновленный аккаунт мессенджера
 */
export async function updateMessengerAccount(
  profileId: string,
  accountId: string,
  accountData: UpdateMessengerAccountInput
): Promise<ProfileMessengerAccount> {
  const token = useAuthStore.getState().accessToken;
  
  if (!token) {
    throw { message: 'No access token available' } as ApiError;
  }

  const response = await fetchWithAutoRefresh(`${API_BASE_URL}/profiles/${profileId}/messenger-accounts/${accountId}`, {
    method: 'PATCH',
    headers: createHeaders(token),
    body: JSON.stringify(accountData),
  });

  return handleResponse<ProfileMessengerAccount>(response);
}

/**
 * Удаление аккаунта мессенджера
 * 
 * @param profileId - ID профиля
 * @param accountId - ID аккаунта
 */
export async function deleteMessengerAccount(profileId: string, accountId: string): Promise<void> {
  const token = useAuthStore.getState().accessToken;
  
  if (!token) {
    throw { message: 'No access token available' } as ApiError;
  }

  const response = await fetchWithAutoRefresh(`${API_BASE_URL}/profiles/${profileId}/messenger-accounts/${accountId}`, {
    method: 'DELETE',
    headers: createHeaders(token),
  });

  await handleResponse<void>(response);
}

/**
 * Включение мессенджера для профиля
 * 
 * @param profileId - ID профиля
 * @param accountId - ID аккаунта
 * @returns Обновленный аккаунт мессенджера
 */
export async function enableMessengerAccount(profileId: string, accountId: string): Promise<ProfileMessengerAccount> {
  const token = useAuthStore.getState().accessToken;
  
  if (!token) {
    throw { message: 'No access token available' } as ApiError;
  }

  const response = await fetchWithAutoRefresh(`${API_BASE_URL}/profiles/${profileId}/messenger-accounts/${accountId}/enable`, {
    method: 'POST',
    headers: createHeaders(token),
  });

  return handleResponse<ProfileMessengerAccount>(response);
}

/**
 * Выключение мессенджера для профиля
 * 
 * @param profileId - ID профиля
 * @param accountId - ID аккаунта
 * @returns Обновленный аккаунт мессенджера
 */
export async function disableMessengerAccount(profileId: string, accountId: string): Promise<ProfileMessengerAccount> {
  const token = useAuthStore.getState().accessToken;
  
  if (!token) {
    throw { message: 'No access token available' } as ApiError;
  }

  const response = await fetchWithAutoRefresh(`${API_BASE_URL}/profiles/${profileId}/messenger-accounts/${accountId}/disable`, {
    method: 'POST',
    headers: createHeaders(token),
  });

  return handleResponse<ProfileMessengerAccount>(response);
}

/**
 * Получение количества аккаунтов мессенджеров для списка профилей
 * 
 * @param profileIds - Массив ID профилей
 * @returns Объект с количеством аккаунтов для каждого профиля: { profileId: count }
 */
export async function getMessengerAccountsCounts(profileIds: string[]): Promise<Record<string, number>> {
  const token = useAuthStore.getState().accessToken;
  
  if (!token) {
    throw { message: 'No access token available' } as ApiError;
  }

  const response = await fetchWithAutoRefresh(`${API_BASE_URL}/messenger-accounts/counts`, {
    method: 'POST',
    headers: createHeaders(token),
    body: JSON.stringify({ profileIds }),
  });

  return handleResponse<Record<string, number>>(response);
}

/**
 * Проверка статуса входа аккаунта мессенджера
 * 
 * @param profileId - ID профиля
 * @param accountId - ID аккаунта
 * @returns Результат проверки статуса с QR кодом (если требуется вход)
 */
export async function checkMessengerAccountStatus(profileId: string, accountId: string): Promise<LoginCheckResult> {
  const token = useAuthStore.getState().accessToken;
  
  if (!token) {
    throw { message: 'No access token available' } as ApiError;
  }

  const response = await fetchWithAutoRefresh(`${API_BASE_URL}/profiles/${profileId}/messenger-accounts/${accountId}/check`, {
    method: 'POST',
    headers: createHeaders(token),
  });

  return handleResponse<LoginCheckResult>(response);
}

/**
 * Результат ввода облачного пароля
 */
export interface CloudPasswordResult {
  success: boolean;
  status: string;
  error?: string;
}

/**
 * Ввод облачного пароля (2FA) для Telegram
 * 
 * @param profileId - ID профиля
 * @param accountId - ID аккаунта мессенджера
 * @param password - Облачный пароль
 * @returns Результат ввода пароля
 */
export async function submitCloudPassword(profileId: string, accountId: string, password: string): Promise<CloudPasswordResult> {
  const token = useAuthStore.getState().accessToken;
  
  if (!token) {
    throw { message: 'No access token available' } as ApiError;
  }

  const response = await fetchWithAutoRefresh(`${API_BASE_URL}/profiles/${profileId}/messenger-accounts/${accountId}/cloud-password`, {
    method: 'POST',
    headers: createHeaders(token),
    body: JSON.stringify({ password }),
  });

  return handleResponse<CloudPasswordResult>(response);
}

/**
 * Получение всех конфигураций проверки (ROOT only)
 * 
 * @returns Список всех конфигураций проверки
 */
export async function getAllMessengerCheckConfigs(): Promise<MessengerCheckConfig[]> {
  const token = useAuthStore.getState().accessToken;
  
  if (!token) {
    throw { message: 'No access token available' } as ApiError;
  }

  const response = await fetchWithAutoRefresh(`${API_BASE_URL}/messenger-check-configs`, {
    method: 'GET',
    headers: createHeaders(token),
  });

  return handleResponse<MessengerCheckConfig[]>(response);
}

/**
 * Получение конфигурации проверки по serviceId (ROOT only)
 * 
 * @param serviceId - ID мессенджера
 * @returns Конфигурация проверки
 */
export async function getMessengerCheckConfigByServiceId(serviceId: string): Promise<MessengerCheckConfig> {
  const token = useAuthStore.getState().accessToken;
  
  if (!token) {
    throw { message: 'No access token available' } as ApiError;
  }

  const response = await fetchWithAutoRefresh(`${API_BASE_URL}/messenger-check-configs/${serviceId}`, {
    method: 'GET',
    headers: createHeaders(token),
  });

  return handleResponse<MessengerCheckConfig>(response);
}

/**
 * Обновление конфигурации проверки (ROOT only)
 * 
 * @param serviceId - ID мессенджера
 * @param configData - Данные для обновления конфигурации
 * @returns Обновленная конфигурация проверки
 */
export async function updateMessengerCheckConfig(
  serviceId: string,
  configData: UpdateMessengerCheckConfigInput
): Promise<MessengerCheckConfig> {
  const token = useAuthStore.getState().accessToken;
  
  if (!token) {
    throw { message: 'No access token available' } as ApiError;
  }

  const response = await fetchWithAutoRefresh(`${API_BASE_URL}/messenger-check-configs/${serviceId}`, {
    method: 'PUT',
    headers: createHeaders(token),
    body: JSON.stringify(configData),
  });

  return handleResponse<MessengerCheckConfig>(response);
}
