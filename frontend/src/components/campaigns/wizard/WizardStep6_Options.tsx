import React from 'react';
import { Stack, Typography, FormControlLabel, Checkbox, Divider, Box } from '@mui/material';
import { Controller, useFormContext } from 'react-hook-form';
import { StyledTextField } from '@/components/common';
import type { OptionsConfig } from '@/types/campaign';

export function WizardStep6_Options() {
  const { control } = useFormContext();

  return (
    <Stack spacing={3}>
      <Typography variant="subtitle2" sx={{ color: '#f5f5f5', fontWeight: 500 }}>
        Дедупликация и паузы
      </Typography>
      <Controller
        name="optionsConfig"
        control={control}
        render={({ field }) => {
          const val = (field.value as OptionsConfig) || {};
          const update = (patch: Partial<OptionsConfig>) => field.onChange({ ...val, ...patch });
          return (
            <Stack spacing={3}>
              {/* Дедупликация */}
              <Box>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={val.deduplicationEnabled ?? false}
                      onChange={(e) => update({ deduplicationEnabled: e.target.checked })}
                      sx={{
                        color: '#6366f1',
                        '&.Mui-checked': {
                          color: '#6366f1',
                        },
                      }}
                    />
                  }
                  label={<Typography sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>Включить дедупликацию</Typography>}
                />
                {val.deduplicationEnabled && (
                  <Box sx={{ mt: 2 }}>
                    <StyledTextField
                      label="Период дедупликации (дней)"
                      type="number"
                      value={val.deduplicationPeriodDays ?? ''}
                      onChange={(e) => update({ deduplicationPeriodDays: e.target.value ? Number(e.target.value) : undefined })}
                      fullWidth
                    />
                  </Box>
                )}
              </Box>

              <Divider sx={{ borderColor: 'rgba(255, 255, 255, 0.08)' }} />

              {/* Cooldown */}
              <Box>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={val.cooldownEnabled ?? false}
                      onChange={(e) => update({ cooldownEnabled: e.target.checked })}
                      sx={{
                        color: '#6366f1',
                        '&.Mui-checked': {
                          color: '#6366f1',
                        },
                      }}
                    />
                  }
                  label={<Typography sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>Включить cooldown между кампаниями</Typography>}
                />
                {val.cooldownEnabled && (
                  <Box sx={{ mt: 2 }}>
                    <StyledTextField
                      label="Cooldown (минут)"
                      type="number"
                      value={val.cooldownMinutes ?? ''}
                      onChange={(e) => update({ cooldownMinutes: e.target.value ? Number(e.target.value) : undefined })}
                      fullWidth
                    />
                  </Box>
                )}
              </Box>

              <Divider sx={{ borderColor: 'rgba(255, 255, 255, 0.08)' }} />

              {/* Warmup */}
              <Box>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={val.warmupEnabled ?? false}
                      onChange={(e) => update({ warmupEnabled: e.target.checked })}
                      sx={{
                        color: '#6366f1',
                        '&.Mui-checked': {
                          color: '#6366f1',
                        },
                      }}
                    />
                  }
                  label={<Typography sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>Включить прогрев (warmup)</Typography>}
                />
                {val.warmupEnabled && (
                  <Box sx={{ mt: 2 }}>
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                      <StyledTextField
                        label="Стартовое значение (контактов/мин)"
                        type="number"
                        value={val.warmupStartRate ?? ''}
                        onChange={(e) => update({ warmupStartRate: e.target.value ? Number(e.target.value) : undefined })}
                        fullWidth
                      />
                      <StyledTextField
                        label="Целевое значение (контактов/мин)"
                        type="number"
                        value={val.warmupTargetRate ?? ''}
                        onChange={(e) => update({ warmupTargetRate: e.target.value ? Number(e.target.value) : undefined })}
                        fullWidth
                      />
                      <StyledTextField
                        label="Длительность (часов)"
                        type="number"
                        value={val.warmupDurationHours ?? ''}
                        onChange={(e) => update({ warmupDurationHours: e.target.value ? Number(e.target.value) : undefined })}
                        fullWidth
                      />
                    </Stack>
                  </Box>
                )}
              </Box>

              <Divider sx={{ borderColor: 'rgba(255, 255, 255, 0.08)' }} />

              {/* Остановка при ошибках */}
              <Box>
                <Typography variant="subtitle2" sx={{ color: '#f5f5f5', fontWeight: 500, mb: 2 }}>
                  Остановка при ошибках
                </Typography>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                  <StyledTextField
                    label="Остановка при N ошибках подряд"
                    type="number"
                    value={val.stopOnConsecutiveErrors ?? ''}
                    onChange={(e) => update({ stopOnConsecutiveErrors: e.target.value ? Number(e.target.value) : undefined })}
                    fullWidth
                  />
                  <StyledTextField
                    label="Остановка при N общих ошибок"
                    type="number"
                    value={val.stopOnErrorThreshold ?? ''}
                    onChange={(e) => update({ stopOnErrorThreshold: e.target.value ? Number(e.target.value) : undefined })}
                    fullWidth
                  />
                </Stack>
              </Box>
            </Stack>
          );
        }}
      />
    </Stack>
  );
}

export default WizardStep6_Options;




