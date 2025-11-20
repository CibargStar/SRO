/**
 * RootRoute компонент
 * 
 * Маршрут только для ROOT пользователей - разрешает доступ только пользователям с ролью ROOT.
 * Если пользователь не авторизован, редиректит на /login.
 * Если пользователь авторизован, но не ROOT, редиректит на / (главную страницу).
 * 
 * ВАЖНО: Это только проверка на фронтенде для UX.
 * Backend всё равно должен проверять роль через middleware (authMiddleware + requireAuth + requireRoot).
 * Backend возвращает 403 Forbidden, если роль не ROOT.
 * 
 * @example
 * ```typescript
 * <Route
 *   path="/admin/users"
 *   element={
 *     <RootRoute>
 *       <UsersManagement />
 *     </RootRoute>
 *   }
 * />
 * ```
 */

import React from 'react';
import { Navigate } from 'react-router-dom';
import { useIsAuthenticated, useIsRoot } from '@/store';

interface RootRouteProps {
  children: React.ReactNode;
}

/**
 * RootRoute
 * 
 * Проверяет isAuthenticated и isRoot.
 * - Если не авторизован → редирект на /login
 * - Если авторизован, но не ROOT → редирект на /
 * - Если ROOT → разрешает доступ
 */
export function RootRoute({ children }: RootRouteProps) {
  const isAuthenticated = useIsAuthenticated();
  const isRoot = useIsRoot();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!isRoot) {
    // Пользователь авторизован, но не ROOT - редирект на главную
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

