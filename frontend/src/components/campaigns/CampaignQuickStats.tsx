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
    <Stack 
      direction="row" 
      spacing={2} 
      sx={{ 
        p: 1.5,
        backgroundColor: 'rgba(255, 255, 255, 0.03)',
        borderRadius: '12px',
      }}
    >
      <Box sx={{ flex: 1, textAlign: 'center' }}>
        <Typography 
          variant="caption" 
          sx={{ 
            color: 'rgba(255, 255, 255, 0.5)',
            fontSize: '0.7rem',
            display: 'block',
            mb: 0.5,
          }}
        >
          Успешно
        </Typography>
        <Typography 
          variant="h6" 
          sx={{ 
            color: '#4caf50',
            fontWeight: 600,
            fontSize: '1.25rem',
          }}
        >
          {campaign.successfulContacts}
        </Typography>
      </Box>
      <Box sx={{ flex: 1, textAlign: 'center' }}>
        <Typography 
          variant="caption" 
          sx={{ 
            color: 'rgba(255, 255, 255, 0.5)',
            fontSize: '0.7rem',
            display: 'block',
            mb: 0.5,
          }}
        >
          Ошибки
        </Typography>
        <Typography 
          variant="h6" 
          sx={{ 
            color: '#f44336',
            fontWeight: 600,
            fontSize: '1.25rem',
          }}
        >
          {campaign.failedContacts}
        </Typography>
      </Box>
      <Box sx={{ flex: 1, textAlign: 'center' }}>
        <Typography 
          variant="caption" 
          sx={{ 
            color: 'rgba(255, 255, 255, 0.5)',
            fontSize: '0.7rem',
            display: 'block',
            mb: 0.5,
          }}
        >
          Пропущено
        </Typography>
        <Typography 
          variant="h6" 
          sx={{ 
            color: '#ff9800',
            fontWeight: 600,
            fontSize: '1.25rem',
          }}
        >
          {campaign.skippedContacts}
        </Typography>
      </Box>
    </Stack>
  );
}

export default CampaignQuickStats;




