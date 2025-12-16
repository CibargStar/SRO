/**
 * Диалог создания профиля
 * 
 * Форма создания нового профиля Chrome с валидацией через React Hook Form и Zod.
 */

import React from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Dialog,
  DialogContent,
  DialogActions,
  TextField,
  Box,
  Alert,
  CircularProgress,
  Typography,
  FormControlLabel,
  Switch,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import { StyledTextField, StyledButton, CancelButton } from './common/FormStyles';
import { dialogPaperProps, dialogTitleStyles, dialogContentStyles, dialogActionsStyles } from './common/DialogStyles';
import { LOADING_ICON_SIZE } from './common/Constants';
import { createProfileSchema, type CreateProfileFormData } from '@/schemas/profile.schema';
import { useCreateProfile } from '@/hooks/useProfiles';

/**
 * Стилизованный Switch
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

interface CreateProfileDialogProps {
  open: boolean;
  onClose: () => void;
}

export function CreateProfileDialog({ open, onClose }: CreateProfileDialogProps) {
  const createMutation = useCreateProfile();

  const {
    register,
    control,
    watch,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<CreateProfileFormData>({
    resolver: zodResolver(createProfileSchema),
    defaultValues: {
      name: '',
      description: null,
      headless: true, // По умолчанию headless режим
    },
  });

  const headlessValue = watch('headless');

  const onSubmit = (data: CreateProfileFormData) => {
    createMutation.mutate(
      {
        name: data.name,
        description: data.description ?? null,
        headless: data.headless !== undefined ? data.headless : true,
      },
      {
        onSuccess: () => {
          reset();
          onClose();
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

  return (
    <Dialog 
      open={open} 
      onClose={handleClose} 
      PaperProps={{
        ...dialogPaperProps,
        sx: {
          ...dialogPaperProps.sx,
          borderRadius: '16px',
        },
      }} 
      maxWidth="sm" 
      fullWidth
    >
      <Box sx={{ ...dialogTitleStyles, borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
        <Typography variant="h6" sx={{ color: '#f5f5f5', fontWeight: 500 }}>
          Создание профиля Chrome
        </Typography>
      </Box>

      <form onSubmit={handleSubmit(onSubmit)}>
        <DialogContent sx={{ ...dialogContentStyles, pt: 3 }}>
          {createMutation.isError && (
            <Alert 
              severity="error" 
              sx={{ 
                mb: 2,
                borderRadius: '12px',
                backgroundColor: 'rgba(244, 67, 54, 0.1)',
                color: '#f44336',
                border: '1px solid rgba(244, 67, 54, 0.2)',
              }}
            >
              {createMutation.error instanceof Error
                ? createMutation.error.message
                : 'Произошла ошибка при создании профиля'}
            </Alert>
          )}

          <StyledTextField
            {...register('name')}
            label="Название профиля"
            placeholder="Например: Профиль для WhatsApp"
            fullWidth
            error={!!errors.name}
            helperText={errors.name?.message}
            autoFocus
            disabled={createMutation.isPending}
            sx={{ mb: 2 }}
          />

          <StyledTextField
            {...register('description')}
            label="Описание"
            placeholder="Описание профиля (необязательно)"
            fullWidth
            multiline
            rows={3}
            error={!!errors.description}
            helperText={errors.description?.message}
            disabled={createMutation.isPending}
            sx={{ mb: 2 }}
          />

          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 2.5, borderRadius: '12px', backgroundColor: 'rgba(255, 255, 255, 0.06)' }}>
            <Box>
              <Typography variant="body1" sx={{ color: '#f5f5f5', fontWeight: 500, mb: 0.5 }}>
                Режим работы
              </Typography>
              <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                {headlessValue === true ? 'Без UI (фоновый режим)' : 'С UI (видимое окно)'}
              </Typography>
            </Box>
            <Controller
              name="headless"
              control={control}
              render={({ field }) => (
                <FormControlLabel
                  control={
                    <StyledSwitch
                      checked={field.value === true}
                      onChange={(e) => field.onChange(e.target.checked)}
                      disabled={createMutation.isPending}
                    />
                  }
                  label=""
                  sx={{ m: 0 }}
                />
              )}
            />
          </Box>
        </DialogContent>

        <DialogActions sx={dialogActionsStyles}>
          <CancelButton onClick={handleClose} disabled={createMutation.isPending}>
            Отмена
          </CancelButton>
          <StyledButton
            type="submit"
            variant="contained"
            disabled={createMutation.isPending}
            startIcon={createMutation.isPending ? <CircularProgress size={LOADING_ICON_SIZE} /> : null}
          >
            Создать
          </StyledButton>
        </DialogActions>
      </form>
    </Dialog>
  );
}

