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
        const statusColor = 
          p.status === 'COMPLETED' ? '#4caf50' :
          p.status === 'RUNNING' ? '#6366f1' :
          p.status === 'ERROR' ? '#f44336' : 'rgba(255, 255, 255, 0.5)';
        return (
          <Box 
            key={p.profileId}
            sx={{
              p: 1.5,
              backgroundColor: 'rgba(255, 255, 255, 0.03)',
              borderRadius: '12px',
            }}
          >
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.75 }}>
              <Typography variant="subtitle2" sx={{ color: '#f5f5f5', fontWeight: 500 }}>{p.profileName}</Typography>
              <Chip
                size="small"
                label={CAMPAIGN_PROFILE_STATUS_LABELS[p.status]}
                sx={{
                  backgroundColor:
                    p.status === 'COMPLETED' ? 'rgba(76, 175, 80, 0.2)' :
                    p.status === 'RUNNING' ? 'rgba(99, 102, 241, 0.2)' :
                    p.status === 'ERROR' ? 'rgba(244, 67, 54, 0.2)' : 'rgba(255, 255, 255, 0.08)',
                  color: statusColor,
                  border: '1px solid',
                  borderColor:
                    p.status === 'COMPLETED' ? 'rgba(76, 175, 80, 0.4)' :
                    p.status === 'RUNNING' ? 'rgba(99, 102, 241, 0.4)' :
                    p.status === 'ERROR' ? 'rgba(244, 67, 54, 0.4)' : 'rgba(255, 255, 255, 0.12)',
                }}
              />
            </Stack>
            <LinearProgress
              variant="determinate"
              value={percent}
              sx={{
                height: 8,
                borderRadius: '8px',
                backgroundColor: 'rgba(255,255,255,0.1)',
                '& .MuiLinearProgress-bar': { 
                  borderRadius: '8px',
                  backgroundColor: '#6366f1',
                },
              }}
            />
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)', mt: 0.5, display: 'block' }}>
              {p.processedCount} / {p.assignedCount} (успешно {p.successCount}, ошибки {p.failedCount})
            </Typography>
          </Box>
        );
      })}
    </Stack>
  );
}

export default ProfilesProgress;




