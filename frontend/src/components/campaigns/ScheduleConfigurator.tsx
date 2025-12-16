import React from 'react';
import { Paper, Stack, Typography } from '@mui/material';
import { StyledTextField } from '@/components/common';
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
        p: 2.5,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: '12px',
        border: 'none',
      }}
    >
      <Stack spacing={2.5}>
        <Typography variant="subtitle1" sx={{ color: '#f5f5f5', fontWeight: 500 }}>
          Настройки расписания
        </Typography>

        <StyledTextField
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




