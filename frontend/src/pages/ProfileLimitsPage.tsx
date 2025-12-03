/**
 * Страница управления лимитами профилей (ROOT only)
 * 
 * Предоставляет интерфейс для управления лимитами профилей пользователей:
 * - Список всех лимитов
 * - Установка лимитов для пользователя
 * - Редактирование лимитов
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Alert,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogActions,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import EditIcon from '@mui/icons-material/Edit';
import { StyledButton, StyledTextField, CancelButton } from '@/components/common/FormStyles';
import { dialogPaperProps, dialogTitleStyles, dialogContentStyles, dialogActionsStyles } from '@/components/common/DialogStyles';
import { LOADING_ICON_SIZE } from '@/components/common/Constants';
import { useAllLimits, useUserLimits, useSetUserLimits } from '@/hooks/useProfileLimits';
import { useUsers } from '@/hooks/useUsers';
import { setProfileLimitsSchema, type SetProfileLimitsFormData } from '@/schemas/profile.schema';

const StyledTableContainer = styled(TableContainer)({
  borderRadius: '12px',
  backgroundColor: 'transparent',
});

const StyledTableCell = styled(TableCell)(({ theme }) => ({
  color: '#ffffff',
  borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
  padding: theme.spacing(2),
  '&.MuiTableCell-head': {
    color: 'rgba(255, 255, 255, 0.7)',
    fontWeight: 500,
    borderBottom: '1px solid rgba(255, 255, 255, 0.2)',
  },
}));

const StyledTableRow = styled(TableRow)({
  '&:hover': {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
});

const StyledIconButton = styled(IconButton)({
  color: 'rgba(255, 255, 255, 0.7)',
  '&:hover': {
    color: '#ffffff',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
});

interface EditLimitsDialogProps {
  open: boolean;
  onClose: () => void;
  userId: string;
  userName: string;
  currentLimits?: {
    maxProfiles: number;
    maxCpuPerProfile: number | null;
    maxMemoryPerProfile: number | null;
    maxNetworkPerProfile: number | null;
  };
}

function EditLimitsDialog({ open, onClose, userId, userName, currentLimits }: EditLimitsDialogProps) {
  const setLimitsMutation = useSetUserLimits();

  const {
    control,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<SetProfileLimitsFormData>({
    resolver: zodResolver(setProfileLimitsSchema),
    defaultValues: {
      maxProfiles: currentLimits?.maxProfiles || 10,
      maxCpuPerProfile: currentLimits?.maxCpuPerProfile ?? null,
      maxMemoryPerProfile: currentLimits?.maxMemoryPerProfile ?? null,
      maxNetworkPerProfile: currentLimits?.maxNetworkPerProfile ?? null,
    },
  });

  useEffect(() => {
    if (currentLimits) {
      reset({
        maxProfiles: currentLimits.maxProfiles,
        maxCpuPerProfile: currentLimits.maxCpuPerProfile,
        maxMemoryPerProfile: currentLimits.maxMemoryPerProfile,
        maxNetworkPerProfile: currentLimits.maxNetworkPerProfile,
      });
    }
  }, [currentLimits, reset]);

  const onSubmit = (data: SetProfileLimitsFormData) => {
    setLimitsMutation.mutate(
      { userId, limitsData: data },
      {
        onSuccess: () => {
          onClose();
        },
      }
    );
  };

  const handleClose = () => {
    if (!setLimitsMutation.isPending) {
      reset();
      onClose();
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} PaperProps={dialogPaperProps} maxWidth="sm" fullWidth>
      <Box sx={dialogTitleStyles}>
        <Typography variant="h6">Установка лимитов для {userName}</Typography>
      </Box>

      <form onSubmit={handleSubmit(onSubmit)}>
        <DialogContent sx={dialogContentStyles}>
          {setLimitsMutation.isError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {setLimitsMutation.error instanceof Error
                ? setLimitsMutation.error.message
                : 'Произошла ошибка при установке лимитов'}
            </Alert>
          )}

          <Controller
            name="maxProfiles"
            control={control}
            render={({ field }) => (
              <StyledTextField
                {...field}
                type="number"
                label="Максимальное количество профилей"
                fullWidth
                error={!!errors.maxProfiles}
                helperText={errors.maxProfiles?.message}
                disabled={setLimitsMutation.isPending}
                sx={{ mb: 2 }}
                inputProps={{ min: 1 }}
              />
            )}
          />

          <Controller
            name="maxCpuPerProfile"
            control={control}
            render={({ field }) => (
              <StyledTextField
                {...field}
                type="number"
                label="Максимальное использование CPU (0-1)"
                fullWidth
                error={!!errors.maxCpuPerProfile}
                helperText={errors.maxCpuPerProfile?.message || 'Например: 0.5 = 50%'}
                disabled={setLimitsMutation.isPending}
                sx={{ mb: 2 }}
                inputProps={{ min: 0, max: 1, step: 0.1 }}
                value={field.value ?? ''}
                onChange={(e) => field.onChange(e.target.value === '' ? null : parseFloat(e.target.value))}
              />
            )}
          />

          <Controller
            name="maxMemoryPerProfile"
            control={control}
            render={({ field }) => (
              <StyledTextField
                {...field}
                type="number"
                label="Максимальное использование памяти (MB)"
                fullWidth
                error={!!errors.maxMemoryPerProfile}
                helperText={errors.maxMemoryPerProfile?.message}
                disabled={setLimitsMutation.isPending}
                sx={{ mb: 2 }}
                inputProps={{ min: 1 }}
                value={field.value ?? ''}
                onChange={(e) => field.onChange(e.target.value === '' ? null : parseInt(e.target.value, 10))}
              />
            )}
          />

          <Controller
            name="maxNetworkPerProfile"
            control={control}
            render={({ field }) => (
              <StyledTextField
                {...field}
                type="number"
                label="Максимальная скорость сети (KB/s)"
                fullWidth
                error={!!errors.maxNetworkPerProfile}
                helperText={errors.maxNetworkPerProfile?.message}
                disabled={setLimitsMutation.isPending}
                inputProps={{ min: 1 }}
                value={field.value ?? ''}
                onChange={(e) => field.onChange(e.target.value === '' ? null : parseInt(e.target.value, 10))}
              />
            )}
          />
        </DialogContent>

        <DialogActions sx={dialogActionsStyles}>
          <CancelButton onClick={handleClose} disabled={setLimitsMutation.isPending}>
            Отмена
          </CancelButton>
          <StyledButton
            type="submit"
            variant="contained"
            disabled={setLimitsMutation.isPending}
            startIcon={setLimitsMutation.isPending ? <CircularProgress size={LOADING_ICON_SIZE} /> : null}
          >
            Сохранить
          </StyledButton>
        </DialogActions>
      </form>
    </Dialog>
  );
}

export function ProfileLimitsPage() {
  const { data: limits = [], isLoading: limitsLoading, error: limitsError } = useAllLimits();
  const { data: users = [], isLoading: usersLoading } = useUsers();
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedUserLimits, setSelectedUserLimits] = useState<typeof limits[0] | null>(null);

  const handleEdit = (userId: string) => {
    const userLimits = limits.find((l) => l.userId === userId);
    setSelectedUserId(userId);
    setSelectedUserLimits(userLimits || null);
    setEditDialogOpen(true);
  };

  const handleCloseEditDialog = () => {
    setEditDialogOpen(false);
    setSelectedUserId(null);
    setSelectedUserLimits(null);
  };

  const isLoading = limitsLoading || usersLoading;
  const errorMessage = limitsError ? 'Не удалось загрузить лимиты' : null;

  // Создаем массив всех пользователей с их лимитами
  const usersWithLimits = users.map((user) => {
    const userLimit = limits.find((l) => l.userId === user.id);
    return {
      user,
      limits: userLimit || {
        userId: user.id,
        maxProfiles: 10, // Дефолтное значение
        maxCpuPerProfile: null,
        maxMemoryPerProfile: null,
        maxNetworkPerProfile: null,
      },
    };
  });

  const selectedUser = users.find((u) => u.id === selectedUserId);

  return (
    <Box sx={{ width: '100%' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Typography variant="h4" component="h1" sx={{ color: '#f5f5f5', fontWeight: 500 }}>
          Управление лимитами профилей
        </Typography>
      </Box>

      {errorMessage && (
        <Alert severity="error" sx={{ mb: 3, borderRadius: '12px', backgroundColor: 'rgba(244, 67, 54, 0.1)', color: '#ffffff' }}>
          {errorMessage}
        </Alert>
      )}

      {isLoading ? (
        <Box display="flex" justifyContent="center" alignItems="center" minHeight={400}>
          <CircularProgress sx={{ color: '#f5f5f5' }} />
        </Box>
      ) : (
        <StyledTableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <StyledTableCell>Пользователь</StyledTableCell>
                <StyledTableCell align="center">Макс. профилей</StyledTableCell>
                <StyledTableCell align="center">Макс. CPU</StyledTableCell>
                <StyledTableCell align="center">Макс. память (MB)</StyledTableCell>
                <StyledTableCell align="center">Макс. сеть (KB/s)</StyledTableCell>
                <StyledTableCell align="center" sx={{ width: '100px' }}>
                  Действия
                </StyledTableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {usersWithLimits.map(({ user, limits: userLimits }) => (
                <StyledTableRow key={user.id}>
                  <StyledTableCell>
                    {user.name || user.email}
                    {user.role === 'ROOT' && (
                      <Typography component="span" sx={{ color: 'rgba(255, 255, 255, 0.5)', ml: 1, fontSize: '0.875rem' }}>
                        (ROOT)
                      </Typography>
                    )}
                  </StyledTableCell>
                  <StyledTableCell align="center">{userLimits.maxProfiles}</StyledTableCell>
                  <StyledTableCell align="center">
                    {userLimits.maxCpuPerProfile !== null ? `${(userLimits.maxCpuPerProfile * 100).toFixed(0)}%` : '-'}
                  </StyledTableCell>
                  <StyledTableCell align="center">
                    {userLimits.maxMemoryPerProfile !== null ? userLimits.maxMemoryPerProfile : '-'}
                  </StyledTableCell>
                  <StyledTableCell align="center">
                    {userLimits.maxNetworkPerProfile !== null ? userLimits.maxNetworkPerProfile : '-'}
                  </StyledTableCell>
                  <StyledTableCell align="center">
                    <StyledIconButton size="small" onClick={() => handleEdit(user.id)} aria-label="Редактировать">
                      <EditIcon fontSize="small" />
                    </StyledIconButton>
                  </StyledTableCell>
                </StyledTableRow>
              ))}
            </TableBody>
          </Table>
        </StyledTableContainer>
      )}

      {/* Диалог редактирования лимитов */}
      {selectedUser && (
        <EditLimitsDialog
          open={editDialogOpen}
          onClose={handleCloseEditDialog}
          userId={selectedUserId || ''}
          userName={selectedUser.name || selectedUser.email}
          currentLimits={selectedUserLimits ? {
            maxProfiles: selectedUserLimits.maxProfiles,
            maxCpuPerProfile: selectedUserLimits.maxCpuPerProfile,
            maxMemoryPerProfile: selectedUserLimits.maxMemoryPerProfile,
            maxNetworkPerProfile: selectedUserLimits.maxNetworkPerProfile,
          } : undefined}
        />
      )}
    </Box>
  );
}




