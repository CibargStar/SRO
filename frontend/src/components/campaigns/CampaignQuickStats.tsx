import React from 'react';
import { Box, Stack, Typography } from '@mui/material';
import type { Campaign } from '@/types/campaign';

interface CampaignQuickStatsProps {
  campaign: Campaign;
}

/**
 * Мини-статистика для карточки кампании: успешные, ошибки, пропущенные.
 */
export function CampaignQuickStats({ campaign }: CampaignQuickStatsProps) {
  return (
    <Stack direction="row" spacing={2} sx={{ mb: 1 }}>
      <Box>
        <Typography variant="caption" color="text.secondary" display="block">
          Успешно
        </Typography>
        <Typography variant="body2" color="success.main" fontWeight="medium">
          {campaign.successfulContacts}
        </Typography>
      </Box>
      <Box>
        <Typography variant="caption" color="text.secondary" display="block">
          Ошибки
        </Typography>
        <Typography variant="body2" color="error.main" fontWeight="medium">
          {campaign.failedContacts}
        </Typography>
      </Box>
      <Box>
        <Typography variant="caption" color="text.secondary" display="block">
          Пропущено
        </Typography>
        <Typography variant="body2" color="warning.main" fontWeight="medium">
          {campaign.skippedContacts}
        </Typography>
      </Box>
    </Stack>
  );
}

export default CampaignQuickStats;



