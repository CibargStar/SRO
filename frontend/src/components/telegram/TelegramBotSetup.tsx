import React, { useEffect, useState } from 'react';
import { Box, Button, Paper, Stack, TextField, Typography, Alert } from '@mui/material';
import { useSetupTelegramBot, useDisconnectTelegramBot } from '@/hooks';

interface Props {
  isVerified: boolean;
  chatId: string | null;
  onVerifyCodeReceived?: (code?: string) => void;
}

export const TelegramBotSetup: React.FC<Props> = ({ isVerified, chatId, onVerifyCodeReceived }) => {
  const [botToken, setBotToken] = useState('');
  const setupMutation = useSetupTelegramBot();
  const disconnectMutation = useDisconnectTelegramBot();

  useEffect(() => {
    if (setupMutation.data?.verifyCode) {
      onVerifyCodeReceived?.(setupMutation.data.verifyCode);
    }
  }, [setupMutation.data, onVerifyCodeReceived]);

  const handleSetup = () => {
    setupMutation.mutate({ botToken });
  };

  const handleDisconnect = () => {
    disconnectMutation.mutate();
  };

  return (
    <Paper sx={{ p: 3 }}>
      <Stack spacing={2}>
        <Box>
          <Typography variant="h6">Подключение бота</Typography>
          <Typography variant="body2" color="text.secondary">
            Введите токен вашего Telegram бота и подтвердите его, отправив код /verify.
          </Typography>
        </Box>

        {isVerified ? (
          <Alert severity="success">
            Бот подтверждён. Chat ID: <strong>{chatId ?? '—'}</strong>
          </Alert>
        ) : (
          <Alert severity="warning">Бот не подтверждён. Сохраните токен и выполните верификацию.</Alert>
        )}

        <TextField
          label="Bot Token"
          fullWidth
          value={botToken}
          onChange={(e) => setBotToken(e.target.value)}
          placeholder="Введите токен @BotFather"
          disabled={setupMutation.isPending}
        />

        <Stack direction="row" spacing={2}>
          <Button variant="contained" onClick={handleSetup} disabled={!botToken || setupMutation.isPending}>
            Сохранить токен
          </Button>
          <Button
            variant="outlined"
            color="error"
            onClick={handleDisconnect}
            disabled={disconnectMutation.isPending}
          >
            Отключить бота
          </Button>
        </Stack>

        {setupMutation.error && (
          <Alert severity="error">{setupMutation.error.message || 'Ошибка при сохранении токена'}</Alert>
        )}
        {disconnectMutation.error && (
          <Alert severity="error">{disconnectMutation.error.message || 'Ошибка при отключении бота'}</Alert>
        )}
      </Stack>
    </Paper>
  );
};


