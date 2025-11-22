/**
 * Error Boundary компонент
 * 
 * Перехватывает ошибки React в дочерних компонентах и отображает fallback UI.
 * Используется для обработки ошибок рендеринга, которые не могут быть обработаны try-catch.
 * 
 * ВАЖНО: Error Boundary не перехватывает ошибки в:
 * - Обработчиках событий
 * - Асинхронном коде (setTimeout, промисы)
 * - SSR
 * - Самих Error Boundary компонентах
 */

import React, { Component, type ReactNode } from 'react';
import { Box, Typography, Button, Paper, Alert } from '@mui/material';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

/**
 * Error Boundary классовый компонент
 * 
 * React требует классовый компонент для Error Boundary (hooks не поддерживаются).
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    // Обновляет состояние, чтобы следующий рендер показал fallback UI
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    // Логируем ошибку для мониторинга
    // eslint-disable-next-line no-console
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    
    this.setState({
      error,
      errorInfo,
    });
  }

  handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      // Если есть кастомный fallback, используем его
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Иначе показываем стандартный UI ошибки
      return (
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: '100vh',
            padding: 2,
          }}
        >
          <Paper sx={{ p: 4, maxWidth: 600, width: '100%' }}>
            <Alert severity="error" sx={{ mb: 2 }}>
              <Typography variant="h5" component="h1" gutterBottom>
                Произошла ошибка
              </Typography>
              <Typography variant="body1" sx={{ mb: 2 }}>
                Приложение столкнулось с неожиданной ошибкой. Пожалуйста, попробуйте обновить страницу.
              </Typography>
            </Alert>

            {process.env.NODE_ENV === 'development' && this.state.error && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="body2" component="pre" sx={{ 
                  backgroundColor: '#f5f5f5', 
                  padding: 2, 
                  borderRadius: 1,
                  overflow: 'auto',
                  fontSize: '0.875rem',
                }}>
                  {this.state.error.toString()}
                  {this.state.errorInfo?.componentStack}
                </Typography>
              </Box>
            )}

            <Box sx={{ mt: 3, display: 'flex', gap: 2 }}>
              <Button variant="contained" onClick={this.handleReset}>
                Попробовать снова
              </Button>
              <Button
                variant="outlined"
                onClick={() => {
                  window.location.reload();
                }}
              >
                Обновить страницу
              </Button>
            </Box>
          </Paper>
        </Box>
      );
    }

    return this.props.children;
  }
}


