import React from 'react';
import { CircularProgress, Alert, Stack } from '@mui/material';
import { StyledButton } from '@/components/common';
import { useTestTelegramBot } from '@/hooks';
import { LOADING_ICON_SIZE } from '@/components/common/Constants';

export const TelegramTestButton: React.FC = () => {
  const mutation = useTestTelegramBot();

  const handleClick = () => {
    mutation.mutate();
  };

  return (
    <Stack spacing={2}>
      <StyledButton onClick={handleClick} disabled={mutation.isPending} fullWidth>
        {mutation.isPending ? (
          <CircularProgress size={LOADING_ICON_SIZE} color="inherit" />
        ) : (
          'Отправить тестовое уведомление'
        )}
      </StyledButton>
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
          Тестовое уведомление отправлено.
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
          {mutation.error.message || 'Не удалось отправить уведомление'}
        </Alert>
      )}
    </Stack>
  );
};



