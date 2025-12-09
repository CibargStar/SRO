import React from 'react';
import { Grid, TextField, FormControlLabel, Switch } from '@mui/material';
import type { UpdateGlobalSettingsInput } from '@/types/campaign';

type OnChange = <K extends keyof UpdateGlobalSettingsInput>(key: K, value: UpdateGlobalSettingsInput[K]) => void;

interface Props {
  form: UpdateGlobalSettingsInput;
  onChange: OnChange;
}

export function TypingSimulationForm({ form, onChange }: Props) {
  return (
    <Grid container spacing={2}>
      <Grid item xs={12} md={6}>
        <FormControlLabel
          control={
            <Switch
              checked={form.typingSimulationEnabled ?? false}
              onChange={(_, checked) => onChange('typingSimulationEnabled', checked)}
            />
          }
          label="Имитация набора"
        />
      </Grid>
      <Grid item xs={12} md={6}>
        <TextField
          label="Скорость набора (симв/сек)"
          type="number"
          fullWidth
          value={form.typingSpeedCharsPerSec ?? ''}
          onChange={(e) => onChange('typingSpeedCharsPerSec', e.target.value === '' ? undefined : Number(e.target.value))}
        />
      </Grid>
    </Grid>
  );
}

export default TypingSimulationForm;


