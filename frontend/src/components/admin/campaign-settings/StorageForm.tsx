import React from 'react';
import { Grid, TextField } from '@mui/material';
import type { UpdateGlobalSettingsInput } from '@/types/campaign';

type OnChange = <K extends keyof UpdateGlobalSettingsInput>(key: K, value: UpdateGlobalSettingsInput[K]) => void;

interface Props {
  form: UpdateGlobalSettingsInput;
  onChange: OnChange;
}

export function StorageForm({ form, onChange }: Props) {
  return (
    <Grid container spacing={2}>
      <Grid item xs={12} md={6}>
        <TextField
          label="Хранение завершенных кампаний (дней)"
          type="number"
          fullWidth
          value={form.keepCompletedCampaignsDays ?? ''}
          onChange={(e) => onChange('keepCompletedCampaignsDays', e.target.value === '' ? undefined : Number(e.target.value))}
        />
      </Grid>
    </Grid>
  );
}

export default StorageForm;


