import React from 'react';
import { Stack, Typography, Chip } from '@mui/material';

interface SpeedIndicatorProps {
  contactsPerMinute: number;
}

export function SpeedIndicator({ contactsPerMinute }: SpeedIndicatorProps) {
  return (
    <Stack spacing={0.5}>
      <Typography variant="subtitle2" sx={{ color: '#f5f5f5', fontWeight: 500 }}>
        Скорость
      </Typography>
      <Chip
        label={`${contactsPerMinute.toFixed(1)} контактов/мин`}
        sx={{ 
          backgroundColor: 'rgba(99,102,241,0.2)', 
          color: '#818cf8',
          border: '1px solid rgba(99,102,241,0.4)',
        }}
      />
    </Stack>
  );
}

export default SpeedIndicator;




