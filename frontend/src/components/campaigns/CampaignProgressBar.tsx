/**
 * Прогресс-бар кампании
 * 
 * Отображает прогресс выполнения кампании с процентами и статистикой.
 */

import React from 'react';
import {
  Box,
  LinearProgress,
  Typography,
  Stack,
  Paper,
} from '@mui/material';
import type { CampaignProgress } from '@/types/campaign';

interface CampaignProgressBarProps {
  progress?: CampaignProgress | null;
  showDetails?: boolean;
}

/**
 * Форматирование времени в человекочитаемый формат
 */
function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${Math.round(seconds)} сек`;
  }
  if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.round(seconds % 60);
    return `${minutes} мин ${remainingSeconds} сек`;
  }
  const hours = Math.floor(seconds / 3600);
  const remainingMinutes = Math.floor((seconds % 3600) / 60);
  return `${hours} ч ${remainingMinutes} мин`;
}

export function CampaignProgressBar({
  progress,
  showDetails = true,
}: CampaignProgressBarProps) {
  // Значения по умолчанию, если progress не передан
  const {
    totalContacts = 0,
    processedContacts = 0,
    successfulContacts = 0,
    failedContacts = 0,
    skippedContacts = 0,
    progressPercent = 0,
    contactsPerMinute = 0,
    estimatedSecondsRemaining = null,
  } = progress || {};

  return (
    <Box>
      {/* Основной прогресс-бар */}
      <Box sx={{ mb: 1 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
          <Typography variant="body2" color="text.secondary">
            Прогресс выполнения
          </Typography>
          <Typography variant="body2" fontWeight="medium">
            {progressPercent.toFixed(1)}%
          </Typography>
        </Box>
        <LinearProgress
          variant="determinate"
          value={progressPercent}
          sx={{
            height: 12,
            borderRadius: 1,
            backgroundColor: 'grey.200',
            '& .MuiLinearProgress-bar': {
              borderRadius: 1,
            },
          }}
        />
        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
          {processedContacts} из {totalContacts} контактов обработано
        </Typography>
      </Box>

      {/* Детали */}
      {showDetails && (
        <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
          {/* Успешно */}
          <Paper
            variant="outlined"
            sx={{
              p: 1.5,
              flex: 1,
              textAlign: 'center',
              borderColor: 'success.main',
              bgcolor: 'success.50',
            }}
          >
            <Typography variant="h6" color="success.main" fontWeight="bold">
              {successfulContacts}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Успешно
            </Typography>
          </Paper>

          {/* Ошибки */}
          <Paper
            variant="outlined"
            sx={{
              p: 1.5,
              flex: 1,
              textAlign: 'center',
              borderColor: 'error.main',
              bgcolor: 'error.50',
            }}
          >
            <Typography variant="h6" color="error.main" fontWeight="bold">
              {failedContacts}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Ошибки
            </Typography>
          </Paper>

          {/* Пропущено */}
          <Paper
            variant="outlined"
            sx={{
              p: 1.5,
              flex: 1,
              textAlign: 'center',
              borderColor: 'warning.main',
              bgcolor: 'warning.50',
            }}
          >
            <Typography variant="h6" color="warning.main" fontWeight="bold">
              {skippedContacts}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Пропущено
            </Typography>
          </Paper>

          {/* Скорость */}
          <Paper
            variant="outlined"
            sx={{
              p: 1.5,
              flex: 1,
              textAlign: 'center',
              borderColor: 'info.main',
              bgcolor: 'info.50',
            }}
          >
            <Typography variant="h6" color="info.main" fontWeight="bold">
              {contactsPerMinute.toFixed(1)}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              контактов/мин
            </Typography>
          </Paper>
        </Stack>
      )}

      {/* ETA */}
      {estimatedSecondsRemaining !== null && estimatedSecondsRemaining > 0 && (
        <Box sx={{ mt: 2, textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            Примерное время до завершения:{' '}
            <Typography component="span" fontWeight="medium" color="text.primary">
              {formatDuration(estimatedSecondsRemaining)}
            </Typography>
          </Typography>
        </Box>
      )}
    </Box>
  );
}



