import React, { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  Alert,
  CircularProgress,
} from '@mui/material';
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
    return <Alert severity="error">Ошибка загрузки настроек: {error.message}</Alert>;
  }

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Настройки рассылок (ROOT)
      </Typography>

      <Paper sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <PauseModeSelector value={form.pauseMode as 1 | 2 | undefined} onChange={handleFieldChange} />
          <TimingsForm form={form} onChange={handleFieldChange} />
          <LimitsForm form={form} onChange={handleFieldChange} />
          <WorkHoursForm form={form} onChange={handleFieldChange} />
          <TypingSimulationForm form={form} onChange={handleFieldChange} />
          <ErrorHandlingForm form={form} onChange={handleFieldChange} />
          <MonitoringForm form={form} onChange={handleFieldChange} />
          <StorageForm form={form} onChange={handleFieldChange} />
          <WarmupForm form={form} onChange={handleFieldChange} />
        </Box>

        <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
          <Button
            variant="contained"
            color="primary"
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? <CircularProgress size={20} /> : 'Сохранить'}
          </Button>
        </Box>
      </Paper>
    </Box>
  );
}

export default CampaignSettingsAdminPage;

