/**
 * Общие стили для форм и кнопок
 * 
 * Унифицированные стили для всех форм в приложении.
 * Включает стилизованные TextField, Button и CancelButton.
 */

import { TextField, Button, Select } from '@mui/material';
import { styled } from '@mui/material/styles';

/**
 * Стилизованный TextField компонент с единым дизайном
 */
export const StyledTextField = styled(TextField)({
  '& .MuiOutlinedInput-root': {
    borderRadius: '12px',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    color: '#ffffff',
    '& fieldset': { border: 'none' },
    '&:hover fieldset': { border: 'none' },
    '&.Mui-focused fieldset': { border: 'none' },
  },
  '& .MuiInputLabel-root': { color: 'rgba(255, 255, 255, 0.7)' },
  '& .MuiInputLabel-root.Mui-focused': { color: 'rgba(255, 255, 255, 0.9)' },
});

/**
 * Стилизованная основная кнопка (для действий: Создать, Сохранить, и т.д.)
 */
export const StyledButton = styled(Button)(({ theme }) => ({
  borderRadius: '12px',
  backgroundColor: '#f5f5f5',
  color: '#212121',
  textTransform: 'none',
  fontWeight: 500,
  padding: theme.spacing(1.5, 3),
  '&:hover': { 
    backgroundColor: '#ffffff', 
    transform: 'translateY(-2px)',
  },
}));

/**
 * Стилизованная кнопка отмены (прозрачная, для отмены действий)
 */
export const CancelButton = styled(Button)(({ theme }) => ({
  borderRadius: '12px',
  backgroundColor: 'transparent',
  color: 'rgba(255, 255, 255, 0.7)',
  textTransform: 'none',
  padding: theme.spacing(1.5, 3),
  '&:hover': { 
    backgroundColor: 'rgba(255, 255, 255, 0.1)', 
    color: '#ffffff',
  },
}));

/**
 * Стилизованный Select компонент с единым дизайном
 */
export const StyledSelect = styled(Select)({
  borderRadius: '12px',
  backgroundColor: 'rgba(255, 255, 255, 0.05)',
  color: '#ffffff',
  '& .MuiOutlinedInput-notchedOutline': {
    border: 'none',
  },
  '&:hover .MuiOutlinedInput-notchedOutline': {
    border: 'none',
  },
  '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
    border: 'none',
  },
  '& .MuiSelect-icon': {
    color: 'rgba(255, 255, 255, 0.7)',
  },
});

