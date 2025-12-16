/**
 * Бейдж статуса кампании
 * 
 * Отображает текущий статус кампании с соответствующим цветом.
 */

import React from 'react';
import { Chip, type ChipProps } from '@mui/material';
import {
  PlayArrow as RunningIcon,
  Pause as PausedIcon,
  CheckCircle as CompletedIcon,
  Cancel as CancelledIcon,
  Error as ErrorIcon,
  Schedule as ScheduledIcon,
  Drafts as DraftIcon,
  HourglassEmpty as QueuedIcon,
} from '@mui/icons-material';
import type { CampaignStatus } from '@/types/campaign';
import { CAMPAIGN_STATUS_LABELS, CAMPAIGN_STATUS_COLORS } from '@/types/campaign';

interface CampaignStatusBadgeProps extends Omit<ChipProps, 'color' | 'label' | 'icon'> {
  status: CampaignStatus;
  showIcon?: boolean;
}

const STATUS_ICONS: Record<CampaignStatus, React.ReactElement | undefined> = {
  DRAFT: <DraftIcon fontSize="small" />,
  SCHEDULED: <ScheduledIcon fontSize="small" />,
  QUEUED: <QueuedIcon fontSize="small" />,
  RUNNING: <RunningIcon fontSize="small" />,
  PAUSED: <PausedIcon fontSize="small" />,
  COMPLETED: <CompletedIcon fontSize="small" />,
  CANCELLED: <CancelledIcon fontSize="small" />,
  ERROR: <ErrorIcon fontSize="small" />,
};

export function CampaignStatusBadge({
  status,
  showIcon = true,
  size = 'small',
  ...props
}: CampaignStatusBadgeProps) {
  return (
    <Chip
      label={CAMPAIGN_STATUS_LABELS[status]}
      color={CAMPAIGN_STATUS_COLORS[status]}
      icon={showIcon ? STATUS_ICONS[status] : undefined}
      size={size}
      {...props}
    />
  );
}




