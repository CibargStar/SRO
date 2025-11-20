/**
 * Селектор группы клиентов
 * 
 * Компонент для выбора группы клиентов из списка.
 */

import React from 'react';
import { FormControl, InputLabel, Select, MenuItem } from '@mui/material';
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
}

export function ClientGroupSelector({
  value,
  onChange,
  label = 'Группа',
  fullWidth = true,
}: ClientGroupSelectorProps) {
  const { data: groups = [], isLoading } = useClientGroups();

  return (
    <FormControl fullWidth={fullWidth}>
      <InputLabel sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>{label}</InputLabel>
      <StyledSelect
        value={value || ''}
        onChange={(e) => onChange(e.target.value ? (e.target.value as string) : null)}
        label={label}
        disabled={isLoading}
      >
        <MenuItem value="">Не выбрана</MenuItem>
        {groups.map((group) => (
          <MenuItem key={group.id} value={group.id}>
            {group.name}
          </MenuItem>
        ))}
      </StyledSelect>
    </FormControl>
  );
}

