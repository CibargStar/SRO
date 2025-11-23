/**
 * Диалог редактирования группы клиентов
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
  Typography,
} from '@mui/material';
import { StyledTextField, StyledButton, CancelButton } from './common/FormStyles';
import { dialogPaperProps, dialogTitleStyles, dialogContentStyles, dialogActionsStyles } from './common/DialogStyles';
import { LOADING_ICON_SIZE } from './common/Constants';
import { updateClientGroupSchema, type UpdateClientGroupFormData } from '@/schemas/client-group.schema';
import { useUpdateClientGroup } from '@/hooks/useClientGroups';
import type { ClientGroup } from '@/types';

interface EditClientGroupDialogProps {
  open: boolean;
  group: ClientGroup | null;
  onClose: () => void;
  ownerId?: string; // Опциональный ID владельца группы для ROOT (передается из родительского компонента для консистентности)
}

export function EditClientGroupDialog({ open, group, onClose, ownerId }: EditClientGroupDialogProps) {
  const updateMutation = useUpdateClientGroup();

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<UpdateClientGroupFormData>({
    resolver: zodResolver(updateClientGroupSchema),
    defaultValues: {
      name: '',
      description: null,
      color: null,
      orderIndex: null,
    },
  });

  useEffect(() => {
    if (group && open) {
      reset({
        name: group.name,
        description: group.description,
        color: group.color,
        orderIndex: group.orderIndex,
      });
    }
  }, [group, open, reset]);

  const onSubmit = (data: UpdateClientGroupFormData) => {
    if (!group) return;
    updateMutation.mutate(
      { groupId: group.id, groupData: data },
      {
        onSuccess: () => {
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

  const errorMessage = updateMutation.error ? 'Не удалось обновить группу' : null;

  if (!group) return null;

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
            Редактировать группу
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
          <CancelButton onClick={handleClose} disabled={updateMutation.isPending}>
            Отмена
          </CancelButton>
          <StyledButton type="submit" disabled={updateMutation.isPending}>
            {updateMutation.isPending ? <CircularProgress size={LOADING_ICON_SIZE} /> : 'Сохранить'}
          </StyledButton>
        </DialogActions>
      </form>
    </Dialog>
  );
}

