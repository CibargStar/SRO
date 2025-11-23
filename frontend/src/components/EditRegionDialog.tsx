/**
 * Диалог редактирования региона
 * 
 * Форма для редактирования существующего региона.
 * Использует React Hook Form и Zod для валидации.
 */

import React, { useEffect } from 'react';
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
import { useUpdateRegion } from '@/hooks/useRegions';
import { updateRegionSchema, type UpdateRegionFormData } from '@/schemas/region.schema';
import type { Region } from '@/types';

/**
 * Props для компонента EditRegionDialog
 */
interface EditRegionDialogProps {
  open: boolean;
  region: Region | null;
  onClose: () => void;
}

/**
 * Компонент диалога редактирования региона
 * 
 * Предоставляет форму для редактирования существующего региона.
 * Валидация через Zod, отправка через React Query mutation.
 */
export function EditRegionDialog({ open, region, onClose }: EditRegionDialogProps) {
  const updateMutation = useUpdateRegion();

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<UpdateRegionFormData>({
    resolver: zodResolver(updateRegionSchema),
    defaultValues: {
      name: region?.name || '',
    },
  });

  // Обновляем форму при изменении региона
  useEffect(() => {
    if (region) {
      reset({
        name: region.name,
      });
    }
  }, [region, reset]);

  const onSubmit = (data: UpdateRegionFormData) => {
    if (!region) return;

    updateMutation.mutate(
      { regionId: region.id, regionData: data },
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

  if (!region) {
    return null;
  }

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      disableEnforceFocus
      PaperProps={dialogPaperProps}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle sx={dialogTitleStyles}>Редактирование региона</DialogTitle>
      <form onSubmit={handleSubmit(onSubmit)}>
        <DialogContent sx={{ px: 3, pt: 3 }}>
          <StyledTextField
            fullWidth
            label="Название региона"
            {...register('name')}
            error={!!errors.name}
            helperText={errors.name?.message}
            disabled={updateMutation.isPending}
            autoFocus
            sx={{ mb: 2 }}
          />

          {updateMutation.error && (
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
              {updateMutation.error instanceof Error
                ? updateMutation.error.message
                : 'Не удалось обновить регион'}
            </Alert>
          )}
        </DialogContent>
        <DialogActions sx={dialogActionsStyles}>
          <CancelButton onClick={handleClose} disabled={updateMutation.isPending}>
            Отмена
          </CancelButton>
          <StyledButton type="submit" disabled={updateMutation.isPending}>
            {updateMutation.isPending ? (
              <CircularProgress size={LOADING_ICON_SIZE} />
            ) : (
              'Сохранить'
            )}
          </StyledButton>
        </DialogActions>
      </form>
    </Dialog>
  );
}

