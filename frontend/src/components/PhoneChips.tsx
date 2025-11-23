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
import type { ClientPhone } from '@/types';

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
 * Стилизованный чип для телефона
 */
const PhoneChip = styled(Chip)({
  backgroundColor: 'rgba(255, 255, 255, 0.1)',
  color: 'rgba(255, 255, 255, 0.9)',
  fontSize: '0.75rem',
  height: '24px',
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
      {phones.map((phone) => (
        <PhoneChip
          key={phone.id}
          label={phone.phone}
          size="small"
        />
      ))}
    </PhoneChipsContainer>
  );
}

