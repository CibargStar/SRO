/**
 * CampaignStatsView.tsx
 * 
 * Компонент для отображения статистики кампании
 */

import React from 'react';
import {
  Box,
  Paper,
  Typography,
  Grid,
  Skeleton,
  Card,
  CardContent,
  LinearProgress,
  Divider,
  Stack,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import {
  CheckCircle as SuccessIcon,
  Error as ErrorIcon,
  Block as SkippedIcon,
  Speed as SpeedIcon,
  Timer as TimerIcon,
  WhatsApp as WhatsAppIcon,
  Telegram as TelegramIcon,
} from '@mui/icons-material';
import type { CampaignStats } from '@/types/campaign';

interface CampaignStatsViewProps {
  stats: CampaignStats | undefined;
  isLoading?: boolean;
}

/**
 * Статистическая карточка
 */
function StatCard({
  title,
  value,
  subtitle,
  icon,
  color = 'primary.main',
}: {
  title: string;
  value: number | string;
  subtitle?: string;
  icon: React.ReactNode;
  color?: string;
}) {
  return (
    <Card variant="outlined" sx={{ height: '100%' }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <Box>
            <Typography variant="caption" color="text.secondary" gutterBottom>
              {title}
            </Typography>
            <Typography variant="h4" fontWeight={600} sx={{ color }}>
              {value}
            </Typography>
            {subtitle && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                {subtitle}
              </Typography>
            )}
          </Box>
          <Box sx={{ color, opacity: 0.8 }}>
            {icon}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}

/**
 * Прогресс-бар с меткой
 */
function ProgressWithLabel({
  value,
  label,
  color,
}: {
  value: number;
  label: string;
  color: 'primary' | 'success' | 'error' | 'warning';
}) {
  return (
    <Box sx={{ mb: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
        <Typography variant="body2">{label}</Typography>
        <Typography variant="body2" fontWeight={500}>
          {value.toFixed(1)}%
        </Typography>
      </Box>
      <LinearProgress variant="determinate" value={value} color={color} />
    </Box>
  );
}

export function CampaignStatsView({ stats, isLoading }: CampaignStatsViewProps) {
  if (isLoading) {
    return (
      <Paper sx={{ p: 3 }}>
        <Skeleton variant="text" width={200} height={32} sx={{ mb: 2 }} />
        <Grid container spacing={2}>
          {[1, 2, 3, 4].map((i) => (
            <Grid item xs={6} sm={3} key={i}>
              <Skeleton variant="rectangular" height={120} />
            </Grid>
          ))}
        </Grid>
      </Paper>
    );
  }

  if (!stats) {
    return (
      <Paper sx={{ p: 3 }}>
        <Typography color="text.secondary">Статистика недоступна</Typography>
      </Paper>
    );
  }

  const formatDuration = (minutes: number | null): string => {
    if (!minutes) return '—';
    if (minutes < 60) return `${minutes.toFixed(0)} мин`;
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return `${hours} ч ${mins} мин`;
  };

  return (
    <Box>
      {/* Основные показатели */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={6} sm={3}>
          <StatCard
            title="Успешно отправлено"
            value={stats.successfulContacts}
            subtitle={`${stats.successRate.toFixed(1)}%`}
            icon={<SuccessIcon sx={{ fontSize: 32 }} />}
            color="success.main"
          />
        </Grid>
        <Grid item xs={6} sm={3}>
          <StatCard
            title="Ошибки"
            value={stats.failedContacts}
            subtitle={`${stats.failureRate.toFixed(1)}%`}
            icon={<ErrorIcon sx={{ fontSize: 32 }} />}
            color="error.main"
          />
        </Grid>
        <Grid item xs={6} sm={3}>
          <StatCard
            title="Пропущено"
            value={stats.skippedContacts}
            subtitle={`${stats.skipRate.toFixed(1)}%`}
            icon={<SkippedIcon sx={{ fontSize: 32 }} />}
            color="warning.main"
          />
        </Grid>
        <Grid item xs={6} sm={3}>
          <StatCard
            title="Время выполнения"
            value={formatDuration(stats.durationMinutes)}
            subtitle={stats.averageContactsPerMinute ? `${stats.averageContactsPerMinute.toFixed(1)} контакт/мин` : undefined}
            icon={<TimerIcon sx={{ fontSize: 32 }} />}
            color="info.main"
          />
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        {/* Статистика по мессенджерам */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2, height: '100%' }}>
            <Typography variant="h6" gutterBottom>
              По мессенджерам
            </Typography>
            
            {/* WhatsApp */}
            <Box sx={{ mb: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <WhatsAppIcon sx={{ color: '#25D366' }} />
                <Typography variant="subtitle2">WhatsApp</Typography>
              </Box>
              <Stack direction="row" spacing={2}>
                <Chip
                  size="small"
                  label={`Отправлено: ${stats.whatsAppStats.sent}`}
                  color="success"
                  variant="outlined"
                />
                <Chip
                  size="small"
                  label={`Ошибки: ${stats.whatsAppStats.failed}`}
                  color="error"
                  variant="outlined"
                />
                <Chip
                  size="small"
                  label={`Пропущено: ${stats.whatsAppStats.skipped}`}
                  color="warning"
                  variant="outlined"
                />
              </Stack>
            </Box>

            {/* Telegram */}
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <TelegramIcon sx={{ color: '#0088cc' }} />
                <Typography variant="subtitle2">Telegram</Typography>
              </Box>
              <Stack direction="row" spacing={2}>
                <Chip
                  size="small"
                  label={`Отправлено: ${stats.telegramStats.sent}`}
                  color="success"
                  variant="outlined"
                />
                <Chip
                  size="small"
                  label={`Ошибки: ${stats.telegramStats.failed}`}
                  color="error"
                  variant="outlined"
                />
                <Chip
                  size="small"
                  label={`Пропущено: ${stats.telegramStats.skipped}`}
                  color="warning"
                  variant="outlined"
                />
              </Stack>
            </Box>
          </Paper>
        </Grid>

        {/* Распределение результатов */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2, height: '100%' }}>
            <Typography variant="h6" gutterBottom>
              Распределение результатов
            </Typography>
            
            <Box sx={{ mt: 2 }}>
              <ProgressWithLabel
                value={stats.successRate}
                label="Успешно"
                color="success"
              />
              <ProgressWithLabel
                value={stats.failureRate}
                label="Ошибки"
                color="error"
              />
              <ProgressWithLabel
                value={stats.skipRate}
                label="Пропущено"
                color="warning"
              />
            </Box>

            <Divider sx={{ my: 2 }} />

            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="body2" color="text.secondary">
                Всего контактов:
              </Typography>
              <Typography variant="body2" fontWeight={500}>
                {stats.totalContacts}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
              <Typography variant="body2" color="text.secondary">
                Обработано:
              </Typography>
              <Typography variant="body2" fontWeight={500}>
                {stats.processedContacts}
              </Typography>
            </Box>
          </Paper>
        </Grid>

        {/* Статистика по профилям */}
        {stats.profileStats && stats.profileStats.length > 0 && (
          <Grid item xs={12}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="h6" gutterBottom>
                По профилям
              </Typography>
              
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Профиль</TableCell>
                      <TableCell align="right">Обработано</TableCell>
                      <TableCell align="right">Успешно</TableCell>
                      <TableCell align="right">Ошибки</TableCell>
                      <TableCell align="right">Успешность</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {stats.profileStats.map((profile) => (
                      <TableRow key={profile.profileId} hover>
                        <TableCell>{profile.profileName}</TableCell>
                        <TableCell align="right">{profile.processed}</TableCell>
                        <TableCell align="right">
                          <Typography color="success.main">{profile.success}</Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography color="error.main">{profile.failed}</Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Chip
                            size="small"
                            label={`${profile.successRate.toFixed(1)}%`}
                            color={profile.successRate >= 80 ? 'success' : profile.successRate >= 50 ? 'warning' : 'error'}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          </Grid>
        )}

        {/* Топ ошибок */}
        {stats.topErrors && stats.topErrors.length > 0 && (
          <Grid item xs={12}>
            <Paper sx={{ p: 2 }}>
              <Typography variant="h6" gutterBottom color="error">
                Частые ошибки
              </Typography>
              
              <Stack spacing={1}>
                {stats.topErrors.map((error, index) => (
                  <Box
                    key={index}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      p: 1,
                      bgcolor: 'action.hover',
                      borderRadius: 1,
                    }}
                  >
                    <Typography variant="body2" sx={{ flex: 1 }}>
                      {error.error}
                    </Typography>
                    <Chip
                      size="small"
                      label={error.count}
                      color="error"
                      variant="outlined"
                    />
                  </Box>
                ))}
              </Stack>
            </Paper>
          </Grid>
        )}
      </Grid>
    </Box>
  );
}


