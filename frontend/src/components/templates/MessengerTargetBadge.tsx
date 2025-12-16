/**
 * Badge для отображения целевого мессенджера шаблона (WhatsApp/Telegram/Universal)
 */

import React from 'react';
import { Chip, type ChipProps } from '@mui/material';
import { styled } from '@mui/material/styles';
import type { MessengerTarget } from '@/types/template';

interface MessengerTargetBadgeProps extends Omit<ChipProps, 'label'> {
  target: MessengerTarget;
}

const WhatsAppChip = styled(Chip)({
  backgroundColor: 'rgba(37, 211, 102, 0.18)',
  color: '#4ade80',
  borderColor: 'rgba(37, 211, 102, 0.4)',
  fontSize: '0.75rem',
  height: '24px',
  '& .MuiChip-icon': {
    color: '#4ade80',
  },
  '& .MuiChip-label': {
    padding: '0 8px',
  },
});

const TelegramChip = styled(Chip)({
  backgroundColor: 'rgba(36, 161, 222, 0.18)',
  color: '#60a5fa',
  borderColor: 'rgba(36, 161, 222, 0.4)',
  fontSize: '0.75rem',
  height: '24px',
  '& .MuiChip-icon': {
    color: '#60a5fa',
  },
  '& .MuiChip-label': {
    padding: '0 8px',
  },
});

const UniversalChip = styled(Chip)({
  backgroundColor: 'rgba(156, 39, 176, 0.18)',
  color: '#c084fc',
  borderColor: 'rgba(156, 39, 176, 0.4)',
  fontSize: '0.75rem',
  height: '24px',
  '& .MuiChip-icon': {
    color: '#c084fc',
  },
  '& .MuiChip-label': {
    padding: '0 8px',
  },
});

const targetConfig: Record<MessengerTarget, { label: string; Component: typeof Chip }> = {
  WHATSAPP_ONLY: {
    label: 'WhatsApp',
    Component: WhatsAppChip,
  },
  TELEGRAM_ONLY: {
    label: 'Telegram',
    Component: TelegramChip,
  },
  UNIVERSAL: {
    label: 'Универсальный',
    Component: UniversalChip,
  },
};

export function MessengerTargetBadge({ target, size = 'small', ...props }: MessengerTargetBadgeProps) {
  const config = targetConfig[target];
  const ChipComponent = config.Component;

  return (
    <ChipComponent
      label={config.label}
      size={size}
      variant="outlined"
      {...props}
    />
  );
}

export default MessengerTargetBadge;



