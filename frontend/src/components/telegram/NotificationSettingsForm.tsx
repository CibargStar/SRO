import React, { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  FormControlLabel,
  Paper,
  Stack,
  Switch,
  Typography,
  CircularProgress,
} from '@mui/material';
import { StyledButton } from '@/components/common';
import { LOADING_ICON_SIZE } from '@/components/common/Constants';
import type { TelegramBotSettings, UpdateTelegramNotificationsInput } from '@/types';
import { useUpdateTelegramNotifications } from '@/hooks';

interface Props {
  settings?: TelegramBotSettings;
}

export const NotificationSettingsForm: React.FC<Props> = ({ settings }) => {
  const [form, setForm] = useState<UpdateTelegramNotificationsInput>({
    notifyOnStart: false,
    notifyOnComplete: true,
    notifyOnError: true,
    notifyOnProgress50: false,
    notifyOnProgress75: true,
    notifyOnProgress90: true,
    notifyOnProfileIssue: true,
    notifyOnLoginRequired: true,
  });

  const mutation = useUpdateTelegramNotifications();

  useEffect(() => {
    if (settings) {
      setForm({
        notifyOnStart: settings.notifyOnStart ?? false,
        notifyOnComplete: settings.notifyOnComplete ?? true,
        notifyOnError: settings.notifyOnError ?? true,
        notifyOnProgress50: settings.notifyOnProgress50 ?? false,
        notifyOnProgress75: settings.notifyOnProgress75 ?? true,
        notifyOnProgress90: settings.notifyOnProgress90 ?? true,
        notifyOnProfileIssue: settings.notifyOnProfileIssue ?? true,
        notifyOnLoginRequired: settings.notifyOnLoginRequired ?? true,
      });
    }
  }, [settings]);

  const handleToggle = (key: keyof UpdateTelegramNotificationsInput) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [key]: e.target.checked }));
  };

  const handleSave = () => {
    mutation.mutate(form);
  };

  return (
    <Paper sx={{ p: 3.5, backgroundColor: 'rgba(255, 255, 255, 0.06)', borderRadius: '16px', border: 'none' }}>
      <Stack spacing={3}>
        <Box>
          <Typography variant="h6" sx={{ color: '#f5f5f5', fontWeight: 500, mb: 1 }}>
            Настройки уведомлений
          </Typography>
          <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
            Выберите события, о которых нужно уведомлять через Telegram.
          </Typography>
        </Box>

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' },
            gap: 2,
          }}
        >
          <FormControlLabel
            control={
              <Switch 
                checked={form.notifyOnStart} 
                onChange={handleToggle('notifyOnStart')}
                sx={{
                  '& .MuiSwitch-switchBase.Mui-checked': {
                    color: '#6366f1',
                  },
                  '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                    backgroundColor: '#6366f1',
                  },
                }}
              />
            }
            label={<Typography sx={{ color: '#f5f5f5', fontSize: '0.9rem' }}>Старт кампании</Typography>}
          />
          <FormControlLabel
            control={
              <Switch 
                checked={form.notifyOnComplete} 
                onChange={handleToggle('notifyOnComplete')}
                sx={{
                  '& .MuiSwitch-switchBase.Mui-checked': {
                    color: '#6366f1',
                  },
                  '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                    backgroundColor: '#6366f1',
                  },
                }}
              />
            }
            label={<Typography sx={{ color: '#f5f5f5', fontSize: '0.9rem' }}>Завершение кампании</Typography>}
          />
          <FormControlLabel
            control={
              <Switch 
                checked={form.notifyOnError} 
                onChange={handleToggle('notifyOnError')}
                sx={{
                  '& .MuiSwitch-switchBase.Mui-checked': {
                    color: '#6366f1',
                  },
                  '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                    backgroundColor: '#6366f1',
                  },
                }}
              />
            }
            label={<Typography sx={{ color: '#f5f5f5', fontSize: '0.9rem' }}>Ошибки кампании</Typography>}
          />
          <FormControlLabel
            control={
              <Switch 
                checked={form.notifyOnProgress50} 
                onChange={handleToggle('notifyOnProgress50')}
                sx={{
                  '& .MuiSwitch-switchBase.Mui-checked': {
                    color: '#6366f1',
                  },
                  '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                    backgroundColor: '#6366f1',
                  },
                }}
              />
            }
            label={<Typography sx={{ color: '#f5f5f5', fontSize: '0.9rem' }}>Прогресс 50%</Typography>}
          />
          <FormControlLabel
            control={
              <Switch 
                checked={form.notifyOnProgress75} 
                onChange={handleToggle('notifyOnProgress75')}
                sx={{
                  '& .MuiSwitch-switchBase.Mui-checked': {
                    color: '#6366f1',
                  },
                  '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                    backgroundColor: '#6366f1',
                  },
                }}
              />
            }
            label={<Typography sx={{ color: '#f5f5f5', fontSize: '0.9rem' }}>Прогресс 75%</Typography>}
          />
          <FormControlLabel
            control={
              <Switch 
                checked={form.notifyOnProgress90} 
                onChange={handleToggle('notifyOnProgress90')}
                sx={{
                  '& .MuiSwitch-switchBase.Mui-checked': {
                    color: '#6366f1',
                  },
                  '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                    backgroundColor: '#6366f1',
                  },
                }}
              />
            }
            label={<Typography sx={{ color: '#f5f5f5', fontSize: '0.9rem' }}>Прогресс 90%</Typography>}
          />
          <FormControlLabel
            control={
              <Switch 
                checked={form.notifyOnProfileIssue} 
                onChange={handleToggle('notifyOnProfileIssue')}
                sx={{
                  '& .MuiSwitch-switchBase.Mui-checked': {
                    color: '#6366f1',
                  },
                  '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                    backgroundColor: '#6366f1',
                  },
                }}
              />
            }
            label={<Typography sx={{ color: '#f5f5f5', fontSize: '0.9rem' }}>Проблемы профилей</Typography>}
          />
          <FormControlLabel
            control={
              <Switch 
                checked={form.notifyOnLoginRequired} 
                onChange={handleToggle('notifyOnLoginRequired')}
                sx={{
                  '& .MuiSwitch-switchBase.Mui-checked': {
                    color: '#6366f1',
                  },
                  '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                    backgroundColor: '#6366f1',
                  },
                }}
              />
            }
            label={<Typography sx={{ color: '#f5f5f5', fontSize: '0.9rem' }}>Требуется вход</Typography>}
          />
        </Box>

        <Box>
          <StyledButton onClick={handleSave} disabled={mutation.isPending} sx={{ minWidth: 140 }}>
            {mutation.isPending ? (
              <CircularProgress size={LOADING_ICON_SIZE} color="inherit" />
            ) : (
              'Сохранить'
            )}
          </StyledButton>
        </Box>

        {mutation.isSuccess && (
          <Alert 
            severity="success"
            sx={{
              borderRadius: '12px',
              backgroundColor: 'rgba(76, 175, 80, 0.15)',
              color: '#4caf50',
              border: '1px solid rgba(76, 175, 80, 0.3)',
            }}
          >
            Настройки сохранены.
          </Alert>
        )}
        {mutation.error && (
          <Alert 
            severity="error"
            sx={{
              borderRadius: '12px',
              backgroundColor: 'rgba(244, 67, 54, 0.1)',
              color: '#f44336',
              border: '1px solid rgba(244, 67, 54, 0.2)',
            }}
          >
            {mutation.error.message || 'Ошибка при сохранении настроек'}
          </Alert>
        )}
      </Stack>
    </Paper>
  );
};



