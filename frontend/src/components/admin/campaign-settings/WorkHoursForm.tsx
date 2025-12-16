import React from 'react';
import { Grid, Typography, Stack, Chip } from '@mui/material';
import { StyledTextField } from '@/components/common';
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
        <StyledTextField
          label="Старт рабочего времени (HH:mm)"
          fullWidth
          value={form.defaultWorkHoursStart ?? ''}
          onChange={(e) => onChange('defaultWorkHoursStart', e.target.value || undefined)}
        />
      </Grid>
      <Grid item xs={12} md={6}>
        <StyledTextField
          label="Конец рабочего времени (HH:mm)"
          fullWidth
          value={form.defaultWorkHoursEnd ?? ''}
          onChange={(e) => onChange('defaultWorkHoursEnd', e.target.value || undefined)}
        />
      </Grid>
      <Grid item xs={12}>
        <Typography variant="subtitle2" sx={{ color: 'rgba(255, 255, 255, 0.7)', mb: 1.5, fontWeight: 500 }}>
          Рабочие дни
        </Typography>
        <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
          {WEEK_DAYS.map((d) => {
            const active = selected.includes(d.value);
            return (
              <Chip
                key={d.value}
                label={d.label}
                onClick={() => toggleDay(d.value)}
                sx={{
                  cursor: 'pointer',
                  backgroundColor: active ? 'rgba(99, 102, 241, 0.2)' : 'rgba(255, 255, 255, 0.08)',
                  color: active ? '#818cf8' : 'rgba(255, 255, 255, 0.7)',
                  border: active ? '1px solid rgba(99, 102, 241, 0.4)' : '1px solid rgba(255, 255, 255, 0.12)',
                  '&:hover': {
                    backgroundColor: active ? 'rgba(99, 102, 241, 0.3)' : 'rgba(255, 255, 255, 0.12)',
                  },
                }}
              />
            );
          })}
        </Stack>
      </Grid>
    </Grid>
  );
}

export default WorkHoursForm;



