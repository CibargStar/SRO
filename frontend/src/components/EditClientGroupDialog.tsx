/**
 * Диалог редактирования группы клиентов
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
import { updateClientGroupSchema, type UpdateClientGroupFormData } from '@/schemas/client-group.schema';
import { useUpdateClientGroup } from '@/hooks/useClientGroups';
import type { ClientGroup } from '@/types';

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

interface EditClientGroupDialogProps {
  open: boolean;
  group: ClientGroup | null;
  onClose: () => void;
}

export function EditClientGroupDialog({ open, group, onClose }: EditClientGroupDialogProps) {
  const updateMutation = useUpdateClientGroup();

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<UpdateClientGroupFormData>({
    resolver: zodResolver(updateClientGroupSchema),
    defaultValues: {
      name: '',
      description: null,
      color: null,
      orderIndex: null,
    },
  });

  useEffect(() => {
    if (group && open) {
      reset({
        name: group.name,
        description: group.description,
        color: group.color,
        orderIndex: group.orderIndex,
      });
    }
  }, [group, open, reset]);

  const onSubmit = (data: UpdateClientGroupFormData) => {
    if (!group) return;
    updateMutation.mutate(
      { groupId: group.id, groupData: data },
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

  const errorMessage = updateMutation.error ? 'Не удалось обновить группу' : null;

  if (!group) return null;

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{ sx: { backgroundColor: '#212121', borderRadius: '12px' } }}
    >
      <form onSubmit={handleSubmit(onSubmit)}>
        <Box sx={{ px: 3, pt: 3, pb: 2, borderBottom: '1px solid rgba(255, 255, 255, 0.1)' }}>
          <Typography variant="h6" sx={{ color: '#f5f5f5', fontWeight: 500 }}>
            Редактировать группу
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
              {...register('name')}
              label="Название группы"
              error={!!errors.name}
              helperText={errors.name?.message}
              fullWidth
            />

            <StyledTextField
              {...register('description')}
              label="Описание"
              error={!!errors.description}
              helperText={errors.description?.message}
              fullWidth
              multiline
              rows={3}
            />

            <StyledTextField
              {...register('color')}
              label="Цвет (HEX или название)"
              error={!!errors.color}
              helperText={errors.color?.message}
              fullWidth
              placeholder="#FF5733"
            />

            <StyledTextField
              {...register('orderIndex', { valueAsNumber: true })}
              label="Порядок сортировки"
              type="number"
              error={!!errors.orderIndex}
              helperText={errors.orderIndex?.message}
              fullWidth
            />
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

