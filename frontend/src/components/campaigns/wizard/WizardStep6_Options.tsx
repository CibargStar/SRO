import React from 'react';
import { Stack, Typography, FormControlLabel, Checkbox, TextField } from '@mui/material';
import { Controller, useFormContext } from 'react-hook-form';
import type { OptionsConfig } from '@/types/campaign';

export function WizardStep6_Options() {
  const { control } = useFormContext();

  return (
    <Stack spacing={2}>
      <Typography variant="subtitle2" sx={{ color: '#fff' }}>
        Дедупликация и паузы
      </Typography>
      <Controller
        name="optionsConfig"
        control={control}
        render={({ field }) => {
          const val = (field.value as OptionsConfig) || {};
          const update = (patch: Partial<OptionsConfig>) => field.onChange({ ...val, ...patch });
          return (
            <Stack spacing={2}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={val.deduplicationEnabled ?? false}
                    onChange={(e) => update({ deduplicationEnabled: e.target.checked })}
                  />
                }
                label="Включить дедупликацию"
              />
              {val.deduplicationEnabled && (
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                  <TextField
                    label="Период дедупликации (дней)"
                    type="number"
                    value={val.deduplicationPeriodDays ?? ''}
                    onChange={(e) => update({ deduplicationPeriodDays: e.target.value ? Number(e.target.value) : undefined })}
                    fullWidth
                  />
                </Stack>
              )}

              <FormControlLabel
                control={
                  <Checkbox
                    checked={val.cooldownEnabled ?? false}
                    onChange={(e) => update({ cooldownEnabled: e.target.checked })}
                  />
                }
                label="Включить cooldown между кампаниями"
              />
              {val.cooldownEnabled && (
                <TextField
                  label="Cooldown (минут)"
                  type="number"
                  value={val.cooldownMinutes ?? ''}
                  onChange={(e) => update({ cooldownMinutes: e.target.value ? Number(e.target.value) : undefined })}
                  fullWidth
                />
              )}

              <FormControlLabel
                control={
                  <Checkbox
                    checked={val.warmupEnabled ?? false}
                    onChange={(e) => update({ warmupEnabled: e.target.checked })}
                  />
                }
                label="Включить прогрев (warmup)"
              />
              {val.warmupEnabled && (
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                  <TextField
                    label="Стартовое значение (контактов/мин)"
                    type="number"
                    value={val.warmupStartRate ?? ''}
                    onChange={(e) => update({ warmupStartRate: e.target.value ? Number(e.target.value) : undefined })}
                    fullWidth
                  />
                  <TextField
                    label="Целевое значение (контактов/мин)"
                    type="number"
                    value={val.warmupTargetRate ?? ''}
                    onChange={(e) => update({ warmupTargetRate: e.target.value ? Number(e.target.value) : undefined })}
                    fullWidth
                  />
                  <TextField
                    label="Длительность (часов)"
                    type="number"
                    value={val.warmupDurationHours ?? ''}
                    onChange={(e) => update({ warmupDurationHours: e.target.value ? Number(e.target.value) : undefined })}
                    fullWidth
                  />
                </Stack>
              )}

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <TextField
                  label="Остановка при N ошибках подряд"
                  type="number"
                  value={val.stopOnConsecutiveErrors ?? ''}
                  onChange={(e) => update({ stopOnConsecutiveErrors: e.target.value ? Number(e.target.value) : undefined })}
                  fullWidth
                />
                <TextField
                  label="Остановка при N общих ошибок"
                  type="number"
                  value={val.stopOnErrorThreshold ?? ''}
                  onChange={(e) => update({ stopOnErrorThreshold: e.target.value ? Number(e.target.value) : undefined })}
                  fullWidth
                />
              </Stack>
            </Stack>
          );
        }}
      />
    </Stack>
  );
}

export default WizardStep6_Options;



