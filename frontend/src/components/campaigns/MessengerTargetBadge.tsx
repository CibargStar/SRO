/**
 * Бейдж целевого мессенджера кампании
 * 
 * Отображает целевой мессенджер (WhatsApp, Telegram или Универсальный).
 */

import React from 'react';
import { Chip, type ChipProps, styled } from '@mui/material';
import type { MessengerTarget } from '@/types/campaign';
import { MESSENGER_TARGET_LABELS } from '@/types/campaign';

interface MessengerTargetBadgeProps extends Omit<ChipProps, 'color' | 'label'> {
  target: MessengerTarget;
}

// WhatsApp зеленый
const WhatsAppChip = styled(Chip)(({ theme }) => ({
  backgroundColor: '#25D366',
  color: '#fff',
  '&:hover': {
    backgroundColor: '#128C7E',
  },
}));

// Telegram синий
const TelegramChip = styled(Chip)(({ theme }) => ({
  backgroundColor: '#0088CC',
  color: '#fff',
  '&:hover': {
    backgroundColor: '#006699',
  },
}));

// Универсальный - фиолетовый градиент
const UniversalChip = styled(Chip)(({ theme }) => ({
  background: 'linear-gradient(135deg, #25D366 0%, #0088CC 100%)',
  color: '#fff',
  '&:hover': {
    background: 'linear-gradient(135deg, #128C7E 0%, #006699 100%)',
  },
}));

export function MessengerTargetBadge({
  target,
  size = 'small',
  ...props
}: MessengerTargetBadgeProps) {
  const label = MESSENGER_TARGET_LABELS[target];

  switch (target) {
    case 'WHATSAPP_ONLY':
      return <WhatsAppChip label={label} size={size} {...props} />;
    case 'TELEGRAM_ONLY':
      return <TelegramChip label={label} size={size} {...props} />;
    case 'UNIVERSAL':
      return <UniversalChip label={label} size={size} {...props} />;
    default:
      return <Chip label={label} size={size} {...props} />;
  }
}


