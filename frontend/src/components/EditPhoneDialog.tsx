/**
 * Диалог редактирования телефона клиента
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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import { StyledTextField, StyledButton, CancelButton, StyledSelect } from './common/FormStyles';
import { dialogPaperProps, dialogTitleStyles, dialogContentStyles, dialogActionsStyles } from './common/DialogStyles';
import { LOADING_ICON_SIZE } from './common/Constants';
import { updateClientPhoneSchema, type UpdateClientPhoneFormData } from '@/schemas/client-phone.schema';
import { useUpdateClientPhone } from '@/hooks/useClientPhones';
import type { ClientPhone, MessengerStatus } from '@/types';

interface EditPhoneDialogProps {
  open: boolean;
  clientId: string;
  phone: ClientPhone | null;
  onClose: () => void;
}

export function EditPhoneDialog({ open, clientId, phone, onClose }: EditPhoneDialogProps) {
  const updateMutation = useUpdateClientPhone();

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
    setValue,
  } = useForm<UpdateClientPhoneFormData>({
    resolver: zodResolver(updateClientPhoneSchema),
    defaultValues: { 
      phone: '',
      whatsAppStatus: 'Unknown',
      telegramStatus: 'Unknown',
    },
  });

  const whatsAppStatus = watch('whatsAppStatus');
  const telegramStatus = watch('telegramStatus');

  useEffect(() => {
    if (phone && open) {
      reset({ 
        phone: phone.phone,
        whatsAppStatus: phone.whatsAppStatus || 'Unknown',
        telegramStatus: phone.telegramStatus || 'Unknown',
      });
    }
  }, [phone, open, reset]);

  const onSubmit = (data: UpdateClientPhoneFormData) => {
    if (!phone) return;
    updateMutation.mutate(
      { clientId, phoneId: phone.id, phoneData: data },
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

  const errorMessage = updateMutation.error ? 'Не удалось обновить телефон' : null;

  if (!phone) return null;

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
            Редактировать телефон
          </Typography>
        </Box>

        <DialogContent sx={dialogContentStyles}>
          {errorMessage && (
            <Alert severity="error" sx={{ mb: 2, borderRadius: '12px' }}>
              {errorMessage}
            </Alert>
          )}

          <StyledTextField
            {...register('phone')}
            label="Номер телефона"
            error={!!errors.phone}
            helperText={errors.phone?.message}
            fullWidth
            placeholder="+7 (999) 123-45-67"
            sx={{ mb: 2 }}
          />

          <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
            <FormControl fullWidth>
              <InputLabel id="whatsapp-status-label" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                Статус WhatsApp
              </InputLabel>
              <StyledSelect
                labelId="whatsapp-status-label"
                label="Статус WhatsApp"
                value={whatsAppStatus || phone?.whatsAppStatus || 'Unknown'}
                onChange={(e) => setValue('whatsAppStatus', e.target.value as MessengerStatus)}
              >
                <MenuItem value="Unknown">Неизвестно</MenuItem>
                <MenuItem value="Valid">Валиден</MenuItem>
                <MenuItem value="Invalid">Невалиден</MenuItem>
              </StyledSelect>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel id="telegram-status-label" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                Статус Telegram
              </InputLabel>
              <StyledSelect
                labelId="telegram-status-label"
                label="Статус Telegram"
                value={telegramStatus || phone?.telegramStatus || 'Unknown'}
                onChange={(e) => setValue('telegramStatus', e.target.value as MessengerStatus)}
              >
                <MenuItem value="Unknown">Неизвестно</MenuItem>
                <MenuItem value="Valid">Валиден</MenuItem>
                <MenuItem value="Invalid">Невалиден</MenuItem>
              </StyledSelect>
            </FormControl>
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

