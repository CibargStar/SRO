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
} from '@mui/material';
import { StyledSelect, MenuProps, selectInputLabelStyles } from './common/SelectStyles';
import { StyledTextField, StyledButton, CancelButton } from './common/FormStyles';
import { dialogPaperProps, dialogTitleStyles, dialogContentStyles, dialogActionsStyles } from './common/DialogStyles';
import { LOADING_ICON_SIZE } from './common/Constants';
import { updateClientSchema, type UpdateClientFormData } from '@/schemas/client.schema';
import { useUpdateClient } from '@/hooks/useClients';
import { useRegions } from '@/hooks/useRegions';
import { useAuthStore } from '@/store';
import { ClientGroupSelector } from './ClientGroupSelector';
import { ClientPhonesList } from './ClientPhonesList';
import type { Client } from '@/types';

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
      PaperProps={dialogPaperProps}
    >
      <form onSubmit={handleSubmit(onSubmit)}>
        <Box sx={dialogTitleStyles}>
          <Typography variant="h6" sx={{ color: '#f5f5f5', fontWeight: 500 }}>
            Редактировать клиента
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
              <InputLabel sx={selectInputLabelStyles}>
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

