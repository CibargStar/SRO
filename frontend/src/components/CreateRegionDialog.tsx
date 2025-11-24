/**
 * Диалог создания региона
 * 
 * Форма для создания нового региона.
 * Использует React Hook Form и Zod для валидации.
 */

import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  CircularProgress,
} from '@mui/material';
import { StyledButton, StyledTextField, CancelButton } from './common/FormStyles';
import { dialogPaperProps, dialogTitleStyles, dialogActionsStyles } from './common/DialogStyles';
import { LOADING_ICON_SIZE } from './common/Constants';
import { useCreateRegion } from '@/hooks/useRegions';
import { createRegionSchema, type CreateRegionFormData } from '@/schemas/region.schema';

/**
 * Props для компонента CreateRegionDialog
 */
interface CreateRegionDialogProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Компонент диалога создания региона
 * 
 * Предоставляет форму для создания нового региона.
 * Валидация через Zod, отправка через React Query mutation.
 */
export function CreateRegionDialog({ open, onClose }: CreateRegionDialogProps) {
  const createMutation = useCreateRegion();

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<CreateRegionFormData>({
    resolver: zodResolver(createRegionSchema),
    defaultValues: {
      name: '',
    },
  });

  const onSubmit = (data: CreateRegionFormData) => {
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

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      disableEnforceFocus
      PaperProps={dialogPaperProps}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle sx={dialogTitleStyles}>Создание региона</DialogTitle>
      <form onSubmit={handleSubmit(onSubmit)}>
        <DialogContent sx={{ px: 3, pt: 3 }}>
          <StyledTextField
            fullWidth
            label="Название региона"
            {...register('name')}
            error={!!errors.name}
            helperText={errors.name?.message}
            disabled={createMutation.isPending}
            autoFocus
            sx={{ mb: 2 }}
          />

          {createMutation.error && (
            <Alert
              severity="error"
              sx={{
                borderRadius: '12px',
                backgroundColor: 'rgba(244, 67, 54, 0.1)',
                color: '#ffffff',
                border: 'none',
                mt: 2,
              }}
            >
              {createMutation.error instanceof Error
                ? createMutation.error.message
                : 'Не удалось создать регион'}
            </Alert>
          )}
        </DialogContent>
        <DialogActions sx={dialogActionsStyles}>
          <CancelButton onClick={handleClose} disabled={createMutation.isPending}>
            Отмена
          </CancelButton>
          <StyledButton type="submit" disabled={createMutation.isPending}>
            {createMutation.isPending ? (
              <CircularProgress size={LOADING_ICON_SIZE} />
            ) : (
              'Создать'
            )}
          </StyledButton>
        </DialogActions>
      </form>
    </Dialog>
  );
}


