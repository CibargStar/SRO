/**
 * Диалог редактирования клиента
 * 
 * Форма редактирования клиента с валидацией через React Hook Form и Zod.
 * Использует MUI Dialog для отображения.
 */

import React, { useEffect } from 'react';
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
  MenuItem,
  FormControl,
  InputLabel,
  Select,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import { updateClientSchema, type UpdateClientFormData } from '@/schemas/client.schema';
import { useUpdateClient } from '@/hooks/useClients';
import { useRegions } from '@/hooks/useRegions';
import { useAuthStore } from '@/store';
import { ClientGroupSelector } from './ClientGroupSelector';
import { ClientPhonesList } from './ClientPhonesList';
import type { Client } from '@/types';

const StyledTextField = styled(TextField)({
  '& .MuiOutlinedInput-root': {
    borderRadius: '12px',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    color: '#ffffff',
    '& fieldset': { border: 'none' },
    '&:hover fieldset': { border: 'none' },
    '&.Mui-focused fieldset': { border: 'none' },
  },
  '& .MuiInputLabel-root': { color: 'rgba(255, 255, 255, 0.7)' },
  '& .MuiInputLabel-root.Mui-focused': { color: 'rgba(255, 255, 255, 0.9)' },
});

const StyledSelect = styled(Select)({
  borderRadius: '12px',
  backgroundColor: 'rgba(255, 255, 255, 0.05)',
  color: '#ffffff',
  '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
  '&:hover .MuiOutlinedInput-notchedOutline': { border: 'none' },
  '&.Mui-focused .MuiOutlinedInput-notchedOutline': { border: 'none' },
  '& .MuiSelect-icon': { color: 'rgba(255, 255, 255, 0.7)' },
});

const MenuProps = {
  PaperProps: {
    sx: {
      backgroundColor: '#212121',
      borderRadius: '12px',
      marginTop: '8px',
      '& .MuiMenuItem-root': {
        color: 'rgba(255, 255, 255, 0.9)',
        '&:hover': {
          backgroundColor: 'rgba(255, 255, 255, 0.1)',
        },
        '&.Mui-selected': {
          backgroundColor: 'rgba(255, 255, 255, 0.1)',
          color: 'rgba(255, 255, 255, 0.9)',
          '&:hover': {
            backgroundColor: 'rgba(255, 255, 255, 0.15)',
          },
          '&.Mui-focusVisible': {
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
          },
        },
        '&.Mui-focusVisible': {
          backgroundColor: 'rgba(255, 255, 255, 0.1)',
        },
      },
    },
  },
};

const StyledButton = styled(Button)(({ theme }) => ({
  borderRadius: '12px',
  backgroundColor: '#f5f5f5',
  color: '#212121',
  textTransform: 'none',
  fontWeight: 500,
  padding: theme.spacing(1.5, 3),
  '&:hover': { backgroundColor: '#ffffff', transform: 'translateY(-2px)' },
}));

const CancelButton = styled(Button)(({ theme }) => ({
  borderRadius: '12px',
  backgroundColor: 'transparent',
  color: 'rgba(255, 255, 255, 0.7)',
  textTransform: 'none',
  padding: theme.spacing(1.5, 3),
  '&:hover': { backgroundColor: 'rgba(255, 255, 255, 0.1)', color: '#ffffff' },
}));

interface EditClientDialogProps {
  open: boolean;
  client: Client | null;
  onClose: () => void;
  userId?: string; // Опциональный ID пользователя для ROOT (передается из родительского компонента для фильтрации групп)
}

