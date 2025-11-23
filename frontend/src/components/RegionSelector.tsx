/**
 * Селектор региона
 * 
 * Компонент для выбора региона из списка.
 */

import React from 'react';
import { FormControl, InputLabel, MenuItem } from '@mui/material';
import { useRegions } from '@/hooks/useRegions';
import { StyledSelect, MenuProps, selectInputLabelStyles } from './common/SelectStyles';

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
      <InputLabel sx={selectInputLabelStyles}>
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

