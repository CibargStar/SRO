import React, { useState } from 'react';
import { Paper, Stack, Typography, TextField, Button, Alert } from '@mui/material';
import { useVerifyTelegramBot } from '@/hooks';

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
    <Paper sx={{ p: 3 }}>
      <Stack spacing={2}>
        <Typography variant="h6">Верификация</Typography>
        <Typography variant="body2" color="text.secondary">
          Отправьте команду <code>/verify {'<код>'}</code> вашему боту в Telegram. Код также можно ввести ниже для
          проверки на стороне сервера.
        </Typography>

        {lastVerifyCode && (
          <Alert severity="info">Ваш код верификации: <strong>{lastVerifyCode}</strong></Alert>
        )}

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <TextField
            label="Код верификации"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            inputProps={{ maxLength: 6 }}
          />
          <Button variant="contained" onClick={handleVerify} disabled={!code || verifyMutation.isPending}>
            Проверить код
          </Button>
        </Stack>

        {verifyMutation.isSuccess && <Alert severity="success">Бот успешно подтверждён.</Alert>}
        {verifyMutation.error && (
          <Alert severity="error">{verifyMutation.error.message || 'Ошибка проверки кода'}</Alert>
        )}
      </Stack>
    </Paper>
  );
};


