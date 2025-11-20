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
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Alert,
  CircularProgress,
} from '@mui/material';
import { createUserSchema, type CreateUserFormData } from '@/schemas/user.schema';
import { useCreateUser } from '@/hooks/useUsers';

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
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <form onSubmit={handleSubmit(onSubmit)}>
        <DialogTitle>Создать пользователя</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
            {errorMessage && (
              <Alert severity={isEmailError ? 'warning' : 'error'}>{errorMessage}</Alert>
            )}

            <TextField
              {...register('email')}
              label="Email"
              type="email"
              required
              fullWidth
              error={!!errors.email || !!isEmailError}
              helperText={errors.email?.message || (isEmailError ? 'Email уже используется' : '')}
              disabled={createMutation.isPending}
              autoFocus
            />

            <TextField
              {...register('password')}
              label="Пароль"
              type="password"
              required
              fullWidth
              error={!!errors.password}
              helperText={errors.password?.message}
              disabled={createMutation.isPending}
              inputProps={{
                autoComplete: 'new-password',
              }}
            />

            <TextField
              {...register('name')}
              label="Имя (опционально)"
              fullWidth
              error={!!errors.name}
              helperText={errors.name?.message}
              disabled={createMutation.isPending}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose} disabled={createMutation.isPending}>
            Отмена
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={createMutation.isPending}
            startIcon={createMutation.isPending ? <CircularProgress size={20} /> : null}
          >
            Создать
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}

