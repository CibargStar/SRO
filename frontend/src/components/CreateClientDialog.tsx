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
} from '@mui/material';
import { StyledSelect, MenuProps, selectInputLabelStyles } from './common/SelectStyles';
import { StyledTextField, StyledButton, CancelButton } from './common/FormStyles';
import { dialogPaperProps, dialogTitleStyles, dialogContentStyles, dialogActionsStyles } from './common/DialogStyles';
import { LOADING_ICON_SIZE } from './common/Constants';
import { createClientSchema, type CreateClientFormData } from '@/schemas/client.schema';
import { useCreateClient } from '@/hooks/useClients';
import { useRegions } from '@/hooks/useRegions';
import { useClientGroups } from '@/hooks/useClientGroups';
import { useCreateClientPhone } from '@/hooks/useClientPhones';
import { useAuthStore } from '@/store';
import { ClientPhonesFormField } from './ClientPhonesFormField';
import { CreateClientGroupDialog } from './CreateClientGroupDialog';
import WarningIcon from '@mui/icons-material/Warning';

interface CreateClientDialogProps {
  open: boolean;
  onClose: () => void;
  userId?: string; // Опциональный ID пользователя для ROOT (передается из родительского компонента)
}

interface PhoneItem {
  id: string;
  phone: string;
  isNew?: boolean;
}

export function CreateClientDialog({ open, onClose, userId: propUserId }: CreateClientDialogProps) {
  const user = useAuthStore((state) => state.user);
  const isRoot = user?.role === 'ROOT';
  const createMutation = useCreateClient();
  const createPhoneMutation = useCreateClientPhone();
  const { data: regions = [] } = useRegions();
  const { data: groups = [], isLoading: groupsLoading } = useClientGroups(isRoot && propUserId ? propUserId : undefined);
  const [phones, setPhones] = React.useState<PhoneItem[]>([]);
  const [createGroupDialogOpen, setCreateGroupDialogOpen] = React.useState(false);

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
    getValues,
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
    createMutation.mutate(
      {
        ...data,
        userId: isRoot && propUserId ? propUserId : undefined, // Для ROOT - создание от имени переданного пользователя
      },
      {
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
        setCreateGroupDialogOpen(false);
        onClose();
    }
  };

  const handleGroupCreated = (newGroupId: string) => {
    // После создания группы обновляем форму, устанавливая новую группу
    const currentValues = getValues();
    reset({
      ...currentValues,
      groupId: newGroupId,
    });
    setCreateGroupDialogOpen(false);
  };

  const hasGroups = groups.length > 0;

  const errorMessage = createMutation.error ? 'Не удалось создать клиента' : null;

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
            Создать клиента
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

            {!groupsLoading && !hasGroups ? (
              <Alert 
                severity="warning" 
                icon={false}
                sx={{ 
                  mb: 2, 
                  borderRadius: '12px', 
                  backgroundColor: 'rgba(255, 152, 0, 0.1)', 
                  color: '#ffffff', 
                  border: 'none',
                  '& .MuiAlert-message': {
                    width: '100%',
                  },
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, width: '100%' }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flex: 1 }}>
                    <WarningIcon sx={{ color: '#ff9800', fontSize: '20px', flexShrink: 0 }} />
                    <Typography variant="body2" sx={{ color: '#ffffff', mb: 0 }}>
                      У вас нет групп клиентов.
                    </Typography>
                  </Box>
                  <StyledButton
                    size="small"
                    onClick={() => setCreateGroupDialogOpen(true)}
                    sx={{ flexShrink: 0 }}
                  >
                    Создать группу
                  </StyledButton>
                </Box>
              </Alert>
            ) : (
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
            )}

            <FormControl fullWidth>
              <InputLabel sx={selectInputLabelStyles}>
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

            <ClientPhonesFormField phones={phones} onChange={setPhones} />
          </Box>
        </DialogContent>

        <DialogActions sx={dialogActionsStyles}>
          <CancelButton onClick={handleClose} disabled={createMutation.isPending}>
            Отмена
          </CancelButton>
          <StyledButton 
            type="submit" 
            disabled={createMutation.isPending || createPhoneMutation.isPending || !hasGroups || groupsLoading}
          >
            {createMutation.isPending || createPhoneMutation.isPending ? <CircularProgress size={LOADING_ICON_SIZE} /> : 'Создать'}
          </StyledButton>
        </DialogActions>
      </form>

      {/* Диалог создания группы */}
      <CreateClientGroupDialog
        open={createGroupDialogOpen}
        onClose={() => setCreateGroupDialogOpen(false)}
        onSuccess={handleGroupCreated}
        userId={propUserId}
      />
    </Dialog>
  );
}

