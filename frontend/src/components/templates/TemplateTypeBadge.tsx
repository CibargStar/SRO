/**
 * Badge для отображения типа шаблона (Single/Multi)
 */

import React from 'react';
import { Chip, type ChipProps } from '@mui/material';
import { Article as SingleIcon, ViewList as MultiIcon } from '@mui/icons-material';
import type { TemplateType } from '@/types/template';

interface TemplateTypeBadgeProps extends Omit<ChipProps, 'label' | 'icon'> {
  type: TemplateType;
}

const typeConfig: Record<TemplateType, { label: string; color: ChipProps['color']; icon: React.ReactElement }> = {
  SINGLE: {
    label: 'Одиночный',
    color: 'primary',
    icon: <SingleIcon fontSize="small" />,
  },
  MULTI: {
    label: 'Составной',
    color: 'secondary',
    icon: <MultiIcon fontSize="small" />,
  },
};

export function TemplateTypeBadge({ type, size = 'small', ...props }: TemplateTypeBadgeProps) {
  const config = typeConfig[type];

  return (
    <Chip
      label={config.label}
      color={config.color}
      size={size}
      icon={config.icon}
      variant="outlined"
      {...props}
    />
  );
}

export default TemplateTypeBadge;


