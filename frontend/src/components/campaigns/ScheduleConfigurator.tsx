import React from 'react';
import { Paper, Stack, TextField, Typography } from '@mui/material';
import type { ScheduleConfig } from '@/types/campaign';
import { WorkHoursPicker } from './WorkHoursPicker';
import { WorkDaysPicker } from './WorkDaysPicker';
import { RecurrencePicker } from './RecurrencePicker';

interface ScheduleConfiguratorProps {
  value: ScheduleConfig;
  onChange: (value: ScheduleConfig) => void;
}

export function ScheduleConfigurator({ value, onChange }: ScheduleConfiguratorProps) {
  const update = (patch: Partial<ScheduleConfig>) => onChange({ ...value, ...patch });

  return (
    <Paper
      sx={{
        p: 2,
        backgroundColor: 'rgba(24,24,27,0.9)',
        border: '1px solid rgba(255,255,255,0.05)',
        borderRadius: 2,
      }}
    >
      <Stack spacing={2}>
        <Typography variant="subtitle1" sx={{ color: '#fff' }}>
          Настройки расписания
        </Typography>

        <TextField
          label="Таймзона (IANA)"
          value={value.timezone || 'UTC'}
          onChange={(e) => update({ timezone: e.target.value })}
          fullWidth
        />

        <WorkHoursPicker value={value} onChange={onChange} />

        <WorkDaysPicker value={value} onChange={onChange} />

        <RecurrencePicker value={value} onChange={onChange} />
      </Stack>
    </Paper>
  );
}

export default ScheduleConfigurator;



