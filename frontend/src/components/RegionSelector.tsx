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
      <InputLabel sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>{label}</InputLabel>
      <StyledSelect
        value={value || ''}
        onChange={(e) => onChange(e.target.value ? (e.target.value as string) : null)}
        label={label}
        disabled={isLoading}
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

