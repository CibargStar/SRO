/**
 * Диалог редактирования профиля
 * 
 * Форма редактирования профиля Chrome с валидацией через React Hook Form и Zod.
 */

import React, { useEffect } from 'react';
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
import { updateProfileSchema, type UpdateProfileFormData } from '@/schemas/profile.schema';
import { useUpdateProfile } from '@/hooks/useProfiles';
import type { Profile } from '@/types';

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

interface EditProfileDialogProps {
  open: boolean;
  onClose: () => void;
  profile: Profile | null;
  onProfileUpdated?: (updatedProfile: Profile) => void;
}

export function EditProfileDialog({ open, onClose, profile, onProfileUpdated }: EditProfileDialogProps) {
  const updateMutation = useUpdateProfile();

  const {
    register,
    control,
    watch,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    getValues,
  } = useForm<UpdateProfileFormData>({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: {
      name: '',
      description: null,
      headless: true,
    },
  });

  const headlessValue = watch('headless');

  // Обновляем форму при изменении профиля
  useEffect(() => {
    if (profile) {
      reset({
        name: profile.name,
        description: profile.description ?? null,
        headless: profile.headless !== undefined ? profile.headless : true,
      });
    }
  }, [profile, reset]);

  const onSubmit = (data: UpdateProfileFormData) => {
    if (!profile) return;

    // Получаем все текущие значения формы через getValues
    // Это гарантирует, что мы получим актуальное значение headless
    const formValues = getValues();
    // Используем значение из формы, если оно есть, иначе из watch
    const currentHeadless = formValues.headless !== undefined 
      ? formValues.headless 
      : (headlessValue !== undefined ? headlessValue : profile.headless !== undefined ? profile.headless : true);
    
    // Собираем только измененные поля
    const profileData: UpdateProfileFormData = {};
    
    // Добавляем поля только если они были изменены или явно переданы
    if (data.name !== undefined && data.name !== profile.name) {
      profileData.name = data.name;
    }
    
    if (data.description !== undefined && data.description !== profile.description) {
      profileData.description = data.description;
    }
    
    // Для headless всегда проверяем изменение, так как это boolean
    // Сравниваем строго, учитывая что false !== true
    const profileHeadless = profile.headless !== undefined ? profile.headless : true;
    
    // ВАЖНО: Всегда проверяем изменение headless, даже если другие поля не менялись
    // Используем строгое сравнение для boolean значений
    if (currentHeadless !== profileHeadless) {
      profileData.headless = currentHeadless;
    }

    // Если ни одно поле не было изменено, не отправляем запрос
    if (Object.keys(profileData).length === 0) {
      onClose();
      return;
    }

    console.log('[EditProfileDialog] Updating profile:', {
      profileId: profile.id,
      profileData,
      currentHeadless,
      profileHeadless,
      formValues,
      headlessValue,
      dataFromSubmit: data,
    });

    updateMutation.mutate(
      {
        profileId: profile.id,
        profileData,
      },
      {
        onSuccess: (updatedProfile) => {
          console.log('[EditProfileDialog] Profile updated successfully:', updatedProfile);
          // Вызываем callback для обновления selectedProfile в родительском компоненте
          if (onProfileUpdated) {
            onProfileUpdated(updatedProfile);
          }
          onClose();
        },
        onError: (error) => {
          console.error('[EditProfileDialog] Error updating profile:', error);
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

  if (!profile) {
    return null;
  }

  return (
    <Dialog open={open} onClose={handleClose} PaperProps={dialogPaperProps} maxWidth="sm" fullWidth>
      <Box sx={dialogTitleStyles}>
        <Typography variant="h6">Редактирование профиля</Typography>
      </Box>

      <form onSubmit={handleSubmit(onSubmit)}>
        <DialogContent sx={dialogContentStyles}>
          {updateMutation.isError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {updateMutation.error instanceof Error
                ? updateMutation.error.message
                : 'Произошла ошибка при обновлении профиля'}
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
            disabled={updateMutation.isPending}
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
            disabled={updateMutation.isPending}
            sx={{ mb: 2 }}
          />

          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', p: 2, borderRadius: '12px', backgroundColor: 'rgba(255, 255, 255, 0.05)' }}>
            <Box>
              <Typography variant="body1" sx={{ color: '#ffffff', fontWeight: 500, mb: 0.5 }}>
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
                      onChange={(e) => {
                        const newValue = e.target.checked;
                        console.log('[EditProfileDialog] Headless switch changed:', { newValue, currentValue: field.value });
                        // Обновляем значение в форме
                        field.onChange(newValue);
                        // Также обновляем через setValue для гарантии, что значение точно попадет в форму
                        setValue('headless', newValue, { shouldDirty: true, shouldValidate: false, shouldTouch: true });
                      }}
                      disabled={updateMutation.isPending}
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
          <CancelButton onClick={handleClose} disabled={updateMutation.isPending}>
            Отмена
          </CancelButton>
          <StyledButton
            type="submit"
            variant="contained"
            disabled={updateMutation.isPending}
            startIcon={updateMutation.isPending ? <CircularProgress size={LOADING_ICON_SIZE} /> : null}
          >
            Сохранить
          </StyledButton>
        </DialogActions>
      </form>
    </Dialog>
  );
}

