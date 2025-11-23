/**
 * Общие стили и конфигурация для выпадающих списков (Select)
 * 
 * Унифицированные стили для всех Select компонентов в приложении.
 * Включает стилизованный Select и MenuProps для выпадающего меню.
 */

import { Select } from '@mui/material';
import { styled } from '@mui/material/styles';

/**
 * Стилизованный Select компонент с единым дизайном
 * Улучшенные стили для плавности и правильной подгонки размеров
 */
export const StyledSelect = styled(Select)({
  borderRadius: '12px',
  backgroundColor: 'rgba(255, 255, 255, 0.05)',
  color: '#ffffff',
  transition: 'all 0.2s ease-in-out',
  minHeight: '56px',
  '& .MuiOutlinedInput-notchedOutline': { 
    border: 'none',
    transition: 'all 0.2s ease-in-out',
  },
  '&:hover': {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  '&:hover .MuiOutlinedInput-notchedOutline': { 
    border: 'none',
  },
  '&.Mui-focused': {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  '&.Mui-focused .MuiOutlinedInput-notchedOutline': { 
    border: 'none',
  },
  '& .MuiSelect-icon': { 
    color: 'rgba(255, 255, 255, 0.7)',
    transition: 'color 0.2s ease-in-out',
    right: '14px',
  },
  '&:hover .MuiSelect-icon': {
    color: 'rgba(255, 255, 255, 0.9)',
  },
  '&.Mui-disabled': {
    color: '#ffffff',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    cursor: 'not-allowed',
    '& .MuiSelect-icon': { 
      display: 'none',
    },
    '& .MuiInputBase-input': { 
      color: '#ffffff',
      WebkitTextFillColor: '#ffffff',
      cursor: 'not-allowed',
    },
    '& .MuiSelect-select': {
      color: '#ffffff',
      WebkitTextFillColor: '#ffffff',
      cursor: 'not-allowed',
    },
  },
  '& .MuiInputBase-input': {
    color: '#ffffff',
    padding: '16.5px 14px',
    fontSize: '0.95rem',
    lineHeight: '1.5',
  },
  '& .MuiSelect-select': {
    color: '#ffffff',
    padding: '16.5px 14px',
    fontSize: '0.95rem',
    lineHeight: '1.5',
    minHeight: 'auto',
  },
  '& .MuiSelect-select:focus': {
    backgroundColor: 'transparent',
  },
});

/**
 * Конфигурация для выпадающего меню Select
 * Обеспечивает единый стиль для всех выпадающих списков
 * Улучшенные стили для плавности и правильной подгонки размеров
 */
export const MenuProps = {
  PaperProps: {
    sx: {
      backgroundColor: '#212121',
      borderRadius: '12px',
      marginTop: '8px',
      boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      maxHeight: '300px',
      minWidth: '200px',
      '& .MuiMenuItem-root': {
        color: 'rgba(255, 255, 255, 0.9)',
        padding: '10px 16px',
        fontSize: '0.9rem',
        minHeight: '48px',
        transition: 'all 0.2s ease-in-out',
        '&:hover': {
          backgroundColor: 'rgba(255, 255, 255, 0.1)',
        },
        '&.Mui-selected': {
          backgroundColor: 'rgba(255, 255, 255, 0.1)',
          color: 'rgba(255, 255, 255, 0.9)',
          '&:hover': {
            backgroundColor: 'rgba(255, 255, 255, 0.15)',
          },
          '&.Mui-focusVisible': {
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
          },
        },
        '&.Mui-focusVisible': {
          backgroundColor: 'rgba(255, 255, 255, 0.1)',
        },
        '&.Mui-disabled': {
          opacity: 0.5,
          cursor: 'not-allowed',
        },
      },
    },
  },
  anchorOrigin: {
    vertical: 'bottom' as const,
    horizontal: 'left' as const,
  },
  transformOrigin: {
    vertical: 'top' as const,
    horizontal: 'left' as const,
  },
  transitionDuration: 200,
};

/**
 * Стили для InputLabel в Select компонентах
 */
export const selectInputLabelStyles = {
  color: 'rgba(255, 255, 255, 0.7)',
  fontSize: '0.95rem',
  transition: 'all 0.2s ease-in-out',
  '&.Mui-disabled': {
    color: 'rgba(255, 255, 255, 0.5)',
  },
  '&.Mui-focused': {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  '&.MuiInputLabel-shrink': {
    color: 'rgba(255, 255, 255, 0.7)',
    transform: 'translate(14px, -9px) scale(0.75)',
  },
};

