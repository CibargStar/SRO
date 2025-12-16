import React from 'react';
import { FormControl, InputLabel, MenuItem } from '@mui/material';
import { StyledSelect, MenuProps, selectInputLabelStyles } from '@/components/common';
import type { UpdateGlobalSettingsInput } from '@/types/campaign';

type OnChange = <K extends keyof UpdateGlobalSettingsInput>(key: K, value: UpdateGlobalSettingsInput[K]) => void;

interface Props {
  value?: 1 | 2;
  onChange: OnChange;
}

export function PauseModeSelector({ value, onChange }: Props) {
  return (
    <FormControl fullWidth>
      <InputLabel sx={selectInputLabelStyles}>Режим паузы</InputLabel>
      <StyledSelect
        label="Режим паузы"
        value={value ?? ''}
        onChange={(e) => onChange('pauseMode', e.target.value === '' ? undefined : (e.target.value as 1 | 2))}
        MenuProps={MenuProps}
      >
        <MenuItem value={1}>Между номерами</MenuItem>
        <MenuItem value={2}>Между клиентами</MenuItem>
      </StyledSelect>
    </FormControl>
  );
}

export default PauseModeSelector;



