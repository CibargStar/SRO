/**
 * Селектор группы клиентов
 * 
 * Компонент для выбора группы клиентов из списка.
 */

import React from 'react';
import { FormControl, InputLabel, Select, MenuItem, FormHelperText, Typography, Box } from '@mui/material';
import { styled } from '@mui/material/styles';
import LockIcon from '@mui/icons-material/Lock';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import { useClientGroups } from '@/hooks/useClientGroups';

const StyledSelect = styled(Select)({
  borderRadius: '12px',
  backgroundColor: 'rgba(255, 255, 255, 0.05)',
  color: '#ffffff',
  '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
  '&:hover .MuiOutlinedInput-notchedOutline': { border: 'none' },
  '&.Mui-focused .MuiOutlinedInput-notchedOutline': { border: 'none' },
  '& .MuiSelect-icon': { color: 'rgba(255, 255, 255, 0.7)' },
  '&.Mui-disabled': {
    color: '#ffffff',
    '& .MuiSelect-icon': { 
      display: 'none',
    },
    '& .MuiInputBase-input': { 
      color: '#ffffff',
      WebkitTextFillColor: '#ffffff',
    },
    '& .MuiSelect-select': {
      color: '#ffffff',
      WebkitTextFillColor: '#ffffff',
    },
  },
  '& .MuiInputBase-input': {
    color: '#ffffff',
  },
  '& .MuiSelect-select': {
    color: '#ffffff',
  },
});

const MenuProps = {
  PaperProps: {
    sx: {
      backgroundColor: '#212121',
      borderRadius: '12px',
      marginTop: '8px',
      '& .MuiMenuItem-root': {
        color: 'rgba(255, 255, 255, 0.9)',
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
      },
    },
  },
};

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
      <InputLabel 
        shrink={!required}
        sx={{ 
          color: 'rgba(255, 255, 255, 0.7)',
          '&.Mui-disabled': {
            color: 'rgba(255, 255, 255, 0.5)',
          },
          '&.Mui-focused': {
            color: 'rgba(255, 255, 255, 0.7)',
          },
          '&.MuiInputLabel-shrink': {
            color: 'rgba(255, 255, 255, 0.7)',
          },
        }}
      >
        {label}
      </InputLabel>
      <Box sx={{ position: 'relative', width: fullWidth ? '100%' : 'auto' }}>
        <StyledSelect
          value={value || ''}
          onChange={(e) => onChange(e.target.value ? (e.target.value as string) : null)}
          label={label}
          disabled={disabled || isLoading}
          required={required}
          sx={!fullWidth ? { minWidth: 200 } : undefined}
          IconComponent={ArrowDropDownIcon}
          fullWidth={fullWidth}
          MenuProps={MenuProps}
          displayEmpty={!required}
          renderValue={(selected) => {
            if (!selected || selected === '') {
              return fullWidth ? 'Не выбрана' : 'Все';
            }
            const group = groups.find(g => g.id === selected);
            return group?.name || selected;
          }}
        >
        {!required && <MenuItem value="">{fullWidth ? 'Не выбрана' : 'Все'}</MenuItem>}
        {groups.map((group) => (
          <MenuItem key={group.id} value={group.id}>
            {group.name}
          </MenuItem>
        ))}
        </StyledSelect>
        {(disabled || isLoading) && (
          <LockIcon 
            sx={{ 
              position: 'absolute',
              right: '14px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'rgba(255, 255, 255, 0.5)',
              fontSize: '20px',
              pointerEvents: 'none',
              zIndex: 1,
            }} 
          />
        )}
      </Box>
      {helperText && (
        <Typography variant="caption" sx={{ color: error ? '#f44336' : 'rgba(255, 255, 255, 0.5)', mt: 0.5, ml: 1.75 }}>
          {helperText}
        </Typography>
      )}
    </FormControl>
  );
}

