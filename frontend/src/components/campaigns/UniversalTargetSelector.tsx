import React from 'react';
import { FormControl, InputLabel, MenuItem, Select, FormHelperText } from '@mui/material';
import type { UniversalTarget } from '@/types/campaign';
import { UNIVERSAL_TARGET_LABELS } from '@/types/campaign';

interface UniversalTargetSelectorProps {
  value: UniversalTarget;
  onChange: (value: UniversalTarget) => void;
}

export function UniversalTargetSelector({ value, onChange }: UniversalTargetSelectorProps) {
  return (
    <FormControl fullWidth>
      <InputLabel>Порядок отправки</InputLabel>
      <Select
        label="Порядок отправки"
        value={value}
        onChange={(e) => onChange(e.target.value as UniversalTarget)}
      >
        <MenuItem value="WHATSAPP_FIRST">{UNIVERSAL_TARGET_LABELS.WHATSAPP_FIRST}</MenuItem>
        <MenuItem value="TELEGRAM_FIRST">{UNIVERSAL_TARGET_LABELS.TELEGRAM_FIRST}</MenuItem>
        <MenuItem value="BOTH">{UNIVERSAL_TARGET_LABELS.BOTH}</MenuItem>
      </Select>
      <FormHelperText>Определяет приоритет отправки для универсальных кампаний</FormHelperText>
    </FormControl>
  );
}

export default UniversalTargetSelector;





