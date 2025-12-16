/**
 * Диалог редактирования категории шаблонов.
 */

import React, { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Dialog,
  DialogContent,
  DialogActions,
  Box,
  Alert,
  CircularProgress,
  Typography,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import { StyledTextField, StyledButton, CancelButton } from '../common/FormStyles';
import { dialogPaperProps, dialogTitleStyles, dialogContentStyles, dialogActionsStyles } from '../common/DialogStyles';
import { LOADING_ICON_SIZE } from '../common/Constants';
import { updateTemplateCategorySchema, type UpdateTemplateCategoryFormData } from '@/schemas/template.schema';
import { useUpdateTemplateCategory } from '@/hooks/useTemplates';
import type { TemplateCategory } from '@/types/template';

interface EditCategoryDialogProps {
  open: boolean;
  category: TemplateCategory | null;
  onClose: () => void;
}

const ColorInput = styled('input')({
  width: 40,
  height: 40,
  padding: 0,
  border: 'none',
  borderRadius: 8,
  cursor: 'pointer',
  backgroundColor: 'transparent',
  '&::-webkit-color-swatch-wrapper': {
    padding: 0,
  },
  '&::-webkit-color-swatch': {
    borderRadius: 8,
    border: '1px solid rgba(255, 255, 255, 0.2)',
  },
});

export function EditCategoryDialog({ open, category, onClose }: EditCategoryDialogProps) {
  const updateMutation = useUpdateTemplateCategory();

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<UpdateTemplateCategoryFormData>({
    resolver: zodResolver(updateTemplateCategorySchema),
    defaultValues: {
      name: '',
      description: '',
      color: '#6366f1',
    },
  });

  useEffect(() => {
    if (category && open) {
      reset({
        name: category.name,
        description: category.description ?? '',
        color: category.color ?? '#6366f1',
        orderIndex: category.orderIndex,
      });
    }
  }, [category, open, reset]);

  const handleClose = () => {
    reset();
    updateMutation.reset();
    onClose();
  };

  const onSubmit = async (data: UpdateTemplateCategoryFormData) => {
    if (!category) return;
    try {
      await updateMutation.mutateAsync({
        categoryId: category.id,
        data,
      });
      handleClose();
    } catch (error) {
      // Ошибка обрабатывается в mutation
    }
  };

  if (!category) return null;

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      PaperProps={dialogPaperProps}
    >
      <Box sx={dialogTitleStyles}>
        <Typography sx={{ color: '#fff', fontSize: '1.25rem', fontWeight: 500 }}>
          Редактирование категории
        </Typography>
      </Box>

      <form onSubmit={handleSubmit(onSubmit)}>
        <DialogContent sx={dialogContentStyles}>
          {updateMutation.isError && (
            <Alert 
              severity="error" 
              sx={{ 
                mb: 2,
                borderRadius: '12px',
                backgroundColor: 'rgba(244, 67, 54, 0.1)',
                color: '#ffffff',
                border: 'none',
              }}
            >
              {(updateMutation.error as Error)?.message || 'Ошибка при обновлении категории'}
            </Alert>
          )}

          <StyledTextField
            label="Название категории"
            {...register('name')}
            error={!!errors.name}
            helperText={errors.name?.message}
            fullWidth
            autoFocus
          />

          <StyledTextField
            label="Описание"
            {...register('description')}
            error={!!errors.description}
            helperText={errors.description?.message}
            fullWidth
            multiline
            rows={2}
          />

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 1 }}>
            <Typography sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
              Цвет:
            </Typography>
            <Controller
              name="color"
              control={control}
              render={({ field }) => (
                <ColorInput
                  type="color"
                  value={field.value || '#6366f1'}
                  onChange={(e) => field.onChange(e.target.value)}
                />
              )}
            />
          </Box>
        </DialogContent>

        <DialogActions sx={dialogActionsStyles}>
          <CancelButton onClick={handleClose}>
            Отмена
          </CancelButton>
          <StyledButton
            type="submit"
            disabled={updateMutation.isPending}
          >
            {updateMutation.isPending ? (
              <CircularProgress size={LOADING_ICON_SIZE} color="inherit" />
            ) : (
              'Сохранить'
            )}
          </StyledButton>
        </DialogActions>
      </form>
    </Dialog>
  );
}

export default EditCategoryDialog;




