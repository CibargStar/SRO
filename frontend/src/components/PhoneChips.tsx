/**
 * Компонент для отображения телефонов в виде чипсов
 * 
 * Отображает список телефонов в виде отдельных чипсов (Chip),
 * аналогично предустановленным шаблонам в модалке настройки импорта.
 * Каждый номер отображается в отдельной "ячейке".
 */

import React from 'react';
import { Box, Chip, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import type { ClientPhone, MessengerStatus } from '@/types';

/**
 * Получение цвета для статуса WhatsApp
 * 
 * @param status - Статус WhatsApp
 * @returns Цвет в формате rgba
 */
function getWhatsAppColor(status: MessengerStatus): string {
  switch (status) {
    case 'Valid':
      return 'rgba(76, 175, 80, 0.3)'; // Зеленый
    case 'Invalid':
      return 'rgba(244, 67, 54, 0.3)'; // Красный
    case 'Unknown':
    default:
      return 'rgba(255, 255, 255, 0.1)'; // Серый (дефолтный)
  }
}

/**
 * Получение цвета для статуса Telegram
 * 
 * @param status - Статус Telegram
 * @returns Цвет в формате rgba
 */
function getTelegramColor(status: MessengerStatus): string {
  switch (status) {
    case 'Valid':
      return 'rgba(33, 150, 243, 0.3)'; // Голубой
    case 'Invalid':
      return 'rgba(244, 67, 54, 0.3)'; // Красный
    case 'Unknown':
    default:
      return 'rgba(255, 255, 255, 0.1)'; // Серый (дефолтный)
  }
}

/**
 * Получение градиентного фона для телефона
 * 
 * Левая половина - статус WhatsApp, правая половина - статус Telegram
 * 
 * @param whatsAppStatus - Статус WhatsApp
 * @param telegramStatus - Статус Telegram
 * @returns CSS строка с linear-gradient
 */
function getPhoneGradient(whatsAppStatus: MessengerStatus, telegramStatus: MessengerStatus): string {
  const whatsAppColor = getWhatsAppColor(whatsAppStatus);
  const telegramColor = getTelegramColor(telegramStatus);
  
  return `linear-gradient(to right, ${whatsAppColor} 50%, ${telegramColor} 50%)`;
}

/**
 * Стилизованный контейнер для чипсов телефонов
 */
const PhoneChipsContainer = styled(Box)({
  display: 'flex',
  gap: '0.5rem',
  flexWrap: 'wrap',
  alignItems: 'flex-start',
});

/**
 * Стилизованный чип для телефона (базовые стили без градиента)
 */
const PhoneChipBase = styled(Chip)({
  color: 'rgba(255, 255, 255, 0.9)',
  fontSize: '0.75rem',
  height: '24px',
  border: 'none',
  backgroundColor: 'transparent',
  '& .MuiChip-label': {
    padding: '0 8px',
  },
});

interface PhoneChipsProps {
  /**
   * Массив телефонов для отображения
   */
  phones: ClientPhone[];
  
  /**
   * Текст, отображаемый при отсутствии телефонов
   * @default '-'
   */
  emptyText?: string;
}

/**
 * Компонент для отображения телефонов в виде чипсов
 * 
 * @param phones - Массив телефонов для отображения
 * @param emptyText - Текст, отображаемый при отсутствии телефонов
 */
export function PhoneChips({ phones, emptyText = '-' }: PhoneChipsProps) {
  if (!phones || phones.length === 0) {
    return (
      <Typography
        variant="body2"
        sx={{
          color: 'rgba(255, 255, 255, 0.7)',
        }}
      >
        {emptyText}
      </Typography>
    );
  }

  return (
    <PhoneChipsContainer>
      {phones.map((phone) => {
        const gradient = getPhoneGradient(
          phone.whatsAppStatus || 'Unknown',
          phone.telegramStatus || 'Unknown'
        );
        
        return (
          <Box
            key={phone.id}
            sx={{
              display: 'inline-flex',
              backgroundImage: gradient,
              background: gradient,
              borderRadius: '16px',
              padding: '1px',
              overflow: 'hidden',
            }}
          >
            <PhoneChipBase
              label={phone.phone}
              size="small"
              sx={{
                backgroundColor: 'transparent !important',
                background: 'transparent !important',
                height: '22px',
                '& .MuiChip-root': {
                  backgroundColor: 'transparent !important',
                  background: 'transparent !important',
                },
                '& .MuiChip-label': {
                  padding: '0 8px',
                },
              }}
            />
          </Box>
        );
      })}
    </PhoneChipsContainer>
  );
}

