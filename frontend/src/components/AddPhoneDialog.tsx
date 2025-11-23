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
} from '@mui/material';
import { StyledTextField, StyledButton, CancelButton } from './common/FormStyles';
import { dialogPaperProps, dialogTitleStyles, dialogContentStyles, dialogActionsStyles } from './common/DialogStyles';
import { LOADING_ICON_SIZE } from './common/Constants';
import { createClientPhoneSchema, type CreateClientPhoneFormData } from '@/schemas/client-phone.schema';
import { useCreateClientPhone } from '@/hooks/useClientPhones';

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
  } = useForm<CreateClientPhoneFormData>({
    resolver: zodResolver(createClientPhoneSchema),
    defaultValues: { phone: '' },
  });

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
          />
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

