/**
 * Бейдж типа кампании
 * 
 * Отображает тип кампании (ONE_TIME или SCHEDULED).
 */

import React from 'react';
import { Chip, type ChipProps } from '@mui/material';
import {
  FlashOn as OneTimeIcon,
  Schedule as ScheduledIcon,
} from '@mui/icons-material';
import type { CampaignType } from '@/types/campaign';
import { CAMPAIGN_TYPE_LABELS } from '@/types/campaign';

interface CampaignTypeBadgeProps extends Omit<ChipProps, 'color' | 'label' | 'icon'> {
  type: CampaignType;
  showIcon?: boolean;
}

const TYPE_ICONS: Record<CampaignType, React.ReactElement> = {
  ONE_TIME: <FlashOn fontSize="small" />,
  SCHEDULED: <ScheduledIcon fontSize="small" />,
};

const TYPE_COLORS: Record<CampaignType, ChipProps['color']> = {
  ONE_TIME: 'default',
  SCHEDULED: 'info',
};

export function CampaignTypeBadge({
  type,
  showIcon = true,
  size = 'small',
  ...props
}: CampaignTypeBadgeProps) {
  return (
    <Chip
      label={CAMPAIGN_TYPE_LABELS[type]}
      color={TYPE_COLORS[type]}
      icon={showIcon ? TYPE_ICONS[type] : undefined}
      size={size}
      variant="outlined"
      {...props}
    />
  );
}


