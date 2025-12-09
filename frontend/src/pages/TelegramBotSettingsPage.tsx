import React, { useMemo, useState } from 'react';
import { Box, Grid, Typography, Alert, CircularProgress } from '@mui/material';
import { useTelegramBotSettings } from '@/hooks';
import { TelegramBotSetup } from '@/components/telegram/TelegramBotSetup';
import { TelegramVerifySection } from '@/components/telegram/TelegramVerifySection';
import { NotificationSettingsForm } from '@/components/telegram/NotificationSettingsForm';
import { TelegramTestButton } from '@/components/telegram/TelegramTestButton';

export function TelegramBotSettingsPage() {
  const { data, isLoading, error } = useTelegramBotSettings();
  const [lastVerifyCode, setLastVerifyCode] = useState<string | undefined>();

  const statusBlock = useMemo(() => {
    if (isLoading) {
      return (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '30vh' }}>
          <CircularProgress />
        </Box>
      );
    }
    if (error) {
      return <Alert severity="error">Ошибка загрузки настроек: {error.message}</Alert>;
    }
    return null;
  }, [isLoading, error]);

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Telegram уведомления
      </Typography>
      <Typography variant="body1" color="text.secondary" gutterBottom>
        Подключите личного Telegram бота, подтвердите его и настройте события, которые нужно получать.
      </Typography>

      {statusBlock}

      {!isLoading && !error && (
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <TelegramBotSetup
              isVerified={data?.isVerified ?? false}
              chatId={data?.chatId ?? null}
              onVerifyCodeReceived={setLastVerifyCode}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TelegramVerifySection lastVerifyCode={lastVerifyCode} />
          </Grid>
          <Grid item xs={12} md={8}>
            <NotificationSettingsForm settings={data} />
          </Grid>
          <Grid item xs={12} md={4}>
            <Box sx={{ p: 3, borderRadius: 1, border: '1px solid', borderColor: 'divider', height: '100%' }}>
              <Typography variant="h6" gutterBottom>
                Тест уведомлений
              </Typography>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Отправьте тестовое сообщение, чтобы убедиться, что бот настроен корректно.
              </Typography>
              <TelegramTestButton />
            </Box>
          </Grid>
        </Grid>
      )}
    </Box>
  );
}


