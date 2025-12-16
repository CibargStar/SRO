import React, { useEffect, useState } from 'react';
import { Box, Paper, Stack, Typography, Alert } from '@mui/material';
import { StyledTextField, StyledButton, CancelButton } from '@/components/common';
import { useSetupTelegramBot, useDisconnectTelegramBot } from '@/hooks';
import { LOADING_ICON_SIZE } from '@/components/common/Constants';
import { CircularProgress } from '@mui/material';

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
    <Paper sx={{ p: 3.5, backgroundColor: 'rgba(255, 255, 255, 0.06)', borderRadius: '16px', border: 'none' }}>
      <Stack spacing={2.5}>
        <Box>
          <Typography variant="h6" sx={{ color: '#f5f5f5', fontWeight: 500, mb: 1 }}>
            Подключение бота
          </Typography>
          <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
            Введите токен вашего Telegram бота и подтвердите его, отправив код /verify.
          </Typography>
        </Box>

        {isVerified ? (
          <Alert 
            severity="success"
            sx={{
              borderRadius: '12px',
              backgroundColor: 'rgba(76, 175, 80, 0.15)',
              color: '#4caf50',
              border: '1px solid rgba(76, 175, 80, 0.3)',
            }}
          >
            Бот подтверждён. Chat ID: <strong>{chatId ?? '—'}</strong>
          </Alert>
        ) : (
          <Alert 
            severity="warning"
            sx={{
              borderRadius: '12px',
              backgroundColor: 'rgba(255, 152, 0, 0.15)',
              color: '#ff9800',
              border: '1px solid rgba(255, 152, 0, 0.3)',
            }}
          >
            Бот не подтверждён. Сохраните токен и выполните верификацию.
          </Alert>
        )}

        <StyledTextField
          label="Bot Token"
          fullWidth
          value={botToken}
          onChange={(e) => setBotToken(e.target.value)}
          placeholder="Введите токен @BotFather"
          disabled={setupMutation.isPending}
        />

        <Stack direction="row" spacing={2}>
          <StyledButton onClick={handleSetup} disabled={!botToken || setupMutation.isPending}>
            {setupMutation.isPending ? (
              <CircularProgress size={LOADING_ICON_SIZE} color="inherit" />
            ) : (
              'Сохранить токен'
            )}
          </StyledButton>
          <CancelButton
            onClick={handleDisconnect}
            disabled={disconnectMutation.isPending}
            sx={{
              borderColor: 'rgba(244, 67, 54, 0.5)',
              color: '#f44336',
              '&:hover': {
                borderColor: '#f44336',
                backgroundColor: 'rgba(244, 67, 54, 0.1)',
              },
            }}
          >
            {disconnectMutation.isPending ? (
              <CircularProgress size={LOADING_ICON_SIZE} color="inherit" />
            ) : (
              'Отключить бота'
            )}
          </CancelButton>
        </Stack>

        {setupMutation.error && (
          <Alert 
            severity="error"
            sx={{
              borderRadius: '12px',
              backgroundColor: 'rgba(244, 67, 54, 0.1)',
              color: '#f44336',
              border: '1px solid rgba(244, 67, 54, 0.2)',
            }}
          >
            {setupMutation.error.message || 'Ошибка при сохранении токена'}
          </Alert>
        )}
        {disconnectMutation.error && (
          <Alert 
            severity="error"
            sx={{
              borderRadius: '12px',
              backgroundColor: 'rgba(244, 67, 54, 0.1)',
              color: '#f44336',
              border: '1px solid rgba(244, 67, 54, 0.2)',
            }}
          >
            {disconnectMutation.error.message || 'Ошибка при отключении бота'}
          </Alert>
        )}
      </Stack>
    </Paper>
  );
};



