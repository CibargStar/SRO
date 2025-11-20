/**
 * Zustand store для авторизации
 * 
 * Хранит состояние авторизации:
 * - user - данные пользователя
 * - accessToken - access токен
 * - refreshToken - refresh токен
 * - isAuthenticated - флаг авторизации (computed)
 * - isRoot - флаг ROOT пользователя (computed)
 * 
 * Экшены:
 * - setAuth() - установка токенов и пользователя
 * - clearAuth() - очистка состояния авторизации
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '@/types';

interface AuthState {
  // Состояние
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;

  // Экшены
  setAuth: (accessToken: string, refreshToken: string, user: User) => void;
  clearAuth: () => void;
  updateUser: (user: User) => void;
  updateTokens: (accessToken: string, refreshToken: string) => void;
}

/**
 * Zustand store для авторизации
 * 
 * ВАЖНО - БЕЗОПАСНОСТЬ XSS:
 * =========================
 * 
 * Использует persist middleware для сохранения токенов в localStorage.
 * 
 * РИСКИ:
 * - localStorage доступен для XSS атак (если в приложении есть уязвимость XSS, 
 *   злоумышленник может получить доступ к токенам через localStorage)
 * - Токены сохраняются в открытом виде (не зашифрованы)
 * 
 * ЗАЩИТА:
 * - Всегда валидировать и санитизировать пользовательский ввод
 * - Использовать Content Security Policy (CSP)
 * - Регулярно проверять зависимости на уязвимости
 * - В production рассмотреть использование httpOnly cookies для refresh token
 * 
 * АЛЬТЕРНАТИВЫ:
 * - SessionStorage (данные удаляются при закрытии вкладки)
 * - httpOnly cookies (только для refresh token, недоступны для JS)
 * - In-memory storage (данные теряются при перезагрузке страницы)
 * 
 * ТЕКУЩАЯ РЕАЛИЗАЦИЯ:
 * - Токены сохраняются в localStorage для удобства пользователя (авторизация 
 *   сохраняется между перезагрузками)
 * - Backend проверяет токены на каждом запросе (даже при утечке токен недействителен 
 *   после logout или смены пароля)
 * - Access токены короткоживущие (15 минут по умолчанию)
 * - Refresh токены могут быть отозваны через API
 * 
 * ПРИМЕЧАНИЕ:
 * В будущем рекомендуется переместить refresh token в httpOnly cookie для 
 * дополнительной защиты от XSS атак.
 */
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      // Начальное состояние
      user: null,
      accessToken: null,
      refreshToken: null,

      // Экшены
      setAuth: (accessToken, refreshToken, user) => {
        set({
          accessToken,
          refreshToken,
          user,
        });
      },

      clearAuth: () => {
        set({
          accessToken: null,
          refreshToken: null,
          user: null,
        });
      },

      updateUser: (user) => {
        set({ user });
      },

      updateTokens: (accessToken, refreshToken) => {
        set({
          accessToken,
          refreshToken,
        });
      },
    }),
    {
      name: 'auth-storage', // Ключ в localStorage
      // Сохраняем токены и базовую информацию о пользователе для быстрого восстановления
      // ВАЖНО: Токены и базовая информация хранятся в localStorage (см. комментарий выше о рисках XSS)
      // Сохраняем только безопасные поля пользователя (id, email, role) для UX
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        // Сохраняем базовую информацию о пользователе для быстрого восстановления состояния
        // Это предотвращает редирект на /login при перезагрузке страницы
        user: state.user ? {
          id: state.user.id,
          email: state.user.email,
          role: state.user.role,
          name: state.user.name,
          isActive: state.user.isActive,
          // Не сохраняем createdAt и updatedAt - они будут обновлены при следующем запросе
        } : null,
      }),
    }
  )
);

/**
 * Селекторы для computed значений
 */

/**
 * Проверка авторизации
 */
export const useIsAuthenticated = () => {
  const accessToken = useAuthStore((state) => state.accessToken);
  const user = useAuthStore((state) => state.user);
  return !!accessToken && !!user;
};

/**
 * Проверка ROOT роли
 */
export const useIsRoot = () => {
  const user = useAuthStore((state) => state.user);
  return user?.role === 'ROOT';
};