export function EditClientDialog({ open, client, onClose, userId: propUserId }: EditClientDialogProps) {
  const user = useAuthStore((state) => state.user);
  const isRoot = user?.role === 'ROOT';
  const updateMutation = useUpdateClient();
  const { data: regions = [] } = useRegions();
  
  // Определяем userId для фильтрации групп:
  // - Если ROOT и передан propUserId - используем его (выбранный пользователь из селектора)
  // - Иначе используем userId клиента (владелец клиента)
  const groupFilterUserId = isRoot && propUserId ? propUserId : client?.userId;

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
    reset,
  } = useForm<UpdateClientFormData>({
    resolver: zodResolver(updateClientSchema),
    defaultValues: {
      lastName: '',
      firstName: '',
      middleName: null,
      regionId: null,
      groupId: null,
      status: 'NEW',
    },
  });

  // Заполнение формы при открытии диалога
  useEffect(() => {
    if (client && open) {
      reset({
        lastName: client.lastName,
        firstName: client.firstName,
        middleName: client.middleName,
        regionId: client.regionId,
        groupId: client.groupId,
        status: client.status,
      });
    }
  }, [client, open, reset]);

  const onSubmit = (data: UpdateClientFormData) => {
    if (!client) return;
    updateMutation.mutate(
      { clientId: client.id, clientData: data },
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

  const errorMessage = updateMutation.error ? 'Не удалось обновить клиента' : null;

  if (!client) return null;

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      disableEnforceFocus
      PaperProps={{ 
        sx: { 
          backgroundColor: '#212121', 
          borderRadius: '12px',
          '& .MuiDialogContent-root': {
            '&::-webkit-scrollbar': {
              display: 'none',
            },
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
          },
        } 
      }}
    >
      <form onSubmit={handleSubmit(onSubmit)}>
        <Box sx={{ px: 3, pt: 3, pb: 2, borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
          <Typography variant="h6" sx={{ color: '#f5f5f5', fontWeight: 500 }}>
            Редактировать клиента
          </Typography>
        </Box>

        <DialogContent sx={{ px: 3, pt: 3 }}>
          {errorMessage && (
            <Alert severity="error" sx={{ mb: 2, borderRadius: '12px' }}>
              {errorMessage}
            </Alert>
          )}

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <StyledTextField
              {...register('lastName')}
              label="Фамилия"
              error={!!errors.lastName}
              helperText={errors.lastName?.message}
              fullWidth
            />

            <StyledTextField
              {...register('firstName')}
              label="Имя"
              error={!!errors.firstName}
              helperText={errors.firstName?.message}
              fullWidth
            />

            <StyledTextField
              {...register('middleName')}
              label="Отчество"
              error={!!errors.middleName}
              helperText={errors.middleName?.message}
              fullWidth
            />

            <FormControl fullWidth>
              <InputLabel 
                sx={{ 
                  color: 'rgba(255, 255, 255, 0.7)',
                  '&.Mui-focused': {
                    color: 'rgba(255, 255, 255, 0.7)',
                  },
                  '&.MuiInputLabel-shrink': {
                    color: 'rgba(255, 255, 255, 0.7)',
                  },
                }}
              >
                Регион
              </InputLabel>
              <Controller
                name="regionId"
                control={control}
                render={({ field }) => (
                  <StyledSelect {...field} label="Регион" value={field.value || ''} MenuProps={MenuProps}>
                    <MenuItem value="">Не выбран</MenuItem>
                    {regions.map((region) => (
                      <MenuItem key={region.id} value={region.id}>
                        {region.name}
                      </MenuItem>
                    ))}
                  </StyledSelect>
                )}
              />
            </FormControl>

            <Controller
              name="groupId"
              control={control}
              render={({ field, fieldState }) => (
                <ClientGroupSelector
                  {...field}
                  value={field.value || null}
                  onChange={(val) => field.onChange(val)}
                  required
                  error={!!fieldState.error}
                  helperText={fieldState.error?.message}
                  userId={groupFilterUserId} // Фильтрация групп по выбранному пользователю (для ROOT) или владельцу клиента
                />
              )}
            />

            <FormControl fullWidth>
              <InputLabel 
                sx={{ 
                  color: 'rgba(255, 255, 255, 0.7)',
                  '&.Mui-focused': {
                    color: 'rgba(255, 255, 255, 0.7)',
                  },
                  '&.MuiInputLabel-shrink': {
                    color: 'rgba(255, 255, 255, 0.7)',
                  },
                }}
              >
                Статус
              </InputLabel>
              <Controller
                name="status"
                control={control}
                render={({ field }) => (
                  <StyledSelect {...field} label="Статус" MenuProps={MenuProps}>
                    <MenuItem value="NEW">Новый</MenuItem>
                    <MenuItem value="OLD">Старый</MenuItem>
                  </StyledSelect>
                )}
              />
            </FormControl>

            <Box sx={{ mt: 1 }}>
              <ClientPhonesList clientId={client.id} />
            </Box>
          </Box>
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 3, pt: 2 }}>
          <CancelButton onClick={handleClose} disabled={updateMutation.isPending}>
            Отмена
          </CancelButton>
          <StyledButton type="submit" disabled={updateMutation.isPending}>
            {updateMutation.isPending ? <CircularProgress size={20} /> : 'Сохранить'}
          </StyledButton>
        </DialogActions>
      </form>
    </Dialog>
  );
}

