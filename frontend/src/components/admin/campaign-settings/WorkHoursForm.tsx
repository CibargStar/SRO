import React from 'react';
import { Grid, TextField, Typography, Stack, Chip } from '@mui/material';
import type { UpdateGlobalSettingsInput } from '@/types/campaign';

type OnChange = <K extends keyof UpdateGlobalSettingsInput>(key: K, value: UpdateGlobalSettingsInput[K]) => void;

const WEEK_DAYS: { value: number; label: string }[] = [
  { value: 1, label: 'Пн' },
  { value: 2, label: 'Вт' },
  { value: 3, label: 'Ср' },
  { value: 4, label: 'Чт' },
  { value: 5, label: 'Пт' },
  { value: 6, label: 'Сб' },
  { value: 7, label: 'Вс' },
];

interface Props {
  form: UpdateGlobalSettingsInput;
  onChange: OnChange;
}

export function WorkHoursForm({ form, onChange }: Props) {
  const selected = form.defaultWorkDays ?? [];

  const toggleDay = (day: number) => {
    const exists = selected.includes(day);
    const next = exists ? selected.filter((d) => d !== day) : [...selected, day];
    onChange('defaultWorkDays', next.sort((a, b) => a - b));
  };

  return (
    <Grid container spacing={2}>
      <Grid item xs={12} md={6}>
        <TextField
          label="Старт рабочего времени (HH:mm)"
          fullWidth
          value={form.defaultWorkHoursStart ?? ''}
          onChange={(e) => onChange('defaultWorkHoursStart', e.target.value || undefined)}
        />
      </Grid>
      <Grid item xs={12} md={6}>
        <TextField
          label="Конец рабочего времени (HH:mm)"
          fullWidth
          value={form.defaultWorkHoursEnd ?? ''}
          onChange={(e) => onChange('defaultWorkHoursEnd', e.target.value || undefined)}
        />
      </Grid>
      <Grid item xs={12}>
        <Typography variant="subtitle2" gutterBottom>
          Рабочие дни
        </Typography>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          {WEEK_DAYS.map((d) => {
            const active = selected.includes(d.value);
            return (
              <Chip
                key={d.value}
                label={d.label}
                color={active ? 'primary' : 'default'}
                variant={active ? 'filled' : 'outlined'}
                onClick={() => toggleDay(d.value)}
                sx={{ cursor: 'pointer' }}
              />
            );
          })}
        </Stack>
      </Grid>
    </Grid>
  );
}

export default WorkHoursForm;


