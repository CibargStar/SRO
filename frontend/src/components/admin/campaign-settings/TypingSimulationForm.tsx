import React from 'react';
import { Grid, FormControlLabel, Switch, Typography } from '@mui/material';
import { StyledTextField } from '@/components/common';
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
          label={<Typography sx={{ color: '#f5f5f5' }}>Имитация набора</Typography>}
        />
      </Grid>
      <Grid item xs={12} md={6}>
        <StyledTextField
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



