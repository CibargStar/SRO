/**
 * PublicRoute компонент
 * 
 * Публичный маршрут - разрешает доступ только неавторизованным пользователям.
 * Если пользователь уже авторизован, редиректит на / (главную страницу).
 * 
 * Используется для страниц логина, регистрации и т.д.
 * 
 * @example
 * ```typescript
 * <Route
 *   path="/login"
 *   element={
 *     <PublicRoute>
 *       <LoginPage />
 *     </PublicRoute>
 *   }
 * />
 * ```
 */

import React from 'react';
import { Navigate } from 'react-router-dom';
import { useIsAuthenticated } from '@/store';

interface PublicRouteProps {
  children: React.ReactNode;
}

/**
 * PublicRoute
 * 
 * Проверяет isAuthenticated и редиректит на /, если пользователь уже авторизован.
 */
export function PublicRoute({ children }: PublicRouteProps) {
  const isAuthenticated = useIsAuthenticated();

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

