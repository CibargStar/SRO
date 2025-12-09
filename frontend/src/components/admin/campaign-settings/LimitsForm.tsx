import React from 'react';
import { Grid, TextField } from '@mui/material';
import type { UpdateGlobalSettingsInput } from '@/types/campaign';

type OnChange = <K extends keyof UpdateGlobalSettingsInput>(key: K, value: UpdateGlobalSettingsInput[K]) => void;

interface Props {
  form: UpdateGlobalSettingsInput;
  onChange: OnChange;
}

export function LimitsForm({ form, onChange }: Props) {
  return (
    <Grid container spacing={2}>
      <Grid item xs={12} md={6}>
        <TextField
          label="Макс. контактов на профиль в час"
          type="number"
          fullWidth
          value={form.maxContactsPerProfilePerHour ?? ''}
          onChange={(e) => onChange('maxContactsPerProfilePerHour', e.target.value === '' ? undefined : Number(e.target.value))}
        />
      </Grid>
      <Grid item xs={12} md={6}>
        <TextField
          label="Макс. контактов на профиль в день"
          type="number"
          fullWidth
          value={form.maxContactsPerProfilePerDay ?? ''}
          onChange={(e) => onChange('maxContactsPerProfilePerDay', e.target.value === '' ? undefined : Number(e.target.value))}
        />
      </Grid>
    </Grid>
  );
}

export default LimitsForm;


