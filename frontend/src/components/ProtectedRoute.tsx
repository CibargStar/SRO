/**
 * ProtectedRoute компонент
 * 
 * Защищенный маршрут - разрешает доступ только авторизованным пользователям.
 * Если пользователь не авторизован, редиректит на /login.
 * 
 * ВАЖНО: Это только проверка на фронтенде для UX.
 * Backend всё равно должен проверять авторизацию через middleware (authMiddleware + requireAuth).
 * 
 * @example
 * ```typescript
 * <Route
 *   path="/dashboard"
 *   element={
 *     <ProtectedRoute>
 *       <Dashboard />
 *     </ProtectedRoute>
 *   }
 * />
 * ```
 */

import React from 'react';
import { Navigate } from 'react-router-dom';
import { useIsAuthenticated } from '@/store';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

/**
 * ProtectedRoute
 * 
 * Проверяет isAuthenticated и редиректит на /login, если пользователь не авторизован.
 */
export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const isAuthenticated = useIsAuthenticated();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

