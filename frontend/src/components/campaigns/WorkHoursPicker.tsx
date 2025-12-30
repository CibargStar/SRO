import React from 'react';
import { FormControlLabel, Switch, Stack, Typography } from '@mui/material';
import { StyledTextField } from '@/components/common';
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
        label={<Typography sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>Ограничить отправку рабочими часами</Typography>}
      />

      {value.workHoursEnabled && (
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <StyledTextField
            label="Начало"
            type="time"
            InputLabelProps={{ shrink: true }}
            value={value.workHoursStart || '09:00'}
            onChange={(e) => update({ workHoursStart: e.target.value })}
            required
            fullWidth
            helperText={!value.workHoursStart ? 'Обязательное поле' : undefined}
            error={!value.workHoursStart}
          />
          <StyledTextField
            label="Окончание"
            type="time"
            InputLabelProps={{ shrink: true }}
            value={value.workHoursEnd || '18:00'}
            onChange={(e) => update({ workHoursEnd: e.target.value })}
            required
            fullWidth
            helperText={!value.workHoursEnd ? 'Обязательное поле' : undefined}
            error={!value.workHoursEnd}
          />
        </Stack>
      )}
    </Stack>
  );
}

export default WorkHoursPicker;




