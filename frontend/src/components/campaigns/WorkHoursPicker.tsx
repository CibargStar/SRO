import React from 'react';
import { FormControlLabel, Switch, Stack, TextField } from '@mui/material';
import type { ScheduleConfig } from '@/types/campaign';

interface WorkHoursPickerProps {
  value: ScheduleConfig;
  onChange: (value: ScheduleConfig) => void;
}

export function WorkHoursPicker({ value, onChange }: WorkHoursPickerProps) {
  const update = (patch: Partial<ScheduleConfig>) => onChange({ ...value, ...patch });

  return (
    <Stack spacing={1.5}>
      <FormControlLabel
        control={
          <Switch
            checked={value.workHoursEnabled ?? false}
            onChange={(e) => update({ workHoursEnabled: e.target.checked })}
          />
        }
        label="Ограничить отправку рабочими часами"
      />

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
        <TextField
          label="Начало"
          type="time"
          InputLabelProps={{ shrink: true }}
          value={value.workHoursStart || '09:00'}
          onChange={(e) => update({ workHoursStart: e.target.value })}
          disabled={!value.workHoursEnabled}
          fullWidth
        />
        <TextField
          label="Окончание"
          type="time"
          InputLabelProps={{ shrink: true }}
          value={value.workHoursEnd || '18:00'}
          onChange={(e) => update({ workHoursEnd: e.target.value })}
          disabled={!value.workHoursEnabled}
          fullWidth
        />
      </Stack>
    </Stack>
  );
}

export default WorkHoursPicker;



