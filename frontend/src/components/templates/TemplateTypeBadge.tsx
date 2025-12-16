/**
 * Badge для отображения типа шаблона (Single/Multi)
 */

import React from 'react';
import { Chip, type ChipProps, styled } from '@mui/material';
import { Article as SingleIcon, ViewList as MultiIcon } from '@mui/icons-material';
import type { TemplateType } from '@/types/template';

interface TemplateTypeBadgeProps extends Omit<ChipProps, 'label' | 'icon'> {
  type: TemplateType;
}

const StyledChip = styled(Chip)({
  backgroundColor: 'rgba(99, 102, 241, 0.15)',
  color: '#818cf8',
  borderColor: 'rgba(99, 102, 241, 0.3)',
  fontSize: '0.75rem',
  height: '24px',
  '& .MuiChip-icon': {
    color: '#818cf8',
  },
  '& .MuiChip-label': {
    padding: '0 8px',
  },
});

const typeConfig: Record<TemplateType, { label: string; icon: React.ReactElement }> = {
  SINGLE: {
    label: 'Одиночный',
    icon: <SingleIcon fontSize="small" />,
  },
  MULTI: {
    label: 'Составной',
    icon: <MultiIcon fontSize="small" />,
  },
};

export function TemplateTypeBadge({ type, size = 'small', ...props }: TemplateTypeBadgeProps) {
  const config = typeConfig[type];

  return (
    <StyledChip
      label={config.label}
      size={size}
      icon={config.icon}
      variant="outlined"
      {...props}
    />
  );
}

export default TemplateTypeBadge;



