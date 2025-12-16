/**
 * Предупреждение о большом размере файла.
 */

import React from 'react';
import { Alert, Box, Typography } from '@mui/material';

interface FileSizeWarningProps {
  size: number;
  threshold: number;
}

function formatSize(bytes: number) {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} ГБ`;
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
  return `${bytes} Б`;
}

export function FileSizeWarning({ size, threshold }: FileSizeWarningProps) {
  return (
    <Alert
      severity="warning"
      variant="outlined"
      sx={{
        borderColor: 'rgba(255, 183, 77, 0.4)',
        backgroundColor: 'rgba(255, 183, 77, 0.08)',
        color: '#ffb74d',
        mt: 1,
      }}
    >
      <Box>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          Крупный файл
        </Typography>
        <Typography variant="caption" sx={{ opacity: 0.85 }}>
          Размер: {formatSize(size)} — отправка может занять больше времени.
        </Typography>
      </Box>
    </Alert>
  );
}

export default FileSizeWarning;





