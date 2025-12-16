import React from 'react';
import { Box, Grid, Paper, Stack, Typography } from '@mui/material';
import type { Campaign, CampaignProgress as Progress } from '@/types/campaign';
import { ProgressBar } from './ProgressBar';
import { ProfilesProgress } from './ProfilesProgress';
import { StatsCards } from './StatsCards';
import { EtaDisplay } from './EtaDisplay';
import { SpeedIndicator } from './SpeedIndicator';

interface CampaignProgressProps {
  campaign: Campaign;
  progress?: Progress | null;
  isLoading?: boolean;
}

/**
 * Комплексный блок отображения прогресса кампании.
 */
export function CampaignProgress({ campaign, progress, isLoading }: CampaignProgressProps) {
  const total = progress?.totalContacts ?? campaign.totalContacts;
  const processed = progress?.processedContacts ?? campaign.processedContacts;
  const success = progress?.successfulContacts ?? campaign.successfulContacts;
  const failed = progress?.failedContacts ?? campaign.failedContacts;
  const skipped = progress?.skippedContacts ?? campaign.skippedContacts;
  const profiles = progress?.profilesProgress ?? (campaign.profiles?.map((p) => ({
    profileId: p.profileId,
    profileName: p.profile?.name || p.profileId,
    status: p.status,
    assignedCount: p.assignedCount,
    processedCount: p.processedCount,
    successCount: p.successCount,
    failedCount: p.failedCount,
    progressPercent: p.assignedCount > 0 ? Math.round((p.processedCount / p.assignedCount) * 100) : 0,
  })) ?? []);

  return (
    <Paper
      sx={{
        p: 3.5,
        backgroundColor: 'rgba(255, 255, 255, 0.06)',
        borderRadius: '16px',
        border: 'none',
      }}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Typography variant="h6" sx={{ color: '#f5f5f5', fontWeight: 500 }}>
          Прогресс кампании
        </Typography>
        {isLoading && (
          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.6)' }}>
            Обновление...
          </Typography>
        )}
      </Stack>

      <Grid container spacing={3}>
        <Grid item xs={12} md={7}>
          <ProgressBar total={total} processed={processed} success={success} failed={failed} skipped={skipped} />
          <Box sx={{ mt: 2 }}>
            <ProfilesProgress profiles={profiles} />
          </Box>
        </Grid>
        <Grid item xs={12} md={5}>
          <Stack spacing={2}>
            <StatsCards success={success} failed={failed} skipped={skipped} />
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <SpeedIndicator contactsPerMinute={progress?.contactsPerMinute ?? 0} />
              <EtaDisplay
                estimatedSecondsRemaining={progress?.estimatedSecondsRemaining ?? null}
                estimatedCompletionTime={progress?.estimatedCompletionTime ?? null}
                startedAt={progress?.startedAt ?? campaign.startedAt}
              />
            </Stack>
          </Stack>
        </Grid>
      </Grid>
    </Paper>
  );
}

export default CampaignProgress;




