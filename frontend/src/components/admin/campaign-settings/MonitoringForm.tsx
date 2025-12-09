import React from 'react';
import { Grid, TextField, FormControlLabel, Switch } from '@mui/material';
import type { UpdateGlobalSettingsInput } from '@/types/campaign';

type OnChange = <K extends keyof UpdateGlobalSettingsInput>(key: K, value: UpdateGlobalSettingsInput[K]) => void;

interface Props {
  form: UpdateGlobalSettingsInput;
  onChange: OnChange;
}

export function MonitoringForm({ form, onChange }: Props) {
  return (
    <Grid container spacing={2}>
      <Grid item xs={12} md={6}>
        <TextField
          label="Интервал health-check профилей (мс)"
          type="number"
          fullWidth
          value={form.profileHealthCheckIntervalMs ?? ''}
          onChange={(e) => onChange('profileHealthCheckIntervalMs', e.target.value === '' ? undefined : Number(e.target.value))}
        />
      </Grid>
      <Grid item xs={12} md={6}>
        <FormControlLabel
          control={
            <Switch
              checked={form.autoResumeAfterRestart ?? false}
              onChange={(_, checked) => onChange('autoResumeAfterRestart', checked)}
            />
          }
          label="Автовозобновление после рестарта"
        />
      </Grid>
    </Grid>
  );
}

export default MonitoringForm;


