/**
 * Страница входа в систему
 * 
 * Предоставляет форму для входа с валидацией через React Hook Form и Zod.
 * Использует MUI компоненты для UI.
 */

import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Box,
  Button,
  Container,
  TextField,
  Typography,
  Paper,
  Alert,
  CircularProgress,
} from '@mui/material';
import { loginSchema, type LoginFormData } from '@/schemas/auth.schema';
import { useLogin } from '@/hooks/useAuth';

/**
 * Страница входа
 * 
 * Предоставляет форму для входа в систему.
 * После успешного входа происходит редирект.
 * 
 * @example
 * ```typescript
 * <LoginPage />
 * ```
 */
export function LoginPage() {
  const navigate = useNavigate();
  const loginMutation = useLogin();

  // Редирект после успешного входа
  useEffect(() => {
    if (loginMutation.isSuccess) {
      navigate('/', { replace: true });
    }
  }, [loginMutation.isSuccess, navigate]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = (data: LoginFormData) => {
    loginMutation.mutate(data);
  };

  // Общая ошибка (без деталей для безопасности)
  const errorMessage = loginMutation.error
    ? 'Неверный email или пароль'
    : null;

  return (
    <Container component="main" maxWidth="xs">
      <Box
        sx={{
          marginTop: 8,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <Paper
          elevation={3}
          sx={{
            padding: 4,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            width: '100%',
          }}
        >
          <Typography component="h1" variant="h5" gutterBottom>
            Вход в систему
          </Typography>

          {errorMessage && (
            <Alert severity="error" sx={{ width: '100%', mt: 2, mb: 2 }}>
              {errorMessage}
            </Alert>
          )}

          <Box
            component="form"
            onSubmit={handleSubmit(onSubmit)}
            sx={{ mt: 1, width: '100%' }}
          >
            <TextField
              {...register('email')}
              margin="normal"
              required
              fullWidth
              id="email"
              label="Email"
              name="email"
              autoComplete="email"
              autoFocus
              error={!!errors.email}
              helperText={errors.email?.message}
              disabled={loginMutation.isPending}
            />

            <TextField
              {...register('password')}
              margin="normal"
              required
              fullWidth
              name="password"
              label="Пароль"
              type="password"
              id="password"
              autoComplete="current-password"
              error={!!errors.password}
              helperText={errors.password?.message}
              disabled={loginMutation.isPending}
            />

            <Button
              type="submit"
              fullWidth
              variant="contained"
              sx={{ mt: 3, mb: 2 }}
              disabled={loginMutation.isPending}
            >
              {loginMutation.isPending ? (
                <CircularProgress size={24} color="inherit" />
              ) : (
                'Войти'
              )}
            </Button>
          </Box>
        </Paper>
      </Box>
    </Container>
  );
}

