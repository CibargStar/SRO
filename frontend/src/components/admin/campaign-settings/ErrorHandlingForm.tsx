import React from 'react';
import { Grid, FormControlLabel, Switch, Typography } from '@mui/material';
import { StyledTextField } from '@/components/common';
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
        <StyledTextField
          label="Макс. ретраев при ошибке"
          type="number"
          fullWidth
          value={form.maxRetriesOnError ?? ''}
          onChange={(e) => onChange('maxRetriesOnError', e.target.value === '' ? undefined : Number(e.target.value))}
        />
      </Grid>
      <Grid item xs={12} md={4}>
        <StyledTextField
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
              sx={{
                '& .MuiSwitch-switchBase.Mui-checked': {
                  color: '#6366f1',
                },
                '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                  backgroundColor: '#6366f1',
                },
              }}
            />
          }
          label={<Typography sx={{ color: '#f5f5f5' }}>Останавливать при критической ошибке</Typography>}
        />
      </Grid>
    </Grid>
  );
}

export default ErrorHandlingForm;



