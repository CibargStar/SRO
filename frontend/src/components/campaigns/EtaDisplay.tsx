import React from 'react';
import { Box, Typography, Chip, Stack } from '@mui/material';

interface EtaDisplayProps {
  estimatedSecondsRemaining: number | null;
  estimatedCompletionTime: string | null;
  startedAt: string | null;
}

function formatDuration(seconds: number) {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (hrs > 0) return `${hrs}ч ${mins}м`;
  if (mins > 0) return `${mins}м`;
  return '<1м';
}

function formatTime(iso: string | null) {
  if (!iso) return '—';
  const dt = new Date(iso);
  return dt.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

export function EtaDisplay({ estimatedSecondsRemaining, estimatedCompletionTime, startedAt }: EtaDisplayProps) {
  return (
    <Stack spacing={0.5}>
      <Typography variant="subtitle2" sx={{ color: '#fff' }}>
        ETA
      </Typography>
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        <Chip
          label={`Осталось: ${estimatedSecondsRemaining != null ? formatDuration(estimatedSecondsRemaining) : '—'}`}
          sx={{ backgroundColor: 'rgba(255,255,255,0.08)', color: '#fff' }}
        />
        <Chip
          label={`Окончание: ${formatTime(estimatedCompletionTime)}`}
          sx={{ backgroundColor: 'rgba(255,255,255,0.08)', color: '#fff' }}
        />
        <Chip
          label={`Старт: ${formatTime(startedAt)}`}
          sx={{ backgroundColor: 'rgba(255,255,255,0.08)', color: '#fff' }}
        />
      </Box>
    </Stack>
  );
}

export default EtaDisplay;



