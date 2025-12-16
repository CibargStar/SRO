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
  ONE_TIME: <OneTimeIcon fontSize="small" />,
  SCHEDULED: <ScheduledIcon fontSize="small" />,
};

const TYPE_STYLES: Record<CampaignType, { bgColor: string; color: string; borderColor: string }> = {
  ONE_TIME: {
    bgColor: 'rgba(99, 102, 241, 0.2)',
    color: '#818cf8',
    borderColor: 'rgba(99, 102, 241, 0.4)',
  },
  SCHEDULED: {
    bgColor: 'rgba(0, 136, 204, 0.2)',
    color: '#0088cc',
    borderColor: 'rgba(0, 136, 204, 0.4)',
  },
};

export function CampaignTypeBadge({
  type,
  showIcon = true,
  size = 'small',
  ...props
}: CampaignTypeBadgeProps) {
  const styles = TYPE_STYLES[type];

  return (
    <Chip
      label={CAMPAIGN_TYPE_LABELS[type]}
      icon={showIcon ? TYPE_ICONS[type] : undefined}
      size={size}
      sx={{
        backgroundColor: styles.bgColor,
        color: styles.color,
        border: '1px solid',
        borderColor: styles.borderColor,
        fontWeight: 500,
        '& .MuiChip-icon': {
          color: styles.color,
        },
        ...props.sx,
      }}
      {...props}
    />
  );
}


