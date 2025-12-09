/**
 * Страница управления конфигурациями проверки мессенджеров (ROOT only)
 * 
 * Предоставляет интерфейс для управления конфигурациями проверки статуса входа:
 * - Список всех конфигураций
 * - Настройка интервала проверки для каждого мессенджера
 * - Включение/выключение мониторинга
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
  Switch,
  FormControlLabel,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import EditIcon from '@mui/icons-material/Edit';
import { StyledButton, StyledTextField, CancelButton } from '@/components/common/FormStyles';
import { dialogPaperProps, dialogTitleStyles, dialogContentStyles, dialogActionsStyles } from '@/components/common/DialogStyles';
import { LOADING_ICON_SIZE } from '@/components/common/Constants';
import { useMessengerCheckConfigs, useUpdateMessengerCheckConfig } from '@/hooks/useMessengers';
import { z } from 'zod';

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

/**
 * Схема валидации для обновления конфигурации
 */
const updateConfigSchema = z.object({
  checkIntervalSeconds: z
    .number({ required_error: 'Интервал проверки обязателен' })
    .int({ message: 'Интервал должен быть целым числом' })
    .min(60, { message: 'Минимальный интервал - 60 секунд' })
    .max(3600, { message: 'Максимальный интервал - 3600 секунд (1 час)' }),
  enabled: z.boolean(),
});

type UpdateConfigFormData = z.infer<typeof updateConfigSchema>;

interface EditConfigDialogProps {
  open: boolean;
  onClose: () => void;
  serviceId: string;
  serviceName: string;
  currentConfig?: {
    checkIntervalSeconds: number;
    enabled: boolean;
  };
}

function EditConfigDialog({ open, onClose, serviceId, serviceName, currentConfig }: EditConfigDialogProps) {
  const updateConfigMutation = useUpdateMessengerCheckConfig();

  const {
    control,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<UpdateConfigFormData>({
    resolver: zodResolver(updateConfigSchema),
    defaultValues: {
      checkIntervalSeconds: currentConfig?.checkIntervalSeconds || 300,
      enabled: currentConfig?.enabled ?? true,
    },
  });

  useEffect(() => {
    if (currentConfig) {
      reset({
        checkIntervalSeconds: currentConfig.checkIntervalSeconds,
        enabled: currentConfig.enabled,
      });
    }
  }, [currentConfig, reset]);

  const onSubmit = (data: UpdateConfigFormData) => {
    updateConfigMutation.mutate(
      {
        serviceId,
        configData: {
          checkIntervalSeconds: data.checkIntervalSeconds,
          enabled: data.enabled,
        },
      },
      {
        onSuccess: () => {
          onClose();
        },
      }
    );
  };

  const handleClose = () => {
    if (!updateConfigMutation.isPending) {
      reset();
      onClose();
    }
  };

  const formatInterval = (seconds: number): string => {
    if (seconds < 60) {
      return `${seconds} сек`;
    } else if (seconds < 3600) {
      return `${Math.floor(seconds / 60)} мин`;
    } else {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      return minutes > 0 ? `${hours} ч ${minutes} мин` : `${hours} ч`;
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} PaperProps={dialogPaperProps} maxWidth="sm" fullWidth>
      <Box sx={dialogTitleStyles}>
        <Typography variant="h6">Настройка конфигурации для {serviceName}</Typography>
      </Box>

      <form onSubmit={handleSubmit(onSubmit)}>
        <DialogContent sx={dialogContentStyles}>
          {updateConfigMutation.isError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {updateConfigMutation.error instanceof Error
                ? updateConfigMutation.error.message
                : 'Произошла ошибка при обновлении конфигурации'}
            </Alert>
          )}

          <Controller
            name="checkIntervalSeconds"
            control={control}
            render={({ field }) => (
              <StyledTextField
                {...field}
                type="number"
                label="Интервал проверки (секунды)"
                fullWidth
                error={!!errors.checkIntervalSeconds}
                helperText={
                  errors.checkIntervalSeconds?.message ||
                  `Текущий интервал: ${formatInterval(field.value || 300)}`
                }
                disabled={updateConfigMutation.isPending}
                sx={{ mb: 2 }}
                inputProps={{ min: 60, max: 3600, step: 60 }}
                onChange={(e) => field.onChange(parseInt(e.target.value, 10))}
                value={field.value || ''}
              />
            )}
          />

          <Controller
            name="enabled"
            control={control}
            render={({ field }) => (
              <FormControlLabel
                control={
                  <Switch
                    checked={field.value}
                    onChange={field.onChange}
                    disabled={updateConfigMutation.isPending}
                    color="primary"
                  />
                }
                label="Включить мониторинг"
                sx={{ color: '#ffffff' }}
              />
            )}
          />
        </DialogContent>

        <DialogActions sx={dialogActionsStyles}>
          <CancelButton onClick={handleClose} disabled={updateConfigMutation.isPending}>
            Отмена
          </CancelButton>
          <StyledButton
            type="submit"
            variant="contained"
            disabled={updateConfigMutation.isPending}
            startIcon={updateConfigMutation.isPending ? <CircularProgress size={LOADING_ICON_SIZE} /> : null}
          >
            Сохранить
          </StyledButton>
        </DialogActions>
      </form>
    </Dialog>
  );
}

