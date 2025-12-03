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
import { Box, Typography } from '@mui/material';
import { AuthProvider, ProtectedRoute, RootRoute, PublicRoute, ErrorBoundary, Sidebar } from '@/components';
import { LoginPage, UsersAdminPage, ClientsPage, RegionsAdminPage, ProfilesPage, ProfileLimitsPage, MessengerConfigsAdminPage } from '@/pages';
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
 * Компонент-обертка для контента с сайдбаром
 * 
 * Обеспечивает правильное позиционирование контента относительно сайдбара.
 * Добавляет отступ слева, равный ширине сайдбара (200px).
 */
function AppLayout({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((state) => state.user);

  return (
    <Box
      sx={{
        display: 'flex',
        minHeight: '100vh',
      }}
    >
      {/* Сайдбар отображается только для авторизованных пользователей */}
      {user && <Sidebar />}
      
      {/* Контент с отступом под сайдбар */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          marginLeft: user ? '200px' : 0, // Отступ равен ширине сайдбара
          transition: 'margin-left 0.3s cubic-bezier(0.4, 0, 0.2, 1)', // Плавный переход
          padding: 3, // Внутренние отступы для контента
          overflowY: 'auto',
          overflowX: 'hidden',
          height: '100vh',
          '&::-webkit-scrollbar': {
            display: 'none',
            width: 0,
            height: 0,
          },
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          '& *': {
            '&::-webkit-scrollbar': {
              display: 'none',
              width: 0,
              height: 0,
            },
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
          },
        }}
      >
        {children}
      </Box>
    </Box>
  );
}

/**
 * Главная страница (Dashboard)
 * 
 * Пока простая заглушка. В будущем будет заменена на полноценный dashboard.
 */
function HomePage() {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 'calc(100vh - 48px)', // Вычитаем padding из AppLayout
      }}
    >
      <Typography
        variant="h1"
        sx={{
          color: '#f5f5f5', // Молочный цвет
          fontSize: '4rem', // Крупные буквы
          fontWeight: 500,
          textAlign: 'center',
        }}
      >
        HelloWorld
      </Typography>
    </Box>
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
    <ErrorBoundary>
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
                    <AppLayout>
                      <HomePage />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/users"
                element={
                  <RootRoute>
                    <AppLayout>
                      <UsersAdminPage />
                    </AppLayout>
                  </RootRoute>
                }
              />
              <Route
                path="/admin/regions"
                element={
                  <RootRoute>
                    <AppLayout>
                      <RegionsAdminPage />
                    </AppLayout>
                  </RootRoute>
                }
              />
              <Route
                path="/clients"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <ClientsPage />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/profiles"
                element={
                  <ProtectedRoute>
                    <AppLayout>
                      <ProfilesPage />
                    </AppLayout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/profile-limits"
                element={
                  <RootRoute>
                    <AppLayout>
                      <ProfileLimitsPage />
                    </AppLayout>
                  </RootRoute>
                }
              />
              <Route
                path="/admin/messenger-configs"
                element={
                  <RootRoute>
                    <AppLayout>
                      <MessengerConfigsAdminPage />
                    </AppLayout>
                  </RootRoute>
                }
              />
              <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </AuthProvider>
          </BrowserRouter>
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
};

export default App;

