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
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
        <Typography variant="subtitle2" sx={{ color: '#f5f5f5', fontWeight: 500 }}>
          Общий прогресс
        </Typography>
        <Typography variant="caption" sx={{ color: '#818cf8', fontWeight: 600 }}>
          {processed} / {total} ({percent}%)
        </Typography>
      </Stack>
      <LinearProgress
        variant="determinate"
        value={percent}
        sx={{
          height: 10,
          borderRadius: '8px',
          backgroundColor: 'rgba(255,255,255,0.1)',
          '& .MuiLinearProgress-bar': { 
            borderRadius: '8px',
            backgroundColor: '#6366f1',
          },
        }}
      />
      <Stack direction="row" spacing={2} sx={{ mt: 1.5 }}>
        <Typography variant="caption" sx={{ color: '#4caf50', fontWeight: 500 }}>Успешно: {success}</Typography>
        <Typography variant="caption" sx={{ color: '#f44336', fontWeight: 500 }}>Ошибки: {failed}</Typography>
        <Typography variant="caption" sx={{ color: '#ff9800', fontWeight: 500 }}>Пропущено: {skipped}</Typography>
      </Stack>
    </Box>
  );
}

export default ProgressBar;




