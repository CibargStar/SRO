import React from 'react';
import { Grid, TextField } from '@mui/material';
import type { UpdateGlobalSettingsInput } from '@/types/campaign';

type OnChange = <K extends keyof UpdateGlobalSettingsInput>(key: K, value: UpdateGlobalSettingsInput[K]) => void;

interface Props {
  form: UpdateGlobalSettingsInput;
  onChange: OnChange;
}

export function TimingsForm({ form, onChange }: Props) {
  return (
    <Grid container spacing={2}>
      <Grid item xs={12} md={6}>
        <TextField
          label="Мин. задержка между контактами (мс)"
          type="number"
          fullWidth
          value={form.minDelayBetweenContactsMs ?? ''}
          onChange={(e) => onChange('minDelayBetweenContactsMs', e.target.value === '' ? undefined : Number(e.target.value))}
        />
      </Grid>
      <Grid item xs={12} md={6}>
        <TextField
          label="Макс. задержка между контактами (мс)"
          type="number"
          fullWidth
          value={form.maxDelayBetweenContactsMs ?? ''}
          onChange={(e) => onChange('maxDelayBetweenContactsMs', e.target.value === '' ? undefined : Number(e.target.value))}
        />
      </Grid>
      <Grid item xs={12} md={6}>
        <TextField
          label="Мин. задержка между сообщениями (мс)"
          type="number"
          fullWidth
          value={form.minDelayBetweenMessagesMs ?? ''}
          onChange={(e) => onChange('minDelayBetweenMessagesMs', e.target.value === '' ? undefined : Number(e.target.value))}
        />
      </Grid>
      <Grid item xs={12} md={6}>
        <TextField
          label="Макс. задержка между сообщениями (мс)"
          type="number"
          fullWidth
          value={form.maxDelayBetweenMessagesMs ?? ''}
          onChange={(e) => onChange('maxDelayBetweenMessagesMs', e.target.value === '' ? undefined : Number(e.target.value))}
        />
      </Grid>
    </Grid>
  );
}

export default TimingsForm;


