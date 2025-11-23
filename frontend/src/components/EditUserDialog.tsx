/**
 * Диалог редактирования пользователя
 * 
 * Форма редактирования пользователя с валидацией через React Hook Form и Zod.
 * Использует MUI Dialog для отображения.
 */

import React, { useEffect } from 'react';
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
  FormControlLabel,
  Switch,
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
import { updateUserSchema, type UpdateUserFormData } from '@/schemas/user.schema';
import { useUpdateUser } from '@/hooks/useUsers';
import type { User } from '@/types';

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
    
    // Стили для input (outline убирается глобально через автозаполнение)
    '& .MuiInputBase-input': {
      outline: 'none',
      '&:focus': {
        outline: 'none',
      },
      '&:focus-visible': {
        outline: 'none',
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
 * Стилизованный Switch
 * 
 * Плавный слайдер в минималистичном стиле.
 */
const StyledSwitch = styled(Switch)(({ theme }) => ({
  width: 48,
  height: 28,
  padding: 0,
  '& .MuiSwitch-switchBase': {
    padding: 0,
    margin: 2,
    transitionDuration: '300ms',
    '&.Mui-checked': {
      transform: 'translateX(20px)',
      color: '#fff',
      '& + .MuiSwitch-track': {
        backgroundColor: '#f5f5f5',
        opacity: 1,
        border: 0,
      },
      '&.Mui-disabled + .MuiSwitch-track': {
        opacity: 0.3,
      },
    },
    '&.Mui-focusVisible .MuiSwitch-thumb': {
      color: '#f5f5f5',
      border: '6px solid #fff',
    },
    '&.Mui-disabled .MuiSwitch-thumb': {
      color: 'rgba(255, 255, 255, 0.3)',
    },
    '&.Mui-disabled + .MuiSwitch-track': {
      opacity: 0.3,
    },
  },
  '& .MuiSwitch-thumb': {
    boxSizing: 'border-box',
    width: 24,
    height: 24,
    backgroundColor: '#ffffff',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  },
  '& .MuiSwitch-track': {
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    opacity: 1,
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
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

interface EditUserDialogProps {
  open: boolean;
  user: User | null;
  onClose: () => void;
}

/**
 * Диалог редактирования пользователя
 * 
 * @param open - Флаг открытия диалога
 * @param user - Пользователь для редактирования (null при закрытии)
 * @param onClose - Callback для закрытия диалога
 */
export function EditUserDialog({ open, user, onClose }: EditUserDialogProps) {
  const updateMutation = useUpdateUser();

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
  } = useForm<UpdateUserFormData>({
    resolver: zodResolver(updateUserSchema),
    defaultValues: {
      email: '',
      name: '',
      isActive: true,
    },
  });

  // Обновляем форму при изменении пользователя или открытии диалога
  useEffect(() => {
    if (user && open) {
      reset({
        email: user.email,
        name: user.name || '',
        // ВАЖНО: Используем актуальное значение isActive из объекта пользователя
        isActive: user.isActive ?? true,
      });
    } else if (!open) {
      // Сбрасываем форму при закрытии диалога
      reset({
        email: '',
        name: '',
        isActive: true,
      });
    }
  }, [user, open, reset]);

  const onSubmit = (data: UpdateUserFormData) => {
    if (!user) return;

    // ВАЖНО: Frontend НЕ должен пытаться менять данные ROOT пользователя
    // Это дополнительная проверка безопасности на случай, если кто-то
    // попытается вызвать onSubmit напрямую (например, через DevTools)
    if (user.role === 'ROOT') {
      // Не отправляем запрос на обновление ROOT пользователя
      // Backend также блокирует такие запросы через middleware
      return;
    }

    // Удаляем password из данных, если он не заполнен
    const submitData: UpdateUserFormData = { ...data };
    if (!data.password || data.password.trim() === '') {
      delete submitData.password;
    }

    updateMutation.mutate(
      { userId: user.id, userData: submitData },
      {
        onSuccess: () => {
          reset();
          onClose();
        },
      }
    );
  };

  const handleClose = () => {
    if (!updateMutation.isPending) {
      reset();
      onClose();
    }
  };

  const watchPassword = watch('password');

  // Общая ошибка
  // ВАЖНО: Не показываем технические детали ошибок пользователю
  // Проверяем только тип ошибки для показа подходящего сообщения
  const rawError = updateMutation.error as { message?: string } | undefined;
  const rawErrorMessage = rawError?.message || '';
  
  // Ошибка дубликата email (показываем специфичное сообщение только для этой ошибки)
  const isEmailError =
    rawErrorMessage.includes('Email already in use') || 
    rawErrorMessage.includes('already in use') ||
    rawErrorMessage.includes('409'); // HTTP 409 Conflict

  // Ошибка попытки редактирования ROOT (показываем специфичное сообщение)
  const isRootError = 
    rawErrorMessage.includes('ROOT') || 
    rawErrorMessage.includes('root') ||
    rawErrorMessage.includes('403') && rawErrorMessage.includes('ROOT'); // HTTP 403 Forbidden для ROOT

  // Общее сообщение об ошибке (без технических деталей)
  const errorMessage = updateMutation.error
    ? (isRootError
        ? 'ROOT пользователи не могут быть отредактированы'
        : isEmailError
        ? 'Email уже используется'
        : 'Не удалось обновить пользователя')
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
            Редактировать пользователя
          </Typography>
        </Box>
        <DialogContent sx={{ ...dialogContentStyles, pt: 1 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, pt: 1 }}>
            {/* Сообщение об ошибке */}
            <AnimatedCollapse in={!!errorMessage} timeout={300}>
              {errorMessage && (
                <Alert
                  severity={isRootError ? 'warning' : isEmailError ? 'warning' : 'error'}
                  sx={{
                    borderRadius: '12px',
                    backgroundColor: isRootError || isEmailError
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
                placeholder="Имя"
                fullWidth
                error={!!errors.name}
                disabled={updateMutation.isPending || user?.role === 'ROOT'}
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
                fullWidth
                error={!!errors.email || !!isEmailError}
                disabled={updateMutation.isPending || user?.role === 'ROOT'}
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
                placeholder="Изменить пароль (оставьте пустым, чтобы не менять)"
                type="password"
                fullWidth
                error={!!errors.password}
                disabled={updateMutation.isPending || user?.role === 'ROOT'}
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

            {/* Switch Активен */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, pl: 1.75 }}>
              <StyledSwitch
                {...register('isActive')}
                checked={watch('isActive') ?? false}
                disabled={updateMutation.isPending || user?.role === 'ROOT'}
              />
              <Typography sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                Активен
              </Typography>
            </Box>

            {/* Информация о смене пароля */}
            <AnimatedCollapse in={!!watchPassword} timeout={300}>
              {watchPassword && (
                <Alert
                  severity="info"
                  sx={{
                    borderRadius: '12px',
                    backgroundColor: 'rgba(33, 150, 243, 0.1)',
                    color: '#ffffff',
                    border: 'none',
                  }}
                >
                  При смене пароля все токены пользователя будут инвалидированы.
                </Alert>
              )}
            </AnimatedCollapse>

            {/* Предупреждение для ROOT */}
            {user?.role === 'ROOT' && (
              <Alert
                severity="warning"
                sx={{
                  borderRadius: '12px',
                  backgroundColor: 'rgba(255, 152, 0, 0.1)',
                  color: '#ffffff',
                  border: 'none',
                }}
              >
                ROOT пользователи не могут быть отредактированы через API.
              </Alert>
            )}
          </Box>
        </DialogContent>
        <DialogActions sx={dialogActionsStyles}>
          <CancelButton onClick={handleClose} disabled={updateMutation.isPending}>
            Отмена
          </CancelButton>
          <StyledButton
            type="submit"
            disabled={updateMutation.isPending || user?.role === 'ROOT'}
            sx={{ position: 'relative' }}
          >
            {updateMutation.isPending && (
              <CircularProgress
                size={20}
                sx={{
                  position: 'absolute',
                  color: '#212121',
                }}
              />
            )}
            <span style={{ opacity: updateMutation.isPending ? 0 : 1 }}>
              Сохранить
            </span>
          </StyledButton>
        </DialogActions>
      </form>
    </Dialog>
  );
}

