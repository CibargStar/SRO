/**
 * Диалог создания пользователя
 * 
 * Форма создания нового пользователя с валидацией через React Hook Form и Zod.
 * Использует MUI Dialog для отображения.
 */

import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Dialog,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Alert,
  CircularProgress,
  Typography,
  Collapse,
  Fade,
  InputAdornment,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import { StyledButton, CancelButton } from './common/FormStyles';
import { dialogPaperProps, dialogTitleStyles, dialogContentStyles, dialogActionsStyles } from './common/DialogStyles';
import { LOADING_ICON_SIZE } from './common/Constants';
import EmailIcon from '@mui/icons-material/Email';
import LockIcon from '@mui/icons-material/Lock';
import PersonIcon from '@mui/icons-material/Person';
import { createUserSchema, type CreateUserFormData } from '@/schemas/user.schema';
import { useCreateUser } from '@/hooks/useUsers';

/**
 * Стилизованное поле ввода
 * 
 * Минималистичный дизайн с скругленными углами в духе страницы логина.
 */
const StyledTextField = styled(TextField)(({ theme }) => ({
  '& .MuiOutlinedInput-root': {
    borderRadius: '12px',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    color: '#ffffff',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    outline: 'none',
    
    '& fieldset': {
      border: 'none',
      outline: 'none',
    },
    
    '&:hover fieldset': {
      border: 'none',
      outline: 'none',
    },
    
    '&.Mui-focused fieldset': {
      border: 'none',
      outline: 'none',
    },
    
    '&.Mui-error fieldset': {
      border: 'none',
      outline: 'none',
    },
    
    '&:focus': {
      outline: 'none',
    },
    
    '&:focus-visible': {
      outline: 'none',
    },
    
    // Переопределение стилей автозаполнения браузера (Chrome)
    '& .MuiInputBase-input': {
      outline: 'none',
      '&:focus': {
        outline: 'none',
      },
      '&:focus-visible': {
        outline: 'none',
      },
      '&:-webkit-autofill': {
        WebkitBoxShadow: '0 0 0 1000px #2c2c2c inset !important',
        WebkitTextFillColor: '#ffffff !important',
        backgroundColor: '#2c2c2c !important',
        caretColor: '#ffffff',
        borderRadius: '12px',
        outline: 'none',
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
    color: 'rgba(255, 255, 255, 0.7)',
  },
  
  '& .MuiInputLabel-root.Mui-focused': {
    color: 'rgba(255, 255, 255, 0.9)',
  },
  
  '& .MuiFormHelperText-root': {
    color: 'rgba(255, 255, 255, 0.6)',
  },
  
  '& .MuiFormHelperText-root.Mui-error': {
    color: '#f44336',
  },
}));

/**
 * Контейнер для ошибок валидации
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
 * Текст ошибки
 */
const ErrorText = styled(Typography)({
  color: '#f44336',
  display: 'block',
  marginTop: 2,
  marginLeft: 14,
  fontSize: '0.75rem',
  lineHeight: 1.66,
  transition: 'opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1), transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
});

/**
 * Стилизованный Collapse для плавных анимаций
 */
const AnimatedCollapse = styled(Collapse)({
  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
});

interface CreateUserDialogProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Диалог создания пользователя
 * 
 * @param open - Флаг открытия диалога
 * @param onClose - Callback для закрытия диалога
 */
export function CreateUserDialog({ open, onClose }: CreateUserDialogProps) {
  const createMutation = useCreateUser();

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<CreateUserFormData>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      email: '',
      password: '',
      name: '',
    },
  });

  const onSubmit = (data: CreateUserFormData) => {
    createMutation.mutate(data, {
      onSuccess: () => {
        reset();
        onClose();
      },
    });
  };

  const handleClose = () => {
    if (!createMutation.isPending) {
      reset();
      onClose();
    }
  };

  // Общая ошибка
  // ВАЖНО: Не показываем технические детали ошибок пользователю
  // Проверяем только тип ошибки для показа подходящего сообщения
  const rawError = createMutation.error as { message?: string } | undefined;
  const rawErrorMessage = rawError?.message || '';
  
  // Ошибка дубликата email (показываем специфичное сообщение только для этой ошибки)
  const isEmailError =
    rawErrorMessage.includes('Email already in use') || 
    rawErrorMessage.includes('already in use') ||
    rawErrorMessage.includes('409'); // HTTP 409 Conflict

  // Общее сообщение об ошибке (без технических деталей)
  const errorMessage = createMutation.error
    ? (isEmailError ? 'Email уже используется' : 'Не удалось создать пользователя')
    : null;

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      disableEnforceFocus
      PaperProps={dialogPaperProps}
    >
      <form onSubmit={handleSubmit(onSubmit)}>
        {/* Полноценная шапка модалки */}
        <Box sx={dialogTitleStyles}>
          <Typography
            variant="h6"
            sx={{
              color: '#f5f5f5',
              fontWeight: 500,
              fontSize: '1.25rem',
            }}
          >
            Создать пользователя
          </Typography>
        </Box>
        <DialogContent sx={{ ...dialogContentStyles, pt: 1 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, pt: 1 }}>
            {/* Сообщение об ошибке */}
            <AnimatedCollapse in={!!errorMessage} timeout={300}>
              {errorMessage && (
                <Alert
                  severity={isEmailError ? 'warning' : 'error'}
                  sx={{
                    borderRadius: '12px',
                    backgroundColor: isEmailError
                      ? 'rgba(255, 152, 0, 0.1)'
                      : 'rgba(244, 67, 54, 0.1)',
                    color: '#ffffff',
                    border: 'none',
                  }}
                >
                  {errorMessage}
                </Alert>
              )}
            </AnimatedCollapse>

            {/* Поле Имя */}
            <Box sx={{ position: 'relative' }}>
              <StyledTextField
                {...register('name')}
                placeholder="Имя (опционально)"
                fullWidth
                error={!!errors.name}
                disabled={createMutation.isPending}
                autoFocus
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <PersonIcon sx={{ color: 'rgba(255, 255, 255, 0.7)' }} />
                    </InputAdornment>
                  ),
                }}
              />
              <Fade in={!!errors.name} timeout={300}>
                <AbsoluteErrorContainer>
                  <ErrorText variant="caption">
                    {errors.name?.message}
                  </ErrorText>
                </AbsoluteErrorContainer>
              </Fade>
            </Box>

            {/* Поле Email */}
            <Box sx={{ position: 'relative' }}>
              <StyledTextField
                {...register('email')}
                placeholder="Email"
                type="email"
                required
                fullWidth
                error={!!errors.email || !!isEmailError}
                disabled={createMutation.isPending}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <EmailIcon sx={{ color: 'rgba(255, 255, 255, 0.7)' }} />
                    </InputAdornment>
                  ),
                }}
              />
              <Fade in={!!errors.email && !isEmailError} timeout={300}>
                <AbsoluteErrorContainer>
                  <ErrorText variant="caption">
                    {errors.email?.message}
                  </ErrorText>
                </AbsoluteErrorContainer>
              </Fade>
              {isEmailError && (
                <Fade in={true} timeout={300}>
                  <AbsoluteErrorContainer>
                    <ErrorText variant="caption">
                      Email уже используется
                    </ErrorText>
                  </AbsoluteErrorContainer>
                </Fade>
              )}
            </Box>

            {/* Поле Пароль */}
            <Box sx={{ position: 'relative' }}>
              <StyledTextField
                {...register('password')}
                placeholder="Пароль"
                type="password"
                required
                fullWidth
                error={!!errors.password}
                disabled={createMutation.isPending}
                inputProps={{
                  autoComplete: 'new-password',
                }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <LockIcon sx={{ color: 'rgba(255, 255, 255, 0.7)' }} />
                    </InputAdornment>
                  ),
                }}
              />
              <Fade in={!!errors.password} timeout={300}>
                <AbsoluteErrorContainer>
                  <ErrorText variant="caption">
                    {errors.password?.message}
                  </ErrorText>
                </AbsoluteErrorContainer>
              </Fade>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions sx={{ ...dialogActionsStyles, gap: 2 }}>
          <CancelButton onClick={handleClose} disabled={createMutation.isPending}>
            Отмена
          </CancelButton>
          <StyledButton
            type="submit"
            disabled={createMutation.isPending}
            sx={{ position: 'relative' }}
          >
            {createMutation.isPending && (
              <CircularProgress
                size={LOADING_ICON_SIZE}
                sx={{
                  position: 'absolute',
                  color: '#212121',
                }}
              />
            )}
            <span style={{ opacity: createMutation.isPending ? 0 : 1 }}>
              Создать
            </span>
          </StyledButton>
        </DialogActions>
      </form>
    </Dialog>
  );
}

