/**
 * Диалог создания аккаунта мессенджера
 * 
 * Позволяет выбрать мессенджер и создать аккаунт для профиля.
 */

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogActions,
  DialogTitle,
  Box,
  Typography,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  CircularProgress,
  Alert,
} from '@mui/material';
import { dialogPaperProps, dialogTitleStyles, dialogActionsStyles } from './common/DialogStyles';
import { StyledButton } from './common/FormStyles';
import { useMessengerServices } from '@/hooks/useMessengers';
import { useCreateMessengerAccount } from '@/hooks/useMessengers';
import type { MessengerService } from '@/types';

interface CreateMessengerAccountDialogProps {
  open: boolean;
  onClose: () => void;
  profileId: string;
  existingServiceIds?: string[]; // ID мессенджеров, для которых уже есть аккаунты
}

/**
 * Компонент диалога создания аккаунта мессенджера
 */
export function CreateMessengerAccountDialog({
  open,
  onClose,
  profileId,
  existingServiceIds = [],
}: CreateMessengerAccountDialogProps) {
  const [selectedServiceId, setSelectedServiceId] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const { data: services, isLoading: servicesLoading } = useMessengerServices({
    enabled: open,
  });

  const createMutation = useCreateMessengerAccount();

  // Фильтруем только доступные мессенджеры (те, для которых еще нет аккаунта)
  const availableServices = services?.filter(
    (service) => service.enabled && !existingServiceIds.includes(service.id)
  ) || [];

  const handleCreate = async () => {
    if (!selectedServiceId) {
      setError('Выберите мессенджер');
      return;
    }

    setError(null);
    try {
      await createMutation.mutateAsync({
        profileId,
        accountData: {
          serviceId: selectedServiceId,
          isEnabled: true,
        },
      });
      setSelectedServiceId('');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка при создании аккаунта');
    }
  };

  const handleClose = () => {
    setSelectedServiceId('');
    setError(null);
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} PaperProps={dialogPaperProps} maxWidth="sm" fullWidth>
      <Box sx={dialogTitleStyles}>
        <Typography variant="h6">Добавить аккаунт мессенджера</Typography>
      </Box>

      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {servicesLoading ? (
          <Box display="flex" justifyContent="center" alignItems="center" minHeight={150}>
            <CircularProgress sx={{ color: '#f5f5f5' }} />
          </Box>
        ) : availableServices.length === 0 ? (
          <Typography sx={{ color: 'rgba(255, 255, 255, 0.7)', textAlign: 'center', py: 4 }}>
            Все доступные мессенджеры уже добавлены к профилю.
          </Typography>
        ) : (
          <FormControl fullWidth sx={{ mt: 2 }}>
            <InputLabel id="messenger-service-label" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
              Мессенджер
            </InputLabel>
            <Select
              labelId="messenger-service-label"
              value={selectedServiceId}
              onChange={(e) => setSelectedServiceId(e.target.value)}
              label="Мессенджер"
              sx={{
                color: '#ffffff',
                '& .MuiOutlinedInput-notchedOutline': {
                  borderColor: 'rgba(255, 255, 255, 0.3)',
                },
                '&:hover .MuiOutlinedInput-notchedOutline': {
                  borderColor: 'rgba(255, 255, 255, 0.5)',
                },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                  borderColor: '#ffffff',
                },
                '& .MuiSvgIcon-root': {
                  color: 'rgba(255, 255, 255, 0.7)',
                },
              }}
            >
              {availableServices.map((service) => (
                <MenuItem key={service.id} value={service.id}>
                  {service.displayName}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}
      </DialogContent>

      <DialogActions sx={dialogActionsStyles}>
        <StyledButton onClick={handleClose} variant="outlined" disabled={createMutation.isPending}>
          Отмена
        </StyledButton>
        <StyledButton
          onClick={handleCreate}
          variant="contained"
          disabled={!selectedServiceId || createMutation.isPending || availableServices.length === 0}
        >
          {createMutation.isPending ? (
            <>
              <CircularProgress size={20} sx={{ color: '#ffffff', mr: 1 }} />
              Создание...
            </>
          ) : (
            'Добавить'
          )}
        </StyledButton>
      </DialogActions>
    </Dialog>
  );
}




