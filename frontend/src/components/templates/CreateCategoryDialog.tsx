/**
 * Диалог создания категории шаблонов
 */

import React from 'react';
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
import { createTemplateCategorySchema, type CreateTemplateCategoryFormData } from '@/schemas/template.schema';
import { useCreateTemplateCategory } from '@/hooks/useTemplates';

interface CreateCategoryDialogProps {
  open: boolean;
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

export function CreateCategoryDialog({ open, onClose }: CreateCategoryDialogProps) {
  const createMutation = useCreateTemplateCategory();

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<CreateTemplateCategoryFormData>({
    resolver: zodResolver(createTemplateCategorySchema),
    defaultValues: {
      name: '',
      description: null,
      color: '#6366f1',
    },
  });

  const handleClose = () => {
    reset();
    createMutation.reset();
    onClose();
  };

  const onSubmit = async (data: CreateTemplateCategoryFormData) => {
    try {
      await createMutation.mutateAsync(data);
      handleClose();
    } catch (error) {
      // Ошибка обрабатывается в mutation
    }
  };

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
          Создание категории
        </Typography>
      </Box>

      <form onSubmit={handleSubmit(onSubmit)}>
        <DialogContent sx={dialogContentStyles}>
          {createMutation.isError && (
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
              {(createMutation.error as Error)?.message || 'Ошибка при создании категории'}
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
            disabled={createMutation.isPending}
          >
            {createMutation.isPending ? (
              <CircularProgress size={LOADING_ICON_SIZE} color="inherit" />
            ) : (
              'Создать'
            )}
          </StyledButton>
        </DialogActions>
      </form>
    </Dialog>
  );
}

export default CreateCategoryDialog;



