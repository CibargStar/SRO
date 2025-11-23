/**
 * Селектор региона
 * 
 * Компонент для выбора региона из списка.
 */

import React from 'react';
import { FormControl, InputLabel, Select, MenuItem } from '@mui/material';
import { styled } from '@mui/material/styles';
import { useRegions } from '@/hooks/useRegions';

const StyledSelect = styled(Select)({
  borderRadius: '12px',
  backgroundColor: 'rgba(255, 255, 255, 0.05)',
  color: '#ffffff',
  '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
  '&:hover .MuiOutlinedInput-notchedOutline': { border: 'none' },
  '&.Mui-focused .MuiOutlinedInput-notchedOutline': { border: 'none' },
  '& .MuiSelect-icon': { color: 'rgba(255, 255, 255, 0.7)' },
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

interface RegionSelectorProps {
  value: string | null;
  onChange: (value: string | null) => void;
  label?: string;
  fullWidth?: boolean;
}

export function RegionSelector({ value, onChange, label = 'Регион', fullWidth = true }: RegionSelectorProps) {
  const { data: regions = [], isLoading } = useRegions();

  return (
    <FormControl fullWidth={fullWidth}>
      <InputLabel 
        sx={{ 
          color: 'rgba(255, 255, 255, 0.7)',
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
      <StyledSelect
        value={value || ''}
        onChange={(e) => onChange(e.target.value ? (e.target.value as string) : null)}
        label={label}
        disabled={isLoading}
        MenuProps={MenuProps}
      >
        <MenuItem value="">Не выбран</MenuItem>
        {regions.map((region) => (
          <MenuItem key={region.id} value={region.id}>
            {region.name}
          </MenuItem>
        ))}
      </StyledSelect>
    </FormControl>
  );
}