export function MessengerConfigsAdminPage() {
  const { data: configs = [], isLoading, error } = useMessengerCheckConfigs();
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const [selectedConfig, setSelectedConfig] = useState<typeof configs[0] | null>(null);

  const handleEdit = (serviceId: string) => {
    const config = configs.find((c) => c.serviceId === serviceId);
    setSelectedServiceId(serviceId);
    setSelectedConfig(config || null);
    setEditDialogOpen(true);
  };

  const handleCloseEditDialog = () => {
    setEditDialogOpen(false);
    setSelectedServiceId(null);
    setSelectedConfig(null);
  };

  const formatInterval = (seconds: number): string => {
    if (seconds < 60) {
      return `${seconds} сек`;
    } else if (seconds < 3600) {
      return `${Math.floor(seconds / 60)} мин`;
    } else {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      return minutes > 0 ? `${hours} ч ${minutes} мин` : `${hours} ч`;
    }
  };

  const errorMessage = error ? 'Не удалось загрузить конфигурации' : null;

  return (
    <Box sx={{ width: '100%' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Typography variant="h4" component="h1" sx={{ color: '#f5f5f5', fontWeight: 500 }}>
          Управление конфигурациями проверки мессенджеров
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
      ) : configs.length === 0 ? (
        <Alert severity="info" sx={{ borderRadius: '12px', backgroundColor: 'rgba(33, 150, 243, 0.1)', color: '#ffffff' }}>
          Конфигурации не найдены. Они будут созданы автоматически при первом запуске приложения.
        </Alert>
      ) : (
        <StyledTableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <StyledTableCell>Мессенджер</StyledTableCell>
                <StyledTableCell align="center">Интервал проверки</StyledTableCell>
                <StyledTableCell align="center">Мониторинг включен</StyledTableCell>
                <StyledTableCell>Обновлено</StyledTableCell>
                <StyledTableCell align="center" sx={{ width: '100px' }}>
                  Действия
                </StyledTableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {configs.map((config) => (
                <StyledTableRow key={config.id}>
                  <StyledTableCell>
                    <Typography sx={{ color: '#ffffff', fontWeight: 500 }}>
                      {config.service.displayName}
                    </Typography>
                  </StyledTableCell>
                  <StyledTableCell align="center" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                    {formatInterval(config.checkIntervalSeconds)}
                  </StyledTableCell>
                  <StyledTableCell align="center">
                    <Switch
                      checked={config.enabled}
                      disabled
                      size="small"
                      sx={{
                        '& .MuiSwitch-switchBase.Mui-checked': {
                          color: '#4caf50',
                        },
                        '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                          backgroundColor: '#4caf50',
                        },
                      }}
                    />
                  </StyledTableCell>
                  <StyledTableCell sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                    {config.updatedAt
                      ? new Date(config.updatedAt).toLocaleString('ru-RU', {
                          year: 'numeric',
                          month: '2-digit',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : '-'}
                  </StyledTableCell>
                  <StyledTableCell align="center">
                    <StyledIconButton
                      size="small"
                      onClick={() => handleEdit(config.serviceId)}
                      aria-label="Редактировать"
                    >
                      <EditIcon fontSize="small" />
                    </StyledIconButton>
                  </StyledTableCell>
                </StyledTableRow>
              ))}
            </TableBody>
          </Table>
        </StyledTableContainer>
      )}

      {/* Диалог редактирования конфигурации */}
      {selectedServiceId && selectedConfig && (
        <EditConfigDialog
          open={editDialogOpen}
          onClose={handleCloseEditDialog}
          serviceId={selectedServiceId}
          serviceName={selectedConfig.service.displayName}
          currentConfig={{
            checkIntervalSeconds: selectedConfig.checkIntervalSeconds,
            enabled: selectedConfig.enabled,
          }}
        />
      )}
    </Box>
  );
}







