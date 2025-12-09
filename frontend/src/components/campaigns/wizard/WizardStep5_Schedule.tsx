import React from 'react';
import { Box } from '@mui/material';
import { Controller, useFormContext } from 'react-hook-form';
import { ScheduleConfigurator } from '../ScheduleConfigurator';
import type { ScheduleConfig } from '@/types/campaign';

export function WizardStep5_Schedule() {
  const { control } = useFormContext();

  return (
    <Box>
      <Controller
        name="scheduleConfig"
        control={control}
        render={({ field }) => (
          <ScheduleConfigurator
            value={(field.value as ScheduleConfig) || {
              workHoursEnabled: false,
              workDaysEnabled: false,
              workDays: [1, 2, 3, 4, 5],
              recurrence: 'NONE',
              timezone: 'UTC',
            }}
            onChange={field.onChange}
          />
        )}
      />
    </Box>
  );
}

export default WizardStep5_Schedule;



