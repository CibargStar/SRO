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
  backgroundColor: 'rgba(37, 211, 102, 0.15)',
  color: '#25D366',
  borderColor: '#25D366',
  '& .MuiChip-icon': {
    color: '#25D366',
  },
});

const TelegramChip = styled(Chip)({
  backgroundColor: 'rgba(36, 161, 222, 0.15)',
  color: '#24A1DE',
  borderColor: '#24A1DE',
  '& .MuiChip-icon': {
    color: '#24A1DE',
  },
});

const UniversalChip = styled(Chip)({
  backgroundColor: 'rgba(156, 39, 176, 0.15)',
  color: '#9C27B0',
  borderColor: '#9C27B0',
  '& .MuiChip-icon': {
    color: '#9C27B0',
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


