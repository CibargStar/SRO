import React from 'react';
import { Button, CircularProgress, Alert } from '@mui/material';
import { useTestTelegramBot } from '@/hooks';

export const TelegramTestButton: React.FC = () => {
  const mutation = useTestTelegramBot();

  const handleClick = () => {
    mutation.mutate();
  };

  return (
    <>
      <Button variant="outlined" onClick={handleClick} disabled={mutation.isPending}>
        {mutation.isPending ? <CircularProgress size={20} /> : 'Отправить тестовое уведомление'}
      </Button>
      {mutation.isSuccess && <Alert severity="success" sx={{ mt: 2 }}>Тестовое уведомление отправлено.</Alert>}
      {mutation.error && (
        <Alert severity="error" sx={{ mt: 2 }}>{mutation.error.message || 'Не удалось отправить уведомление'}</Alert>
      )}
    </>
  );
};


