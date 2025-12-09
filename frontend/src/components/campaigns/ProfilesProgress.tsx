import React from 'react';
import { Box, LinearProgress, Stack, Typography, Chip } from '@mui/material';
import type { CampaignProgress } from '@/types/campaign';
import { CAMPAIGN_PROFILE_STATUS_LABELS, CAMPAIGN_PROFILE_STATUS_COLORS } from '@/types/campaign';

interface ProfilesProgressProps {
  profiles: CampaignProgress['profilesProgress'];
}

export function ProfilesProgress({ profiles }: ProfilesProgressProps) {
  if (!profiles?.length) {
    return (
      <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.6)' }}>
        Профили не назначены.
      </Typography>
    );
  }

  return (
    <Stack spacing={1.5}>
      {profiles.map((p) => {
        const percent = p.assignedCount > 0 ? Math.min(100, Math.round((p.processedCount / p.assignedCount) * 100)) : 0;
        return (
          <Box key={p.profileId}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.25 }}>
              <Typography variant="subtitle2" sx={{ color: '#fff' }}>{p.profileName}</Typography>
              <Chip
                size="small"
                label={CAMPAIGN_PROFILE_STATUS_LABELS[p.status]}
                color={CAMPAIGN_PROFILE_STATUS_COLORS[p.status]}
                variant="outlined"
              />
            </Stack>
            <LinearProgress
              variant="determinate"
              value={percent}
              sx={{
                height: 8,
                borderRadius: 1,
                backgroundColor: 'rgba(255,255,255,0.08)',
                '& .MuiLinearProgress-bar': { borderRadius: 1 },
              }}
            />
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)' }}>
              {p.processedCount} / {p.assignedCount} (успешно {p.successCount}, ошибки {p.failedCount})
            </Typography>
          </Box>
        );
      })}
    </Stack>
  );
}

export default ProfilesProgress;



