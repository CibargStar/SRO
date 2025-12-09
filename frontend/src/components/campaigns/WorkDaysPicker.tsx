import React from 'react';
import { FormControlLabel, Checkbox, Grid, Typography, Stack } from '@mui/material';
import type { ScheduleConfig } from '@/types/campaign';

const DAYS = [
  { value: 1, label: 'Пн' },
  { value: 2, label: 'Вт' },
  { value: 3, label: 'Ср' },
  { value: 4, label: 'Чт' },
  { value: 5, label: 'Пт' },
  { value: 6, label: 'Сб' },
  { value: 0, label: 'Вс' },
];

interface WorkDaysPickerProps {
  value: ScheduleConfig;
  onChange: (value: ScheduleConfig) => void;
}

export function WorkDaysPicker({ value, onChange }: WorkDaysPickerProps) {
  const updateDays = (day: number, checked: boolean) => {
    const current = value.workDays ?? [];
    const next = checked ? [...current, day] : current.filter((d) => d !== day);
    onChange({ ...value, workDays: next });
  };

  return (
    <Stack spacing={1}>
      <FormControlLabel
        control={
          <Checkbox
            checked={value.workDaysEnabled ?? false}
            onChange={(e) => onChange({ ...value, workDaysEnabled: e.target.checked })}
          />
        }
        label="Ограничить отправку рабочими днями"
      />

      <Grid container spacing={1}>
        {DAYS.map((day) => (
          <Grid item key={day.value}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={value.workDays?.includes(day.value) ?? false}
                  onChange={(e) => updateDays(day.value, e.target.checked)}
                  disabled={!value.workDaysEnabled}
                  size="small"
                />
              }
              label={<Typography variant="body2">{day.label}</Typography>}
            />
          </Grid>
        ))}
      </Grid>
    </Stack>
  );
}

export default WorkDaysPicker;



