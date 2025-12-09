/**
 * Бейдж уровня лога
 * 
 * Отображает уровень логирования события кампании.
 */

import React from 'react';
import { Chip, type ChipProps } from '@mui/material';
import {
  Info as InfoIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
} from '@mui/icons-material';
import type { LogLevel } from '@/types/campaign';
import { LOG_LEVEL_LABELS, LOG_LEVEL_COLORS } from '@/types/campaign';

interface LogLevelBadgeProps extends Omit<ChipProps, 'color' | 'label' | 'icon'> {
  level: LogLevel;
  showIcon?: boolean;
}

const LEVEL_ICONS: Record<LogLevel, React.ReactElement> = {
  INFO: <InfoIcon fontSize="small" />,
  WARNING: <WarningIcon fontSize="small" />,
  ERROR: <ErrorIcon fontSize="small" />,
};

export function LogLevelBadge({
  level,
  showIcon = true,
  size = 'small',
  ...props
}: LogLevelBadgeProps) {
  return (
    <Chip
      label={LOG_LEVEL_LABELS[level]}
      color={LOG_LEVEL_COLORS[level]}
      icon={showIcon ? LEVEL_ICONS[level] : undefined}
      size={size}
      {...props}
    />
  );
}


