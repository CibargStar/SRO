/**
 * Страница входа в систему
 * 
 * Предоставляет форму для входа с валидацией через React Hook Form и Zod.
 * Использует MUI компоненты для UI.
 */

import React, { useRef, startTransition } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box,
  Button,
  TextField,
  Typography,
  Alert,
  CircularProgress,
  Collapse,
  Fade,
  InputAdornment,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import { StyledButton } from '@/components/common/FormStyles';
import { LOADING_ICON_SIZE } from '@/components/common/Constants';
import EmailIcon from '@mui/icons-material/Email';
import LockIcon from '@mui/icons-material/Lock';
import { loginSchema, type LoginFormData } from '@/schemas/auth.schema';
import { authKeys } from '@/hooks/useAuth';
import { login } from '@/utils/api';
import { useAuthStore } from '@/store';
import { getAuthErrorInfo } from '@/utils/errorHandler';
import type { LoginInput, LoginResponse, User } from '@/types';

/**
 * Стилизованное поле ввода
 * 
 * Минималистичный дизайн с скругленными углами.
 */
const StyledTextField = styled(TextField)(({ theme }) => ({
  '& .MuiOutlinedInput-root': {
    borderRadius: '12px', // Скругленные углы
    backgroundColor: 'rgba(255, 255, 255, 0.05)', // Полупрозрачный белый фон
    color: '#ffffff',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    
    '& fieldset': {
      border: 'none', // Убираем обводку
    },
    
    '&:hover fieldset': {
      border: 'none', // Убираем обводку при наведении
    },
    
    '&.Mui-focused fieldset': {
      border: 'none', // Убираем обводку при фокусе
    },
    
    '&.Mui-error fieldset': {
      border: 'none', // Убираем обводку при ошибке
    },
    
    // Переопределение стилей автозаполнения браузера (Chrome)
    '& .MuiInputBase-input': {
      '&:-webkit-autofill': {
        WebkitBoxShadow: '0 0 0 1000px #2c2c2c inset !important',
        WebkitTextFillColor: '#ffffff !important',
        backgroundColor: '#2c2c2c !important',
        caretColor: '#ffffff',
        borderRadius: '12px',
        transition: 'background-color 5000s ease-in-out 0s', // Долгая задержка для предотвращения смены цвета
      },
      
      '&:-webkit-autofill:hover': {
        WebkitBoxShadow: '0 0 0 1000px #2c2c2c inset !important',
        WebkitTextFillColor: '#ffffff !important',
        backgroundColor: '#2c2c2c !important',
      },
      
      '&:-webkit-autofill:focus': {
        WebkitBoxShadow: '0 0 0 1000px #2c2c2c inset !important',
        WebkitTextFillColor: '#ffffff !important',
        backgroundColor: '#2c2c2c !important',
      },
      
      '&:-webkit-autofill:active': {
        WebkitBoxShadow: '0 0 0 1000px #2c2c2c inset !important',
        WebkitTextFillColor: '#ffffff !important',
        backgroundColor: '#2c2c2c !important',
      },
    },
  },
  
  '& .MuiInputLabel-root': {
    color: 'rgba(255, 255, 255, 0.7)', // Полупрозрачный белый для label
  },
  
  '& .MuiInputLabel-root.Mui-focused': {
    color: 'rgba(255, 255, 255, 0.9)', // Более яркий label при фокусе
  },
  
  '& .MuiFormHelperText-root': {
    color: 'rgba(255, 255, 255, 0.6)', // Полупрозрачный белый для helper text
    transition: 'opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1), transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  },
  
  '& .MuiFormHelperText-root.Mui-error': {
    color: '#f44336', // Красный для ошибок
  },
}));

/**
 * Стилизованный контейнер для ошибок валидации
 * 
 * Использует абсолютное позиционирование, чтобы не сдвигать элементы формы.
 * Обеспечивает плавную анимацию появления и исчезновения ошибок.
 */
const ErrorMessageContainer = styled(Box)({
  position: 'absolute',
  top: '100%',
  left: 0,
  right: 0,
  zIndex: 1,
  pointerEvents: 'none', // Не блокируем взаимодействие с элементами под ошибкой
  overflow: 'hidden',
});

/**
 * Анимированный контейнер для ошибок валидации с абсолютным позиционированием
 * 
 * Использует Fade для плавной анимации появления/исчезновения.
 * Не занимает место в потоке документа благодаря абсолютному позиционированию.
 */
const AbsoluteErrorContainer = styled(Box)({
  position: 'absolute',
  top: '100%',
  left: 0,
  right: 0,
  zIndex: 1,
  pointerEvents: 'none',
});

/**
 * Стилизованный текст ошибки
 * 
 * Плавное появление и исчезновение с правильными отступами.
 * Не занимает место в потоке документа благодаря абсолютному позиционированию родителя.
 */
const ErrorText = styled(Typography)({
  color: '#f44336',
  display: 'block',
  marginTop: 2, // Минимальный отступ от поля ввода
  marginLeft: 14,
  fontSize: '0.75rem',
  lineHeight: 1.66,
  transition: 'opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1), transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
});

/**
 * Стилизованный Collapse для плавных анимаций
 * 
 * Использует единую timing function для всех анимаций.
 * Обеспечивает плавное появление и исчезновение в обе стороны.
 */
const AnimatedCollapse = styled(Collapse)({
  transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
  // Убеждаемся, что анимация работает плавно в обе стороны
  '&.MuiCollapse-entered': {
    overflow: 'visible',
  },
});

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
  const queryClient = useQueryClient();
  const { setAuth } = useAuthStore();
  const isMountedRef = useRef(true);

  // Используем useMutation напрямую с редиректом в onSuccess
  // Это предотвращает проблемы с размонтированием компонента
  const loginMutation = useMutation({
    mutationFn: (credentials: LoginInput) => login(credentials),
    onSuccess: (data: LoginResponse) => {
      // Сохраняем токены и пользователя в store
      setAuth(data.accessToken, data.refreshToken, data.user as User);
      // Обновляем кэш React Query
      queryClient.setQueryData(authKeys.currentUser(), data.user as User);
      
      // Редирект происходит в следующем тике через startTransition
      // Это предотвращает проблемы с обновлением DOM во время размонтирования
      if (isMountedRef.current) {
        startTransition(() => {
          navigate('/', { replace: true });
        });
      }
    },
  });

  // Отслеживаем размонтирование компонента
  React.useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

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

  // Получаем информацию об ошибке через централизованную утилиту
  const errorInfo = getAuthErrorInfo(loginMutation.error);

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#212121', // Темный фон как у всего приложения
        padding: 2,
      }}
    >
      <Box
        component="main"
        sx={{
          width: '100%',
          maxWidth: 400, // Максимальная ширина формы
          display: 'flex',
          flexDirection: 'column',
          gap: 4, // Отступ между заголовком и формой (большой блок)
        }}
      >
        {/* Заголовок */}
        <Typography
          component="h1"
          variant="h4"
          sx={{
            color: '#ffffff',
            fontWeight: 300,
            textAlign: 'center',
            letterSpacing: '0.5px',
          }}
        >
          Вход
        </Typography>

        {/* Форма */}
        <Box
          component="form"
          onSubmit={handleSubmit(onSubmit)}
          sx={{
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Поле Email с анимированной ошибкой */}
          <Box sx={{ position: 'relative', mb: 3 }}>
            <StyledTextField
              {...register('email')}
              required
              fullWidth
              id="email"
              name="email"
              autoComplete="email"
              autoFocus
              error={!!errors.email}
              disabled={loginMutation.isPending}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <EmailIcon sx={{ color: 'rgba(255, 255, 255, 0.7)' }} />
                  </InputAdornment>
                ),
              }}
            />
            {/* Ошибка валидации - абсолютное позиционирование, не сдвигает элементы */}
            <Fade in={!!errors.email} timeout={300}>
              <AbsoluteErrorContainer>
                <ErrorText variant="caption">
                  {errors.email?.message}
                </ErrorText>
              </AbsoluteErrorContainer>
            </Fade>
          </Box>

          {/* Поле Пароль с анимированной ошибкой */}
          <Box sx={{ position: 'relative' }}>
            <StyledTextField
              {...register('password')}
              required
              fullWidth
              name="password"
              type="password"
              id="password"
              autoComplete="current-password"
              error={!!errors.password}
              disabled={loginMutation.isPending}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <LockIcon sx={{ color: 'rgba(255, 255, 255, 0.7)' }} />
                  </InputAdornment>
                ),
              }}
            />
            {/* Ошибка валидации - абсолютное позиционирование, не сдвигает элементы */}
            <Fade in={!!errors.password} timeout={300}>
              <AbsoluteErrorContainer>
                <ErrorText variant="caption">
                  {errors.password?.message}
                </ErrorText>
              </AbsoluteErrorContainer>
            </Fade>
          </Box>

          {/* Сообщение об ошибке авторизации - между полем пароля и кнопкой */}
          <Box sx={{ mt: 3 }}>
            <AnimatedCollapse in={!!errorInfo} timeout={300}>
              {errorInfo && (
                <Alert
                  severity={errorInfo.severity}
                  sx={{
                    borderRadius: '12px',
                    backgroundColor: errorInfo.severity === 'error' 
                      ? 'rgba(244, 67, 54, 0.1)' 
                      : 'rgba(33, 150, 243, 0.1)',
                    color: '#ffffff',
                    border: 'none', // Убираем обводку
                    mb: 3,
                  }}
                >
                  {errorInfo.message}
                </Alert>
              )}
            </AnimatedCollapse>
            <StyledButton
              type="submit"
              fullWidth
              disabled={loginMutation.isPending}
              sx={{ 
                position: 'relative',
              }}
            >
              {loginMutation.isPending && (
                <CircularProgress
                  size={24}
                  sx={{
                    position: 'absolute',
                    color: '#212121', // Темный цвет для индикатора
                  }}
                />
              )}
              <span style={{ opacity: loginMutation.isPending ? 0 : 1 }}>
                Войти
              </span>
            </StyledButton>
            
            {/* Подсказка с тестовыми учетными данными */}
            <Typography
              variant="caption"
              sx={{
                mt: 2,
                textAlign: 'center',
                color: 'rgba(255, 255, 255, 0.5)',
                fontSize: '0.75rem',
              }}
            >
              Тестовые данные: admin@example.com / ChangeMe123!@#
            </Typography>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

