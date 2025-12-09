import React from 'react';
import { FormControl, InputLabel, MenuItem, Select, Stack, TextField } from '@mui/material';
import type { ScheduleConfig, RecurrenceType } from '@/types/campaign';

interface RecurrencePickerProps {
  value: ScheduleConfig;
  onChange: (value: ScheduleConfig) => void;
}

const RECURRENCE_OPTIONS: { value: RecurrenceType; label: string }[] = [
  { value: 'NONE', label: 'Без повтора' },
  { value: 'DAILY', label: 'Ежедневно' },
  { value: 'WEEKLY', label: 'Еженедельно' },
  { value: 'MONTHLY', label: 'Ежемесячно' },
];

export function RecurrencePicker({ value, onChange }: RecurrencePickerProps) {
  const update = (patch: Partial<ScheduleConfig>) => onChange({ ...value, ...patch });

  return (
    <Stack spacing={1.5}>
      <FormControl fullWidth>
        <InputLabel>Периодичность</InputLabel>
        <Select
          label="Периодичность"
          value={value.recurrence || 'NONE'}
          onChange={(e) => update({ recurrence: e.target.value as RecurrenceType })}
        >
          {RECURRENCE_OPTIONS.map((opt) => (
            <MenuItem key={opt.value} value={opt.value}>
              {opt.label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {value.recurrence && value.recurrence !== 'NONE' && (
        <TextField
          label="Дата окончания (опционально)"
          type="date"
          InputLabelProps={{ shrink: true }}
          value={value.recurrenceEndDate || ''}
          onChange={(e) => update({ recurrenceEndDate: e.target.value || undefined })}
          fullWidth
        />
      )}
    </Stack>
  );
}

export default RecurrencePicker;



