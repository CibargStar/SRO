/**
 * Компонент множественного выбора регионов
 * 
 * Позволяет выбрать несколько регионов из списка или "Все регионы".
 * Если выбрано "Все", то regionIds будет пустым массивом (что означает все регионы).
 */

import React from 'react';
import { FormControl, InputLabel, MenuItem, Chip, Box, Divider } from '@mui/material';
import { useRegions } from '@/hooks/useRegions';
import { StyledSelect, MenuProps, selectInputLabelStyles } from './common/SelectStyles';

const ALL_REGIONS_VALUE = '__ALL__';

interface RegionMultiSelectProps {
  value: string[];
  onChange: (value: string[]) => void;
  label?: string;
  fullWidth?: boolean;
  disabled?: boolean;
}

export function RegionMultiSelect({ 
  value = [], 
  onChange, 
  label = 'Регионы', 
  fullWidth = true,
  disabled = false 
}: RegionMultiSelectProps) {
  const { data: regions = [], isLoading } = useRegions();

  // Проверяем, выбрано ли "Все"
  const isAllSelected = value.length === 0 || value.includes(ALL_REGIONS_VALUE);
  
  // Если выбрано "Все", показываем специальное значение
  const displayValue = isAllSelected ? [ALL_REGIONS_VALUE] : value;

  const handleChange = (selected: string[]) => {
    // Если выбран пункт "Все регионы"
    if (selected.includes(ALL_REGIONS_VALUE)) {
      // Если выбрано "Все" и еще какие-то регионы - убираем "Все" и оставляем только регионы
      if (selected.length > 1) {
        // Убираем "__ALL__" из выбранных
        onChange(selected.filter(id => id !== ALL_REGIONS_VALUE));
      } else {
        // Выбираем только "Все" (пустой массив означает все регионы)
        onChange([]);
      }
    } else {
      // Если выбраны конкретные регионы (без "Все")
      onChange(selected);
    }
  };

  return (
    <FormControl fullWidth={fullWidth} disabled={disabled || isLoading}>
      <InputLabel sx={selectInputLabelStyles}>
        {label}
      </InputLabel>
      <StyledSelect
        multiple
        value={displayValue}
        onChange={(e) => {
          const selected = typeof e.target.value === 'string' 
            ? e.target.value.split(',') 
            : e.target.value;
          handleChange(selected as string[]);
        }}
        label={label}
        disabled={disabled || isLoading}
        MenuProps={MenuProps}
        renderValue={(selected) => {
          if (selected.length === 0 || (selected.length === 1 && selected[0] === ALL_REGIONS_VALUE)) {
            return <span style={{ color: 'rgba(255, 255, 255, 0.7)' }}>Все регионы</span>;
          }
          return (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
              {(selected as string[]).map((regionId) => {
                if (regionId === ALL_REGIONS_VALUE) {
                  return null; // Не показываем "__ALL__" в чипах
                }
                const region = regions.find(r => r.id === regionId);
                return (
                  <Chip
                    key={regionId}
                    label={region?.name || regionId}
                    size="small"
                    sx={{
                      backgroundColor: 'rgba(99, 102, 241, 0.2)',
                      color: '#ffffff',
                      height: '24px',
                      fontSize: '0.75rem',
                      '& .MuiChip-deleteIcon': {
                        color: 'rgba(255, 255, 255, 0.7)',
                        fontSize: '16px',
                      },
                    }}
                  />
                );
              })}
            </Box>
          );
        }}
      >
        <MenuItem value={ALL_REGIONS_VALUE} sx={{ fontWeight: isAllSelected ? 600 : 400 }}>
          Все регионы
        </MenuItem>
        <Divider sx={{ my: 0.5, borderColor: 'rgba(255, 255, 255, 0.12)' }} />
        {regions.map((region) => (
          <MenuItem key={region.id} value={region.id}>
            {region.name}
          </MenuItem>
        ))}
      </StyledSelect>
    </FormControl>
  );
}




