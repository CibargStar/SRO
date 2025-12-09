import React from 'react';
import { FormControl, InputLabel, MenuItem, Select } from '@mui/material';
import type { UpdateGlobalSettingsInput } from '@/types/campaign';

type OnChange = <K extends keyof UpdateGlobalSettingsInput>(key: K, value: UpdateGlobalSettingsInput[K]) => void;

interface Props {
  value?: 1 | 2;
  onChange: OnChange;
}

export function PauseModeSelector({ value, onChange }: Props) {
  return (
    <FormControl fullWidth>
      <InputLabel id="pause-mode-label">Режим паузы</InputLabel>
      <Select
        labelId="pause-mode-label"
        label="Режим паузы"
        value={value ?? ''}
        onChange={(e) => onChange('pauseMode', e.target.value === '' ? undefined : (e.target.value as 1 | 2))}
      >
        <MenuItem value={1}>Между номерами</MenuItem>
        <MenuItem value={2}>Между клиентами</MenuItem>
      </Select>
    </FormControl>
  );
}

export default PauseModeSelector;


