import React from 'react';
import { Chip } from '@mui/material';

interface ProfileAvailabilityIndicatorProps {
  status?: string;
  isAvailable?: boolean;
}

export function ProfileAvailabilityIndicator({ status, isAvailable }: ProfileAvailabilityIndicatorProps) {
  const label = status ? status : isAvailable ? 'Доступен' : 'Недоступен';
  const color: 'default' | 'success' | 'warning' | 'error' = isAvailable ? 'success' : 'warning';

  return (
    <Chip
      size="small"
      label={label}
      color={color}
      variant="outlined"
      sx={{ height: 24 }}
    />
  );
}

export default ProfileAvailabilityIndicator;



