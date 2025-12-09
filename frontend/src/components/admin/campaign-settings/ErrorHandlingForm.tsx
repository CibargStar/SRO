import React from 'react';
import { Grid, TextField, FormControlLabel, Switch } from '@mui/material';
import type { UpdateGlobalSettingsInput } from '@/types/campaign';

type OnChange = <K extends keyof UpdateGlobalSettingsInput>(key: K, value: UpdateGlobalSettingsInput[K]) => void;

interface Props {
  form: UpdateGlobalSettingsInput;
  onChange: OnChange;
}

export function ErrorHandlingForm({ form, onChange }: Props) {
  return (
    <Grid container spacing={2}>
      <Grid item xs={12} md={4}>
        <TextField
          label="Макс. ретраев при ошибке"
          type="number"
          fullWidth
          value={form.maxRetriesOnError ?? ''}
          onChange={(e) => onChange('maxRetriesOnError', e.target.value === '' ? undefined : Number(e.target.value))}
        />
      </Grid>
      <Grid item xs={12} md={4}>
        <TextField
          label="Пауза между ретраями (мс)"
          type="number"
          fullWidth
          value={form.retryDelayMs ?? ''}
          onChange={(e) => onChange('retryDelayMs', e.target.value === '' ? undefined : Number(e.target.value))}
        />
      </Grid>
      <Grid item xs={12} md={4}>
        <FormControlLabel
          control={
            <Switch
              checked={form.pauseOnCriticalError ?? false}
              onChange={(_, checked) => onChange('pauseOnCriticalError', checked)}
            />
          }
          label="Останавливать при критической ошибке"
        />
      </Grid>
    </Grid>
  );
}

export default ErrorHandlingForm;


