import React, { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  FormControlLabel,
  Paper,
  Stack,
  Switch,
  Typography,
} from '@mui/material';
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
    <Paper sx={{ p: 3 }}>
      <Stack spacing={2}>
        <Box>
          <Typography variant="h6">Настройки уведомлений</Typography>
          <Typography variant="body2" color="text.secondary">
            Выберите события, о которых нужно уведомлять через Telegram.
          </Typography>
        </Box>

        <Stack direction="row" spacing={3} flexWrap="wrap">
          <FormControlLabel
            control={<Switch checked={form.notifyOnStart} onChange={handleToggle('notifyOnStart')} />}
            label="Старт кампании"
          />
          <FormControlLabel
            control={<Switch checked={form.notifyOnComplete} onChange={handleToggle('notifyOnComplete')} />}
            label="Завершение кампании"
          />
          <FormControlLabel
            control={<Switch checked={form.notifyOnError} onChange={handleToggle('notifyOnError')} />}
            label="Ошибки кампании"
          />
          <FormControlLabel
            control={<Switch checked={form.notifyOnProgress50} onChange={handleToggle('notifyOnProgress50')} />}
            label="Прогресс 50%"
          />
          <FormControlLabel
            control={<Switch checked={form.notifyOnProgress75} onChange={handleToggle('notifyOnProgress75')} />}
            label="Прогресс 75%"
          />
          <FormControlLabel
            control={<Switch checked={form.notifyOnProgress90} onChange={handleToggle('notifyOnProgress90')} />}
            label="Прогресс 90%"
          />
          <FormControlLabel
            control={<Switch checked={form.notifyOnProfileIssue} onChange={handleToggle('notifyOnProfileIssue')} />}
            label="Проблемы профилей"
          />
          <FormControlLabel
            control={<Switch checked={form.notifyOnLoginRequired} onChange={handleToggle('notifyOnLoginRequired')} />}
            label="Требуется вход"
          />
        </Stack>

        <Button variant="contained" onClick={handleSave} disabled={mutation.isPending}>
          Сохранить
        </Button>

        {mutation.isSuccess && <Alert severity="success">Настройки сохранены.</Alert>}
        {mutation.error && (
          <Alert severity="error">{mutation.error.message || 'Ошибка при сохранении настроек'}</Alert>
        )}
      </Stack>
    </Paper>
  );
};


