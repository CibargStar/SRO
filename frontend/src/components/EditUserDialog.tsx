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
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Alert,
  CircularProgress,
  FormControlLabel,
  Checkbox,
  Divider,
} from '@mui/material';
import { updateUserSchema, type UpdateUserFormData } from '@/schemas/user.schema';
import { useUpdateUser } from '@/hooks/useUsers';
import type { User } from '@/types';

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
    setValue,
  } = useForm<UpdateUserFormData>({
    resolver: zodResolver(updateUserSchema),
    defaultValues: {
      email: '',
      name: '',
      isActive: true,
    },
  });

  // Обновляем форму при изменении пользователя
  useEffect(() => {
    if (user && open) {
      reset({
        email: user.email,
        name: user.name || '',
        isActive: user.isActive,
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
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <form onSubmit={handleSubmit(onSubmit)}>
        <DialogTitle>Редактировать пользователя</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
            {errorMessage && (
              <Alert severity={isRootError ? 'warning' : isEmailError ? 'warning' : 'error'}>
                {errorMessage}
              </Alert>
            )}

            <TextField
              {...register('email')}
              label="Email"
              type="email"
              fullWidth
              error={!!errors.email || !!isEmailError}
              helperText={errors.email?.message || (isEmailError ? 'Email уже используется' : '')}
              disabled={updateMutation.isPending || user?.role === 'ROOT'}
            />

            <Divider sx={{ my: 1 }}>
              <small>Изменить пароль (оставьте пустым, чтобы не менять)</small>
            </Divider>

            <TextField
              {...register('password')}
              label="Новый пароль"
              type="password"
              fullWidth
              error={!!errors.password}
              helperText={errors.password?.message}
              disabled={updateMutation.isPending || user?.role === 'ROOT'}
              inputProps={{
                autoComplete: 'new-password',
              }}
            />

            {watchPassword && (
              <Alert severity="info" sx={{ mt: -1 }}>
                При смене пароля все токены пользователя будут инвалидированы.
              </Alert>
            )}

            <TextField
              {...register('name')}
              label="Имя"
              fullWidth
              error={!!errors.name}
              helperText={errors.name?.message}
              disabled={updateMutation.isPending || user?.role === 'ROOT'}
            />

            <FormControlLabel
              control={
                <Checkbox
                  {...register('isActive')}
                  disabled={updateMutation.isPending || user?.role === 'ROOT'}
                />
              }
              label="Активен"
            />

            {user?.role === 'ROOT' && (
              <Alert severity="warning">
                ROOT пользователи не могут быть отредактированы через API.
              </Alert>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose} disabled={updateMutation.isPending}>
            Отмена
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={updateMutation.isPending || user?.role === 'ROOT'}
            startIcon={updateMutation.isPending ? <CircularProgress size={20} /> : null}
          >
            Сохранить
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}

