import React from 'react';
import { Stack, Typography, Chip } from '@mui/material';

interface SpeedIndicatorProps {
  contactsPerMinute: number;
}

export function SpeedIndicator({ contactsPerMinute }: SpeedIndicatorProps) {
  return (
    <Stack spacing={0.5}>
      <Typography variant="subtitle2" sx={{ color: '#fff' }}>
        Скорость
      </Typography>
      <Chip
        label={`${contactsPerMinute.toFixed(1)} контактов/мин`}
        sx={{ backgroundColor: 'rgba(99,102,241,0.15)', color: '#cdd2ff' }}
      />
    </Stack>
  );
}

export default SpeedIndicator;



