/**
 * Бейдж статуса сообщения кампании
 * 
 * Отображает статус конкретного сообщения (PENDING, SENT, FAILED и т.д.).
 */

import React from 'react';
import { Chip, type ChipProps } from '@mui/material';
import {
  Schedule as PendingIcon,
  Sync as ProcessingIcon,
  CheckCircle as SentIcon,
  Error as FailedIcon,
  SkipNext as SkippedIcon,
} from '@mui/icons-material';
import type { MessageStatus } from '@/types/campaign';
import { MESSAGE_STATUS_LABELS, MESSAGE_STATUS_COLORS } from '@/types/campaign';

interface MessageStatusBadgeProps extends Omit<ChipProps, 'color' | 'label' | 'icon'> {
  status: MessageStatus;
  showIcon?: boolean;
}

const STATUS_ICONS: Record<MessageStatus, React.ReactElement> = {
  PENDING: <PendingIcon fontSize="small" />,
  PROCESSING: <ProcessingIcon fontSize="small" />,
  SENT: <SentIcon fontSize="small" />,
  FAILED: <FailedIcon fontSize="small" />,
  SKIPPED: <SkippedIcon fontSize="small" />,
};

export function MessageStatusBadge({
  status,
  showIcon = true,
  size = 'small',
  ...props
}: MessageStatusBadgeProps) {
  return (
    <Chip
      label={MESSAGE_STATUS_LABELS[status]}
      color={MESSAGE_STATUS_COLORS[status]}
      icon={showIcon ? STATUS_ICONS[status] : undefined}
      size={size}
      {...props}
    />
  );
}




