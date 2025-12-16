import React from 'react';
import { Grid, FormControlLabel, Switch, Typography } from '@mui/material';
import { StyledTextField } from '@/components/common';
import type { UpdateGlobalSettingsInput } from '@/types/campaign';

type OnChange = <K extends keyof UpdateGlobalSettingsInput>(key: K, value: UpdateGlobalSettingsInput[K]) => void;

interface Props {
  form: UpdateGlobalSettingsInput;
  onChange: OnChange;
}

export function WarmupForm({ form, onChange }: Props) {
  return (
    <Grid container spacing={2}>
      <Grid item xs={12} md={4}>
        <FormControlLabel
          control={
            <Switch
              checked={form.warmupEnabled ?? false}
              onChange={(_, checked) => onChange('warmupEnabled', checked)}
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
          label={<Typography sx={{ color: '#f5f5f5' }}>Прогрев профилей</Typography>}
        />
      </Grid>
      <Grid item xs={12} md={4}>
        <StyledTextField
          label="Лимит прогрева день 1-3"
          type="number"
          fullWidth
          value={form.warmupDay1To3Limit ?? ''}
          onChange={(e) => onChange('warmupDay1To3Limit', e.target.value === '' ? undefined : Number(e.target.value))}
        />
      </Grid>
      <Grid item xs={12} md={4}>
        <StyledTextField
          label="Лимит прогрева день 4-7"
          type="number"
          fullWidth
          value={form.warmupDay4To7Limit ?? ''}
          onChange={(e) => onChange('warmupDay4To7Limit', e.target.value === '' ? undefined : Number(e.target.value))}
        />
      </Grid>
    </Grid>
  );
}

export default WarmupForm;



