import React from 'react';
import { Card, CardContent, Grid, Typography } from '@mui/material';

interface StatsCardsProps {
  success: number;
  failed: number;
  skipped: number;
}

export function StatsCards({ success, failed, skipped }: StatsCardsProps) {
  const items = [
    { label: 'Успешно', value: success, color: '#4caf50' },
    { label: 'Ошибки', value: failed, color: '#f44336' },
    { label: 'Пропущено', value: skipped, color: '#ffb74d' },
  ];

  return (
    <Grid container spacing={1.5}>
      {items.map((item) => (
        <Grid item xs={12} sm={4} key={item.label}>
          <Card sx={{ 
            backgroundColor: 'rgba(255,255,255,0.05)', 
            borderRadius: '12px',
            border: 'none',
          }}>
            <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', display: 'block', mb: 0.5 }}>
                {item.label}
              </Typography>
              <Typography variant="h6" sx={{ color: item.color, fontWeight: 600 }}>
                {item.value}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      ))}
    </Grid>
  );
}

export default StatsCards;




