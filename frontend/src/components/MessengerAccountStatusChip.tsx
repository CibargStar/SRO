/**
 * Компонент для отображения статуса аккаунта мессенджера
 * 
 * Отображает статус аккаунта мессенджера в виде цветного Chip с иконкой.
 * Поддерживает отображение статуса "Требуется пароль" для Telegram 2FA.
 */

import React from 'react';
import { Chip, Tooltip } from '@mui/material';
import { styled } from '@mui/material/styles';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import ErrorIcon from '@mui/icons-material/Error';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import LockIcon from '@mui/icons-material/Lock';
import type { MessengerAccountStatus } from '@/types';

/**
 * Тип для расширенного статуса (включая облачный пароль)
 */
type ExtendedStatus = MessengerAccountStatus | 'CLOUD_PASSWORD_REQUIRED';

/**
 * Получение цветов для статуса
 */
function getStatusColors(status: ExtendedStatus) {
  switch (status) {
    case 'LOGGED_IN':
      return {
        backgroundColor: 'rgba(76, 175, 80, 0.2)',
        color: '#4caf50',
        borderColor: '#4caf50',
      };
    case 'CLOUD_PASSWORD_REQUIRED':
      return {
        backgroundColor: 'rgba(255, 152, 0, 0.2)',
        color: '#ff9800',
        borderColor: '#ff9800',
      };
    case 'NOT_LOGGED_IN':
      return {
        backgroundColor: 'rgba(33, 150, 243, 0.2)',
        color: '#2196f3',
        borderColor: '#2196f3',
      };
    case 'CHECKING':
      return {
        backgroundColor: 'rgba(255, 193, 7, 0.2)',
        color: '#ffc107',
        borderColor: '#ffc107',
      };
    case 'ERROR':
      return {
        backgroundColor: 'rgba(244, 67, 54, 0.2)',
        color: '#f44336',
        borderColor: '#f44336',
      };
    case 'UNKNOWN':
    default:
      return {
        backgroundColor: 'rgba(158, 158, 158, 0.2)',
        color: 'rgba(255, 255, 255, 0.5)',
        borderColor: 'rgba(255, 255, 255, 0.3)',
      };
  }
}

/**
 * Стилизованный Chip для статуса
 */
const StatusChip = styled(Chip)<{ extendedStatus: ExtendedStatus }>(({ extendedStatus }) => {
  const colors = getStatusColors(extendedStatus);

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
function getStatusIcon(status: ExtendedStatus) {
  switch (status) {
    case 'LOGGED_IN':
      return <CheckCircleIcon fontSize="small" />;
    case 'CLOUD_PASSWORD_REQUIRED':
      return <LockIcon fontSize="small" />;
    case 'NOT_LOGGED_IN':
      return <CancelIcon fontSize="small" />;
    case 'CHECKING':
      return <HourglassEmptyIcon fontSize="small" />;
    case 'ERROR':
      return <ErrorIcon fontSize="small" />;
    case 'UNKNOWN':
      return <HelpOutlineIcon fontSize="small" />;
    default:
      return null;
  }
}

/**
 * Получение текста для статуса
 */
function getStatusText(status: ExtendedStatus): string {
  switch (status) {
    case 'LOGGED_IN':
      return 'Вход выполнен';
    case 'CLOUD_PASSWORD_REQUIRED':
      return 'Требуется пароль';
    case 'NOT_LOGGED_IN':
      return 'Требуется вход';
    case 'CHECKING':
      return 'Проверка...';
    case 'ERROR':
      return 'Ошибка';
    case 'UNKNOWN':
      return 'Неизвестно';
    default:
      return String(status);
  }
}

interface MessengerAccountStatusChipProps {
  status: MessengerAccountStatus;
  /** Показывать ли tooltip */
  showTooltip?: boolean;
  /** Размер chip */
  size?: 'small' | 'medium';
  /** Требуется ли облачный пароль (для Telegram 2FA) */
  cloudPasswordRequired?: boolean;
}

/**
 * Компонент для отображения статуса аккаунта мессенджера
 * 
 * @param status - Статус аккаунта
 * @param showTooltip - Показывать ли tooltip с описанием
 * @param size - Размер chip
 * @param cloudPasswordRequired - Требуется ли облачный пароль
 */
export function MessengerAccountStatusChip({
  status,
  showTooltip = false,
  size = 'small',
  cloudPasswordRequired = false,
}: MessengerAccountStatusChipProps) {
  // Определяем расширенный статус с учётом облачного пароля
  const extendedStatus: ExtendedStatus = 
    status === 'NOT_LOGGED_IN' && cloudPasswordRequired 
      ? 'CLOUD_PASSWORD_REQUIRED' 
      : status;

  const chip = (
    <StatusChip
      extendedStatus={extendedStatus}
      icon={getStatusIcon(extendedStatus)}
      label={getStatusText(extendedStatus)}
      size={size}
      variant="outlined"
    />
  );

  if (showTooltip) {
    return (
      <Tooltip title={getStatusText(extendedStatus)} placement="top">
        {chip}
      </Tooltip>
    );
  }

  return chip;
}


