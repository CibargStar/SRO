import React, { useState } from 'react';
import { Paper, Stack, Typography, Alert, Box } from '@mui/material';
import { StyledTextField, StyledButton } from '@/components/common';
import { useVerifyTelegramBot } from '@/hooks';
import { LOADING_ICON_SIZE } from '@/components/common/Constants';
import { CircularProgress } from '@mui/material';

interface Props {
  lastVerifyCode?: string;
}

export const TelegramVerifySection: React.FC<Props> = ({ lastVerifyCode }) => {
  const [code, setCode] = useState('');
  const verifyMutation = useVerifyTelegramBot();

  const handleVerify = () => {
    verifyMutation.mutate({ code });
  };

  return (
    <Paper sx={{ p: 3.5, backgroundColor: 'rgba(255, 255, 255, 0.06)', borderRadius: '16px', border: 'none' }}>
      <Stack spacing={2.5}>
        <Box>
          <Typography variant="h6" sx={{ color: '#f5f5f5', fontWeight: 500, mb: 1 }}>
            Верификация
          </Typography>
          <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
            Отправьте команду <Box component="code" sx={{ backgroundColor: 'rgba(255, 255, 255, 0.1)', px: 0.5, borderRadius: '4px', fontFamily: 'monospace' }}>/verify {'<код>'}</Box> вашему боту в Telegram. Код также можно ввести ниже для проверки на стороне сервера.
          </Typography>
        </Box>

        {lastVerifyCode && (
          <Alert 
            severity="info"
            sx={{
              borderRadius: '12px',
              backgroundColor: 'rgba(33, 150, 243, 0.15)',
              color: '#2196f3',
              border: '1px solid rgba(33, 150, 243, 0.3)',
            }}
          >
            Ваш код верификации: <strong>{lastVerifyCode}</strong>
          </Alert>
        )}

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <StyledTextField
            label="Код верификации"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            inputProps={{ maxLength: 6 }}
            sx={{ flex: 1 }}
          />
          <StyledButton onClick={handleVerify} disabled={!code || verifyMutation.isPending}>
            {verifyMutation.isPending ? (
              <CircularProgress size={LOADING_ICON_SIZE} color="inherit" />
            ) : (
              'Проверить код'
            )}
          </StyledButton>
        </Stack>

        {verifyMutation.isSuccess && (
          <Alert 
            severity="success"
            sx={{
              borderRadius: '12px',
              backgroundColor: 'rgba(76, 175, 80, 0.15)',
              color: '#4caf50',
              border: '1px solid rgba(76, 175, 80, 0.3)',
            }}
          >
            Бот успешно подтверждён.
          </Alert>
        )}
        {verifyMutation.error && (
          <Alert 
            severity="error"
            sx={{
              borderRadius: '12px',
              backgroundColor: 'rgba(244, 67, 54, 0.1)',
              color: '#f44336',
              border: '1px solid rgba(244, 67, 54, 0.2)',
            }}
          >
            {verifyMutation.error.message || 'Ошибка проверки кода'}
          </Alert>
        )}
      </Stack>
    </Paper>
  );
};



