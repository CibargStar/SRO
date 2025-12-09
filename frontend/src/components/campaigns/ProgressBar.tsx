import React from 'react';
import { Box, LinearProgress, Stack, Typography } from '@mui/material';

interface ProgressBarProps {
  total: number;
  processed: number;
  success: number;
  failed: number;
  skipped: number;
}

export function ProgressBar({ total, processed, success, failed, skipped }: ProgressBarProps) {
  const percent = total > 0 ? Math.min(100, Math.round((processed / total) * 100)) : 0;

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.75 }}>
        <Typography variant="subtitle2" sx={{ color: '#fff' }}>
          Общий прогресс
        </Typography>
        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)' }}>
          {processed} / {total} ({percent}%)
        </Typography>
      </Stack>
      <LinearProgress
        variant="determinate"
        value={percent}
        sx={{
          height: 10,
          borderRadius: 1,
          backgroundColor: 'rgba(255,255,255,0.08)',
          '& .MuiLinearProgress-bar': { borderRadius: 1 },
        }}
      />
      <Stack direction="row" spacing={2} sx={{ mt: 1 }}>
        <Typography variant="caption" sx={{ color: '#4caf50' }}>Успешно: {success}</Typography>
        <Typography variant="caption" sx={{ color: '#f44336' }}>Ошибки: {failed}</Typography>
        <Typography variant="caption" sx={{ color: '#ffb74d' }}>Пропущено: {skipped}</Typography>
      </Stack>
    </Box>
  );
}

export default ProgressBar;



