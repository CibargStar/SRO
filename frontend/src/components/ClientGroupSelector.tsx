/**
 * Селектор группы клиентов
 * 
 * Компонент для выбора группы клиентов из списка.
 */

import React from 'react';
import { FormControl, InputLabel, Select, MenuItem, FormHelperText, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import { useClientGroups } from '@/hooks/useClientGroups';

const StyledSelect = styled(Select)({
  borderRadius: '12px',
  backgroundColor: 'rgba(255, 255, 255, 0.05)',
  color: '#ffffff',
  '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
  '&:hover .MuiOutlinedInput-notchedOutline': { border: 'none' },
  '&.Mui-focused .MuiOutlinedInput-notchedOutline': { border: 'none' },
  '& .MuiSelect-icon': { color: 'rgba(255, 255, 255, 0.7)' },
});

interface ClientGroupSelectorProps {
  value: string | null;
  onChange: (value: string | null) => void;
  label?: string;
  fullWidth?: boolean;
  required?: boolean;
  error?: boolean;
  helperText?: string;
  disabled?: boolean;
  userId?: string; // Опциональный ID пользователя для ROOT (для фильтрации групп)
}

export function ClientGroupSelector({
  value,
  onChange,
  label = 'Группа',
  fullWidth = true,
  required = false,
  error = false,
  helperText,
  disabled = false,
  userId,
}: ClientGroupSelectorProps) {
  const { data: groups = [], isLoading } = useClientGroups(userId);

  return (
    <FormControl fullWidth={fullWidth} required={required} error={error} disabled={disabled || isLoading}>
      <InputLabel sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>{label}</InputLabel>
      <StyledSelect
        value={value || ''}
        onChange={(e) => onChange(e.target.value ? (e.target.value as string) : null)}
        label={label}
        disabled={disabled || isLoading}
        required={required}
        sx={!fullWidth ? { minWidth: 200 } : undefined}
      >
        {!required && <MenuItem value="">{fullWidth ? 'Не выбрана' : 'Все'}</MenuItem>}
        {groups.map((group) => (
          <MenuItem key={group.id} value={group.id}>
            {group.name}
          </MenuItem>
        ))}
      </StyledSelect>
      {helperText && (
        <Typography variant="caption" sx={{ color: error ? '#f44336' : 'rgba(255, 255, 255, 0.5)', mt: 0.5, ml: 1.75 }}>
          {helperText}
        </Typography>
      )}
    </FormControl>
  );
}

