/**
 * Диалог создания группы клиентов
 */

import React from 'react';
import { useForm, Controller } from 'react-hook-form';
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
} from '@mui/material';
import { StyledTextField, StyledButton, CancelButton } from './common/FormStyles';
import { dialogPaperProps, dialogTitleStyles, dialogContentStyles, dialogActionsStyles } from './common/DialogStyles';
import { LOADING_ICON_SIZE } from './common/Constants';
import { createClientGroupSchema, type CreateClientGroupFormData } from '@/schemas/client-group.schema';
import { useCreateClientGroup } from '@/hooks/useClientGroups';
import { useAuthStore } from '@/store';

interface CreateClientGroupDialogProps {
  open: boolean;
  onClose: () => void;
  userId?: string; // Опциональный ID пользователя для ROOT (передается из родительского компонента)
  onSuccess?: (groupId: string) => void; // Callback при успешном создании группы
}

export function CreateClientGroupDialog({ open, onClose, userId: propUserId, onSuccess }: CreateClientGroupDialogProps) {
  const user = useAuthStore((state) => state.user);
  const isRoot = user?.role === 'ROOT';
  const createMutation = useCreateClientGroup();

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<CreateClientGroupFormData>({
    resolver: zodResolver(createClientGroupSchema),
    defaultValues: {
      name: '',
      description: null,
      color: null,
      orderIndex: null,
      userId: undefined,
    },
  });

  const onSubmit = (data: CreateClientGroupFormData) => {
    createMutation.mutate(
      {
        ...data,
        userId: isRoot && propUserId ? propUserId : undefined, // Для ROOT - создание от имени переданного пользователя
      },
      {
        onSuccess: (createdGroup) => {
          reset();
          onClose();
          // Вызываем callback с ID созданной группы
          if (onSuccess) {
            onSuccess(createdGroup.id);
          }
        },
      }
    );
  };

  const handleClose = () => {
    if (!createMutation.isPending) {
      reset();
      onClose();
    }
  };

  const errorMessage = createMutation.error ? 'Не удалось создать группу' : null;

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
        <Box sx={dialogTitleStyles}>
          <Typography variant="h6" sx={{ color: '#f5f5f5', fontWeight: 500 }}>
            Создать группу клиентов
          </Typography>
        </Box>

        <DialogContent sx={dialogContentStyles}>
          {errorMessage && (
            <Alert severity="error" sx={{ mb: 2, borderRadius: '12px' }}>
              {errorMessage}
            </Alert>
          )}

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <StyledTextField
              {...register('name')}
              label="Название группы"
              error={!!errors.name}
              helperText={errors.name?.message}
              fullWidth
              required
            />

            <StyledTextField
              {...register('description')}
              label="Описание"
              error={!!errors.description}
              helperText={errors.description?.message}
              fullWidth
              multiline
              rows={3}
            />

            <StyledTextField
              {...register('color')}
              label="Цвет (HEX или название)"
              error={!!errors.color}
              helperText={errors.color?.message}
              fullWidth
              placeholder="#FF5733"
            />

            <StyledTextField
              {...register('orderIndex', { valueAsNumber: true })}
              label="Порядок сортировки"
              type="number"
              error={!!errors.orderIndex}
              helperText={errors.orderIndex?.message}
              fullWidth
            />
          </Box>
        </DialogContent>

        <DialogActions sx={dialogActionsStyles}>
          <CancelButton onClick={handleClose} disabled={createMutation.isPending}>
            Отмена
          </CancelButton>
          <StyledButton type="submit" disabled={createMutation.isPending}>
            {createMutation.isPending ? <CircularProgress size={LOADING_ICON_SIZE} /> : 'Создать'}
          </StyledButton>
        </DialogActions>
      </form>
    </Dialog>
  );
}

