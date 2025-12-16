import React, { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Alert,
  CircularProgress,
  Divider,
} from '@mui/material';
import { StyledButton } from '@/components/common';
import { LOADING_ICON_SIZE } from '@/components/common/Constants';
import {
  useCampaignSettings,
  useUpdateCampaignSettings,
} from '@/hooks/useCampaignSettings';
import type { CampaignGlobalSettings, UpdateGlobalSettingsInput } from '@/types/campaign';
import { PauseModeSelector } from '@/components/admin/campaign-settings/PauseModeSelector';
import { TimingsForm } from '@/components/admin/campaign-settings/TimingsForm';
import { LimitsForm } from '@/components/admin/campaign-settings/LimitsForm';
import { WorkHoursForm } from '@/components/admin/campaign-settings/WorkHoursForm';
import { TypingSimulationForm } from '@/components/admin/campaign-settings/TypingSimulationForm';
import { ErrorHandlingForm } from '@/components/admin/campaign-settings/ErrorHandlingForm';
import { MonitoringForm } from '@/components/admin/campaign-settings/MonitoringForm';
import { StorageForm } from '@/components/admin/campaign-settings/StorageForm';
import { WarmupForm } from '@/components/admin/campaign-settings/WarmupForm';

export function CampaignSettingsAdminPage() {
  const { data, isLoading, error } = useCampaignSettings();
  const updateMutation = useUpdateCampaignSettings();

  const [form, setForm] = useState<UpdateGlobalSettingsInput>({});

  useEffect(() => {
    if (data) {
      setForm({
        pauseMode: data.pauseMode,
        minDelayBetweenContactsMs: data.minDelayBetweenContactsMs,
        maxDelayBetweenContactsMs: data.maxDelayBetweenContactsMs,
        minDelayBetweenMessagesMs: data.minDelayBetweenMessagesMs,
        maxDelayBetweenMessagesMs: data.maxDelayBetweenMessagesMs,
        maxContactsPerProfilePerHour: data.maxContactsPerProfilePerHour,
        maxContactsPerProfilePerDay: data.maxContactsPerProfilePerDay,
        defaultWorkHoursStart: data.defaultWorkHoursStart,
        defaultWorkHoursEnd: data.defaultWorkHoursEnd,
        defaultWorkDays: data.defaultWorkDays,
        typingSimulationEnabled: data.typingSimulationEnabled,
        typingSpeedCharsPerSec: data.typingSpeedCharsPerSec,
        maxRetriesOnError: data.maxRetriesOnError,
        retryDelayMs: data.retryDelayMs,
        pauseOnCriticalError: data.pauseOnCriticalError,
        profileHealthCheckIntervalMs: data.profileHealthCheckIntervalMs,
        autoResumeAfterRestart: data.autoResumeAfterRestart,
        keepCompletedCampaignsDays: data.keepCompletedCampaignsDays,
        warmupEnabled: data.warmupEnabled,
        warmupDay1To3Limit: data.warmupDay1To3Limit,
        warmupDay4To7Limit: data.warmupDay4To7Limit,
      });
    }
  }, [data]);

  const handleFieldChange = <K extends keyof UpdateGlobalSettingsInput>(key: K, value: UpdateGlobalSettingsInput[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const isSaving = updateMutation.isPending;

  const handleSave = () => {
    updateMutation.mutate(form);
  };

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ maxWidth: 1200, mx: 'auto', p: 3 }}>
        <Alert 
          severity="error"
          sx={{
            borderRadius: '12px',
            backgroundColor: 'rgba(244, 67, 54, 0.1)',
            color: '#f44336',
            border: '1px solid rgba(244, 67, 54, 0.2)',
          }}
        >
          Ошибка загрузки настроек: {error.message}
        </Alert>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        width: '100%',
        overflowY: 'auto',
        '&::-webkit-scrollbar': {
          display: 'none',
          width: 0,
          height: 0,
        },
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
        '& *': {
          '&::-webkit-scrollbar': {
            display: 'none',
            width: 0,
            height: 0,
          },
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        },
      }}
    >
      <Box sx={{ maxWidth: 1200, mx: 'auto', p: 3 }}>
        <Typography variant="h4" component="h1" sx={{ color: '#f5f5f5', fontWeight: 500, mb: 3 }}>
          Настройки рассылок (ROOT)
        </Typography>

        <Paper sx={{ p: 3.5, backgroundColor: 'rgba(255, 255, 255, 0.06)', borderRadius: '16px', border: 'none' }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <Box>
              <Typography variant="h6" sx={{ color: '#f5f5f5', fontWeight: 500, mb: 2, fontSize: '1.1rem' }}>
                Режим паузы
              </Typography>
              <PauseModeSelector value={form.pauseMode as 1 | 2 | undefined} onChange={handleFieldChange} />
            </Box>

            <Divider sx={{ borderColor: 'rgba(255, 255, 255, 0.08)' }} />

            <Box>
              <Typography variant="h6" sx={{ color: '#f5f5f5', fontWeight: 500, mb: 2, fontSize: '1.1rem' }}>
                Задержки
              </Typography>
              <TimingsForm form={form} onChange={handleFieldChange} />
            </Box>

            <Divider sx={{ borderColor: 'rgba(255, 255, 255, 0.08)' }} />

            <Box>
              <Typography variant="h6" sx={{ color: '#f5f5f5', fontWeight: 500, mb: 2, fontSize: '1.1rem' }}>
                Лимиты
              </Typography>
              <LimitsForm form={form} onChange={handleFieldChange} />
            </Box>

            <Divider sx={{ borderColor: 'rgba(255, 255, 255, 0.08)' }} />

            <Box>
              <Typography variant="h6" sx={{ color: '#f5f5f5', fontWeight: 500, mb: 2, fontSize: '1.1rem' }}>
                Рабочие часы
              </Typography>
              <WorkHoursForm form={form} onChange={handleFieldChange} />
            </Box>

            <Divider sx={{ borderColor: 'rgba(255, 255, 255, 0.08)' }} />

            <Box>
              <Typography variant="h6" sx={{ color: '#f5f5f5', fontWeight: 500, mb: 2, fontSize: '1.1rem' }}>
                Симуляция печати
              </Typography>
              <TypingSimulationForm form={form} onChange={handleFieldChange} />
            </Box>

            <Divider sx={{ borderColor: 'rgba(255, 255, 255, 0.08)' }} />

            <Box>
              <Typography variant="h6" sx={{ color: '#f5f5f5', fontWeight: 500, mb: 2, fontSize: '1.1rem' }}>
                Обработка ошибок
              </Typography>
              <ErrorHandlingForm form={form} onChange={handleFieldChange} />
            </Box>

            <Divider sx={{ borderColor: 'rgba(255, 255, 255, 0.08)' }} />

            <Box>
              <Typography variant="h6" sx={{ color: '#f5f5f5', fontWeight: 500, mb: 2, fontSize: '1.1rem' }}>
                Мониторинг
              </Typography>
              <MonitoringForm form={form} onChange={handleFieldChange} />
            </Box>

            <Divider sx={{ borderColor: 'rgba(255, 255, 255, 0.08)' }} />

            <Box>
              <Typography variant="h6" sx={{ color: '#f5f5f5', fontWeight: 500, mb: 2, fontSize: '1.1rem' }}>
                Хранилище
              </Typography>
              <StorageForm form={form} onChange={handleFieldChange} />
            </Box>

            <Divider sx={{ borderColor: 'rgba(255, 255, 255, 0.08)' }} />

            <Box>
              <Typography variant="h6" sx={{ color: '#f5f5f5', fontWeight: 500, mb: 2, fontSize: '1.1rem' }}>
                Прогрев профилей
              </Typography>
              <WarmupForm form={form} onChange={handleFieldChange} />
            </Box>
          </Box>

          {updateMutation.isError && (
            <Alert 
              severity="error"
              sx={{
                mt: 3,
                borderRadius: '12px',
                backgroundColor: 'rgba(244, 67, 54, 0.1)',
                color: '#f44336',
                border: '1px solid rgba(244, 67, 54, 0.2)',
              }}
            >
              {updateMutation.error instanceof Error
                ? updateMutation.error.message
                : 'Ошибка при сохранении настроек'}
            </Alert>
          )}

          {updateMutation.isSuccess && (
            <Alert 
              severity="success"
              sx={{
                mt: 3,
                borderRadius: '12px',
                backgroundColor: 'rgba(76, 175, 80, 0.15)',
                color: '#4caf50',
                border: '1px solid rgba(76, 175, 80, 0.3)',
              }}
            >
              Настройки успешно сохранены
            </Alert>
          )}

          <Box sx={{ mt: 4, display: 'flex', justifyContent: 'flex-end' }}>
            <StyledButton
              onClick={handleSave}
              disabled={isSaving}
              sx={{ minWidth: 140 }}
            >
              {isSaving ? (
                <CircularProgress size={LOADING_ICON_SIZE} color="inherit" />
              ) : (
                'Сохранить'
              )}
            </StyledButton>
          </Box>
        </Paper>
      </Box>
    </Box>
  );
}

export default CampaignSettingsAdminPage;

