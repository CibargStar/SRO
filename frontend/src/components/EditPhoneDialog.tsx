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
} from '@mui/material';
import { styled } from '@mui/material/styles';
import { updateClientPhoneSchema, type UpdateClientPhoneFormData } from '@/schemas/client-phone.schema';
import { useUpdateClientPhone } from '@/hooks/useClientPhones';
import type { ClientPhone } from '@/types';

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
  } = useForm<UpdateClientPhoneFormData>({
    resolver: zodResolver(updateClientPhoneSchema),
    defaultValues: { phone: '' },
  });

  useEffect(() => {
    if (phone && open) {
      reset({ phone: phone.phone });
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
            Редактировать телефон
          </Typography>
        </Box>

        <DialogContent sx={{ px: 3, pt: 3 }}>
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

