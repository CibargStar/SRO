/**
 * Главный компонент приложения
 * 
 * Точка входа для всего React приложения.
 * Здесь настраиваются роутинг, провайдеры и основная структура приложения.
 */

import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { AuthProvider, ProtectedRoute, RootRoute, PublicRoute } from '@/components';
import { LoginPage, UsersAdminPage } from '@/pages';
import { useAuthStore } from '@/store';

/**
 * React Query клиент
 * 
 * Настройки по умолчанию для кэширования и запросов.
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: false,
      staleTime: 5 * 60 * 1000, // 5 минут
    },
    mutations: {
      retry: false,
    },
  },
});

/**
 * MUI Theme
 * 
 * Базовая тема Material-UI.
 */
const theme = createTheme({
  palette: {
    mode: 'light',
  },
});

/**
 * Главная страница (Dashboard)
 * 
 * Пока простая заглушка. В будущем будет заменена на полноценный dashboard.
 */
function HomePage() {
  const user = useAuthStore((state) => state.user);

  return (
    <div>
      <h1>BM Tools</h1>
      {user && (
        <div>
          <p>Добро пожаловать, {user.email}!</p>
          <p>Роль: {user.role}</p>
        </div>
      )}
    </div>
  );
}

/**
 * App Component
 * 
 * Основной компонент приложения.
 * Настроены провайдеры: React Query, MUI Theme, Router и Auth.
 * 
 * @returns JSX элемент приложения
 */
const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route
                path="/login"
                element={
                  <PublicRoute>
                    <LoginPage />
                  </PublicRoute>
                }
              />
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <HomePage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/users"
                element={
                  <RootRoute>
                    <UsersAdminPage />
                  </RootRoute>
                }
              />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

export default App;

