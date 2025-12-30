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
    <Stack spacing={1.5}>
      <FormControlLabel
        control={
          <Checkbox
            checked={value.workDaysEnabled ?? false}
            onChange={(e) => onChange({ ...value, workDaysEnabled: e.target.checked })}
            sx={{
              color: '#6366f1',
              '&.Mui-checked': {
                color: '#6366f1',
              },
            }}
          />
        }
        label={<Typography sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>Ограничить отправку рабочими днями</Typography>}
      />

      {value.workDaysEnabled && (
        <>
          <Grid container spacing={1.5}>
            {DAYS.map((day) => (
              <Grid item key={day.value}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={value.workDays?.includes(day.value) ?? false}
                      onChange={(e) => updateDays(day.value, e.target.checked)}
                      size="small"
                      sx={{
                        color: '#6366f1',
                        '&.Mui-checked': {
                          color: '#6366f1',
                        },
                      }}
                    />
                  }
                  label={<Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>{day.label}</Typography>}
                />
              </Grid>
            ))}
          </Grid>
          {(!value.workDays || value.workDays.length === 0) && (
            <Typography variant="caption" sx={{ color: '#f44336', mt: 0.5, display: 'block' }}>
              Необходимо выбрать хотя бы один день
            </Typography>
          )}
        </>
      )}
    </Stack>
  );
}

export default WorkDaysPicker;




