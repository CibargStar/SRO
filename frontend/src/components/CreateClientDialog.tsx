/**
 * Диалог создания клиента
 * 
 * Форма создания нового клиента с валидацией через React Hook Form и Zod.
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
import { createClientSchema, type CreateClientFormData } from '@/schemas/client.schema';
import { useCreateClient } from '@/hooks/useClients';
import { useRegions } from '@/hooks/useRegions';
import { useClientGroups } from '@/hooks/useClientGroups';
import { useCreateClientPhone } from '@/hooks/useClientPhones';
import { ClientPhonesFormField } from './ClientPhonesFormField';

const StyledTextField = styled(TextField)(({ theme }) => ({
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
}));

const StyledSelect = styled(Select)({
  borderRadius: '12px',
  backgroundColor: 'rgba(255, 255, 255, 0.05)',
  color: '#ffffff',
  '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
  '&:hover .MuiOutlinedInput-notchedOutline': { border: 'none' },
  '&.Mui-focused .MuiOutlinedInput-notchedOutline': { border: 'none' },
  '& .MuiSelect-icon': { color: 'rgba(255, 255, 255, 0.7)' },
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

interface CreateClientDialogProps {
  open: boolean;
  onClose: () => void;
}

interface PhoneItem {
  id: string;
  phone: string;
  isNew?: boolean;
}

export function CreateClientDialog({ open, onClose }: CreateClientDialogProps) {
  const createMutation = useCreateClient();
  const createPhoneMutation = useCreateClientPhone();
  const { data: regions = [] } = useRegions();
  const { data: groups = [] } = useClientGroups();
  const [phones, setPhones] = React.useState<PhoneItem[]>([]);

  // Сброс телефонов при закрытии диалога
  useEffect(() => {
    if (!open) {
      setPhones([]);
    }
  }, [open]);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
    reset,
  } = useForm<CreateClientFormData>({
    resolver: zodResolver(createClientSchema),
    defaultValues: {
      lastName: '',
      firstName: '',
      middleName: null,
      regionId: null,
      groupId: null,
      status: 'NEW',
    },
  });

  const onSubmit = (data: CreateClientFormData) => {
    createMutation.mutate(data, {
      onSuccess: async (createdClient) => {
        // Создаем телефоны после создания клиента
        if (phones.length > 0) {
          const phonePromises = phones.map((phone) =>
            createPhoneMutation.mutateAsync({
              clientId: createdClient.id,
              phoneData: { phone: phone.phone },
            })
          );
          await Promise.all(phonePromises);
        }
        reset();
        setPhones([]);
        onClose();
      },
    });
  };

  const handleClose = () => {
    if (!createMutation.isPending && !createPhoneMutation.isPending) {
      reset();
      setPhones([]);
      onClose();
    }
  };

  const errorMessage = createMutation.error ? 'Не удалось создать клиента' : null;

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
            Создать клиента
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
              <InputLabel sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>Регион</InputLabel>
              <Controller
                name="regionId"
                control={control}
                render={({ field }) => (
                  <StyledSelect {...field} label="Регион" value={field.value || ''}>
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

            <FormControl fullWidth>
              <InputLabel sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>Группа</InputLabel>
              <Controller
                name="groupId"
                control={control}
                render={({ field }) => (
                  <StyledSelect {...field} label="Группа" value={field.value || ''}>
                    <MenuItem value="">Не выбрана</MenuItem>
                    {groups.map((group) => (
                      <MenuItem key={group.id} value={group.id}>
                        {group.name}
                      </MenuItem>
                    ))}
                  </StyledSelect>
                )}
              />
            </FormControl>

            <FormControl fullWidth>
              <InputLabel sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>Статус</InputLabel>
              <Controller
                name="status"
                control={control}
                render={({ field }) => (
                  <StyledSelect {...field} label="Статус">
                    <MenuItem value="NEW">Новый</MenuItem>
                    <MenuItem value="OLD">Старый</MenuItem>
                  </StyledSelect>
                )}
              />
            </FormControl>

            <ClientPhonesFormField phones={phones} onChange={setPhones} />
          </Box>
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 3, pt: 2 }}>
          <CancelButton onClick={handleClose} disabled={createMutation.isPending}>
            Отмена
          </CancelButton>
          <StyledButton type="submit" disabled={createMutation.isPending || createPhoneMutation.isPending}>
            {createMutation.isPending || createPhoneMutation.isPending ? <CircularProgress size={20} /> : 'Создать'}
          </StyledButton>
        </DialogActions>
      </form>
    </Dialog>
  );
}

