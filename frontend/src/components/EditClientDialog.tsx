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
import { useClientGroups } from '@/hooks/useClientGroups';
import { useAuthStore } from '@/store';
import { ClientPhonesFormField } from './ClientPhonesFormField';
import { useClientPhones, useCreateClientPhone, useUpdateClientPhone, useDeleteClientPhone } from '@/hooks/useClientPhones';
import type { Client, MessengerStatus } from '@/types';

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
  const { data: groups = [], isLoading: groupsLoading } = useClientGroups(groupFilterUserId);
  
  // Загрузка телефонов клиента
  const { data: existingPhones = [], isLoading: phonesLoading } = useClientPhones(client?.id || '');
  const createPhoneMutation = useCreateClientPhone();
  const updatePhoneMutation = useUpdateClientPhone();
  const deletePhoneMutation = useDeleteClientPhone();
  
  const [phones, setPhones] = React.useState<Array<{ id: string; phone: string; whatsAppStatus?: MessengerStatus; telegramStatus?: MessengerStatus }>>([]);

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

  // Заполнение формы и телефонов при открытии диалога
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
  
  // Загрузка телефонов при открытии диалога
  useEffect(() => {
    if (existingPhones && open && client) {
      setPhones(
        existingPhones.map((p) => ({
          id: p.id,
          phone: p.phone,
          whatsAppStatus: p.whatsAppStatus,
          telegramStatus: p.telegramStatus,
        }))
      );
    }
  }, [existingPhones, open, client]);
  
  // Сброс телефонов при закрытии диалога
  useEffect(() => {
    if (!open) {
      setPhones([]);
    }
  }, [open]);

  const onSubmit = async (data: UpdateClientFormData) => {
    if (!client) return;
    
    try {
      // Обновляем клиента
      await updateMutation.mutateAsync({ clientId: client.id, clientData: data });
      
      // Обновляем телефоны
      const existingPhoneIds = new Set(existingPhones.map((p) => p.id));
      const currentPhoneIds = new Set(
        phones.map((p) => (!p.id.startsWith('temp-') ? p.id : null)).filter((id): id is string => id !== null)
      );
      
      // Удаляем удаленные телефоны
      const phonesToDelete = existingPhones.filter((p) => !currentPhoneIds.has(p.id));
      for (const phone of phonesToDelete) {
        await deletePhoneMutation.mutateAsync({ clientId: client.id, phoneId: phone.id });
      }
      
      // Обновляем или создаем телефоны
      for (const phone of phones) {
        if (phone.id.startsWith('temp-')) {
          // Новый телефон - создаем
          await createPhoneMutation.mutateAsync({
            clientId: client.id,
            phoneData: {
              phone: phone.phone,
              whatsAppStatus: phone.whatsAppStatus || 'Unknown',
              telegramStatus: phone.telegramStatus || 'Unknown',
            },
          });
        } else if (existingPhoneIds.has(phone.id)) {
          // Существующий телефон - проверяем, нужно ли обновить
          const existingPhone = existingPhones.find((p) => p.id === phone.id);
          if (
            existingPhone &&
            (existingPhone.phone !== phone.phone ||
              existingPhone.whatsAppStatus !== phone.whatsAppStatus ||
              existingPhone.telegramStatus !== phone.telegramStatus)
          ) {
            await updatePhoneMutation.mutateAsync({
              clientId: client.id,
              phoneId: phone.id,
              phoneData: {
                phone: phone.phone,
                whatsAppStatus: phone.whatsAppStatus,
                telegramStatus: phone.telegramStatus,
              },
            });
          }
        }
      }
      
      onClose();
    } catch (error) {
      // Ошибка уже обрабатывается в mutation
      console.error('Error updating client and phones:', error);
    }
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
      sx={{
        '& .MuiDialog-container': {
          '&::-webkit-scrollbar': {
            display: 'none !important',
            width: '0 !important',
            height: '0 !important',
          },
          scrollbarWidth: 'none !important',
          msOverflowStyle: 'none !important',
        },
      }}
      PaperProps={{
        sx: {
          backgroundColor: '#212121',
          borderRadius: '12px',
          overflow: 'hidden',
          maxHeight: '90vh',
          height: '90vh',
          width: '100%',
          maxWidth: '600px',
          display: 'flex',
          flexDirection: 'column',
          padding: 0,
          '& .MuiDialogContent-root': {
            overflowY: 'auto',
            flex: '1 1 auto',
            '&::-webkit-scrollbar': {
              display: 'none',
              width: 0,
              height: 0,
            },
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
          },
          '& .MuiDialogActions-root': {
            margin: 0,
          },
          '& form': {
            margin: 0,
            padding: 0,
            height: '100%',
            minHeight: '100%',
            display: 'flex',
            flexDirection: 'column',
          },
          '& *': {
            '&::-webkit-scrollbar': {
              display: 'none',
              width: 0,
              height: 0,
            },
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
          },
        },
      }}
    >
      <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: '100%', margin: 0, padding: 0 }}>
        <Box sx={{ ...dialogTitleStyles, flexShrink: 0 }}>
          <Typography variant="h6" sx={{ color: '#f5f5f5', fontWeight: 500 }}>
            Редактировать клиента
          </Typography>
        </Box>

        <DialogContent
          sx={{
            ...dialogContentStyles,
            overflowY: 'auto',
            flex: '1 1 auto',
            minHeight: 0,
            '&::-webkit-scrollbar': {
              display: 'none',
              width: 0,
              height: 0,
            },
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            '& *': {
              '&::-webkit-scrollbar': {
                display: 'none',
                width: 0,
                height: 0,
              },
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
            },
          }}
        >
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

            <FormControl fullWidth required disabled={groupsLoading}>
              <InputLabel sx={selectInputLabelStyles}>
                Группа
              </InputLabel>
              <Controller
                name="groupId"
                control={control}
                render={({ field, fieldState }) => (
                  <StyledSelect 
                    {...field} 
                    label="Группа" 
                    value={field.value || ''} 
                    MenuProps={MenuProps}
                    error={!!fieldState.error}
                    disabled={groupsLoading}
                  >
                    {groups.map((group) => (
                      <MenuItem key={group.id} value={group.id}>
                        {group.name}
                      </MenuItem>
                    ))}
                  </StyledSelect>
                )}
              />
              {errors.groupId && (
                <Typography variant="caption" sx={{ color: '#f44336', mt: 0.5, ml: 1.75 }}>
                  {errors.groupId.message}
                </Typography>
              )}
            </FormControl>

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
              {phonesLoading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                  <CircularProgress size={24} sx={{ color: '#f5f5f5' }} />
                </Box>
              ) : (
                <ClientPhonesFormField phones={phones} onChange={setPhones} />
              )}
            </Box>
          </Box>
        </DialogContent>

        <DialogActions sx={{ px: 3, pt: 2, pb: 2, flexShrink: 0, marginTop: 'auto', m: 0 }}>
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

