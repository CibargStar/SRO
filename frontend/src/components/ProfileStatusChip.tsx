/**
 * Компонент для отображения статуса профиля
 * 
 * Отображает статус профиля в виде цветного Chip с иконкой.
 */

import React from 'react';
import { Chip, Tooltip } from '@mui/material';
import { styled } from '@mui/material/styles';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import StopIcon from '@mui/icons-material/Stop';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import ErrorIcon from '@mui/icons-material/Error';
import PauseIcon from '@mui/icons-material/Pause';
import type { ProfileStatus } from '@/types';

/**
 * Стилизованный Chip для статуса
 */
const StatusChip = styled(Chip)<{ status: ProfileStatus }>(({ status, theme }) => {
  const getColor = () => {
    switch (status) {
      case 'RUNNING':
        return {
          backgroundColor: 'rgba(76, 175, 80, 0.2)',
          color: '#4caf50',
          borderColor: '#4caf50',
        };
      case 'STOPPED':
        return {
          backgroundColor: 'rgba(158, 158, 158, 0.2)',
          color: 'rgba(255, 255, 255, 0.5)',
          borderColor: 'rgba(255, 255, 255, 0.3)',
        };
      case 'STARTING':
        return {
          backgroundColor: 'rgba(255, 193, 7, 0.2)',
          color: '#ffc107',
          borderColor: '#ffc107',
        };
      case 'STOPPING':
        return {
          backgroundColor: 'rgba(255, 152, 0, 0.2)',
          color: '#ff9800',
          borderColor: '#ff9800',
        };
      case 'ERROR':
        return {
          backgroundColor: 'rgba(244, 67, 54, 0.2)',
          color: '#f44336',
          borderColor: '#f44336',
        };
      default:
        return {
          backgroundColor: 'rgba(158, 158, 158, 0.2)',
          color: 'rgba(255, 255, 255, 0.5)',
          borderColor: 'rgba(255, 255, 255, 0.3)',
        };
    }
  };

  const colors = getColor();

  return {
    fontSize: '0.75rem',
    fontWeight: 500,
    backgroundColor: colors.backgroundColor,
    color: colors.color,
    border: `1px solid ${colors.borderColor}`,
    '& .MuiChip-icon': {
      color: colors.color,
    },
  };
});

/**
 * Получение иконки для статуса
 */
function getStatusIcon(status: ProfileStatus) {
  switch (status) {
    case 'RUNNING':
      return <PlayArrowIcon fontSize="small" />;
    case 'STOPPED':
      return <StopIcon fontSize="small" />;
    case 'STARTING':
      return <HourglassEmptyIcon fontSize="small" />;
    case 'STOPPING':
      return <PauseIcon fontSize="small" />;
    case 'ERROR':
      return <ErrorIcon fontSize="small" />;
    default:
      return null;
  }
}

/**
 * Получение текста для статуса
 */
function getStatusText(status: ProfileStatus): string {
  switch (status) {
    case 'RUNNING':
      return 'Запущен';
    case 'STOPPED':
      return 'Остановлен';
    case 'STARTING':
      return 'Запускается';
    case 'STOPPING':
      return 'Останавливается';
    case 'ERROR':
      return 'Ошибка';
    default:
      return status;
  }
}

interface ProfileStatusChipProps {
  status: ProfileStatus;
  /** Показывать ли tooltip */
  showTooltip?: boolean;
  /** Размер chip */
  size?: 'small' | 'medium';
}

/**
 * Компонент для отображения статуса профиля
 * 
 * @param status - Статус профиля
 * @param showTooltip - Показывать ли tooltip с описанием
 * @param size - Размер chip
 */
export function ProfileStatusChip({ status, showTooltip = false, size = 'small' }: ProfileStatusChipProps) {
  const chip = (
    <StatusChip
      status={status}
      icon={getStatusIcon(status)}
      label={getStatusText(status)}
      size={size}
      variant="outlined"
    />
  );

  if (showTooltip) {
    return (
      <Tooltip title={getStatusText(status)} placement="top">
        {chip}
      </Tooltip>
    );
  }

  return chip;
}




