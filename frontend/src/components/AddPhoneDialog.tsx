/**
 * Диалог добавления телефона клиента
 */

import React from 'react';
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
import { createClientPhoneSchema, type CreateClientPhoneFormData } from '@/schemas/client-phone.schema';
import { useCreateClientPhone } from '@/hooks/useClientPhones';
import type { MessengerStatus } from '@/types';

interface AddPhoneDialogProps {
  open: boolean;
  clientId: string;
  onClose: () => void;
}

export function AddPhoneDialog({ open, clientId, onClose }: AddPhoneDialogProps) {
  const createMutation = useCreateClientPhone();

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
    setValue,
  } = useForm<CreateClientPhoneFormData>({
    resolver: zodResolver(createClientPhoneSchema),
    defaultValues: { 
      phone: '',
      whatsAppStatus: 'Unknown',
      telegramStatus: 'Unknown',
    },
  });

  const whatsAppStatus = watch('whatsAppStatus');
  const telegramStatus = watch('telegramStatus');

  const onSubmit = (data: CreateClientPhoneFormData) => {
    createMutation.mutate(
      { clientId, phoneData: data },
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

  const errorMessage = createMutation.error ? 'Не удалось добавить телефон' : null;

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
            Добавить телефон
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
                value={whatsAppStatus || 'Unknown'}
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
                value={telegramStatus || 'Unknown'}
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
          <CancelButton onClick={handleClose} disabled={createMutation.isPending}>
            Отмена
          </CancelButton>
          <StyledButton type="submit" disabled={createMutation.isPending}>
            {createMutation.isPending ? <CircularProgress size={LOADING_ICON_SIZE} /> : 'Добавить'}
          </StyledButton>
        </DialogActions>
      </form>
    </Dialog>
  );
}

