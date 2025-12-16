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
  color = '#6366f1',
}: {
  title: string;
  value: number | string;
  subtitle?: string;
  icon: React.ReactNode;
  color?: string;
}) {
  return (
    <Card sx={{ 
      height: '100%', 
      backgroundColor: 'rgba(255, 255, 255, 0.06)', 
      borderRadius: '16px', 
      border: 'none',
    }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <Box>
            <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.6)', display: 'block', mb: 0.5 }}>
              {title}
            </Typography>
            <Typography variant="h4" sx={{ color, fontWeight: 600 }}>
              {value}
            </Typography>
            {subtitle && (
              <Typography variant="body2" sx={{ mt: 0.5, color: 'rgba(255, 255, 255, 0.5)' }}>
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
  value: number | null | undefined;
  label: string;
  color: 'primary' | 'success' | 'error' | 'warning';
}) {
  const colorMap = {
    primary: '#6366f1',
    success: '#4caf50',
    error: '#f44336',
    warning: '#ff9800',
  };
  
  const safeValue = value != null ? value : 0;
  
  return (
    <Box sx={{ mb: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
        <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>{label}</Typography>
        <Typography variant="body2" sx={{ color: colorMap[color], fontWeight: 500 }}>
          {safeValue.toFixed(1)}%
        </Typography>
      </Box>
      <LinearProgress 
        variant="determinate" 
        value={safeValue} 
        sx={{
          height: 10,
          borderRadius: '8px',
          backgroundColor: 'rgba(255, 255, 255, 0.1)',
          '& .MuiLinearProgress-bar': {
            backgroundColor: colorMap[color],
            borderRadius: '8px',
          },
        }}
      />
    </Box>
  );
}

export function CampaignStatsView({ stats, isLoading }: CampaignStatsViewProps) {
  if (isLoading) {
    return (
      <Paper sx={{ p: 3.5, backgroundColor: 'rgba(255, 255, 255, 0.06)', borderRadius: '16px', border: 'none' }}>
        <Skeleton variant="text" width={200} height={32} sx={{ mb: 2 }} />
        <Grid container spacing={2}>
          {[1, 2, 3, 4].map((i) => (
            <Grid item xs={6} sm={3} key={i}>
              <Skeleton variant="rectangular" height={120} sx={{ borderRadius: '12px' }} />
            </Grid>
          ))}
        </Grid>
      </Paper>
    );
  }

  if (!stats) {
    return (
      <Paper sx={{ p: 3.5, backgroundColor: 'rgba(255, 255, 255, 0.06)', borderRadius: '16px', border: 'none' }}>
        <Typography sx={{ color: 'rgba(255, 255, 255, 0.6)' }}>Статистика недоступна</Typography>
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
            subtitle={stats.successRate != null ? `${stats.successRate.toFixed(1)}%` : undefined}
            icon={<SuccessIcon sx={{ fontSize: 32 }} />}
            color="#4caf50"
          />
        </Grid>
        <Grid item xs={6} sm={3}>
          <StatCard
            title="Ошибки"
            value={stats.failedContacts}
            subtitle={stats.failureRate != null ? `${stats.failureRate.toFixed(1)}%` : undefined}
            icon={<ErrorIcon sx={{ fontSize: 32 }} />}
            color="#f44336"
          />
        </Grid>
        <Grid item xs={6} sm={3}>
          <StatCard
            title="Пропущено"
            value={stats.skippedContacts}
            subtitle={stats.skipRate != null ? `${stats.skipRate.toFixed(1)}%` : undefined}
            icon={<SkippedIcon sx={{ fontSize: 32 }} />}
            color="#ff9800"
          />
        </Grid>
        <Grid item xs={6} sm={3}>
          <StatCard
            title="Время выполнения"
            value={formatDuration(stats.durationMinutes)}
            subtitle={stats.averageContactsPerMinute != null ? `${stats.averageContactsPerMinute.toFixed(1)} контакт/мин` : undefined}
            icon={<TimerIcon sx={{ fontSize: 32 }} />}
            color="#818cf8"
          />
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        {/* Статистика по мессенджерам */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2.5, height: '100%', backgroundColor: 'rgba(255, 255, 255, 0.06)', borderRadius: '16px', border: 'none' }}>
            <Typography variant="h6" gutterBottom sx={{ color: '#f5f5f5', fontWeight: 500 }}>
              По мессенджерам
            </Typography>
            
            {/* WhatsApp */}
            {stats.whatsAppStats && (
              <Box sx={{ mb: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <WhatsAppIcon sx={{ color: '#25D366' }} />
                  <Typography variant="subtitle2">WhatsApp</Typography>
                </Box>
                <Stack direction="row" spacing={1} flexWrap="wrap">
                  <Chip
                    size="small"
                    label={`Отправлено: ${stats.whatsAppStats.sent ?? 0}`}
                    sx={{
                      backgroundColor: 'rgba(76, 175, 80, 0.2)',
                      color: '#4caf50',
                      border: '1px solid rgba(76, 175, 80, 0.4)',
                    }}
                  />
                  <Chip
                    size="small"
                    label={`Ошибки: ${stats.whatsAppStats.failed ?? 0}`}
                    sx={{
                      backgroundColor: 'rgba(244, 67, 54, 0.2)',
                      color: '#f44336',
                      border: '1px solid rgba(244, 67, 54, 0.4)',
                    }}
                  />
                  <Chip
                    size="small"
                    label={`Пропущено: ${stats.whatsAppStats.skipped ?? 0}`}
                    sx={{
                      backgroundColor: 'rgba(255, 152, 0, 0.2)',
                      color: '#ff9800',
                      border: '1px solid rgba(255, 152, 0, 0.4)',
                    }}
                  />
                </Stack>
              </Box>
            )}

            {/* Telegram */}
            {stats.telegramStats && (
              <Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <TelegramIcon sx={{ color: '#0088cc' }} />
                  <Typography variant="subtitle2" sx={{ color: '#f5f5f5' }}>Telegram</Typography>
                </Box>
                <Stack direction="row" spacing={1} flexWrap="wrap">
                  <Chip
                    size="small"
                    label={`Отправлено: ${stats.telegramStats.sent ?? 0}`}
                    sx={{
                      backgroundColor: 'rgba(76, 175, 80, 0.2)',
                      color: '#4caf50',
                      border: '1px solid rgba(76, 175, 80, 0.4)',
                    }}
                  />
                  <Chip
                    size="small"
                    label={`Ошибки: ${stats.telegramStats.failed ?? 0}`}
                    sx={{
                      backgroundColor: 'rgba(244, 67, 54, 0.2)',
                      color: '#f44336',
                      border: '1px solid rgba(244, 67, 54, 0.4)',
                    }}
                  />
                  <Chip
                    size="small"
                    label={`Пропущено: ${stats.telegramStats.skipped ?? 0}`}
                    sx={{
                      backgroundColor: 'rgba(255, 152, 0, 0.2)',
                      color: '#ff9800',
                      border: '1px solid rgba(255, 152, 0, 0.4)',
                    }}
                  />
                </Stack>
              </Box>
            )}
          </Paper>
        </Grid>

        {/* Распределение результатов */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2.5, height: '100%', backgroundColor: 'rgba(255, 255, 255, 0.06)', borderRadius: '16px', border: 'none' }}>
            <Typography variant="h6" gutterBottom sx={{ color: '#f5f5f5', fontWeight: 500 }}>
              Распределение результатов
            </Typography>
            
            <Box sx={{ mt: 2 }}>
              <ProgressWithLabel
                value={stats.successRate ?? 0}
                label="Успешно"
                color="success"
              />
              <ProgressWithLabel
                value={stats.failureRate ?? 0}
                label="Ошибки"
                color="error"
              />
              <ProgressWithLabel
                value={stats.skipRate ?? 0}
                label="Пропущено"
                color="warning"
              />
            </Box>

            <Divider sx={{ my: 2.5, borderColor: 'rgba(255, 255, 255, 0.08)' }} />

            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.6)' }}>
                Всего контактов:
              </Typography>
              <Typography variant="body2" sx={{ color: '#f5f5f5', fontWeight: 500 }}>
                {stats.totalContacts}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
              <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.6)' }}>
                Обработано:
              </Typography>
              <Typography variant="body2" sx={{ color: '#f5f5f5', fontWeight: 500 }}>
                {stats.processedContacts}
              </Typography>
            </Box>
          </Paper>
        </Grid>

        {/* Статистика по профилям */}
        {stats.profileStats && stats.profileStats.length > 0 && (
          <Grid item xs={12}>
            <Paper sx={{ p: 2.5, backgroundColor: 'rgba(255, 255, 255, 0.06)', borderRadius: '16px', border: 'none' }}>
              <Typography variant="h6" gutterBottom sx={{ color: '#f5f5f5', fontWeight: 500 }}>
                По профилям
              </Typography>
              
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ color: 'rgba(255, 255, 255, 0.7)', fontWeight: 500, borderColor: 'rgba(255, 255, 255, 0.08)' }}>
                        Профиль
                      </TableCell>
                      <TableCell align="right" sx={{ color: 'rgba(255, 255, 255, 0.7)', fontWeight: 500, borderColor: 'rgba(255, 255, 255, 0.08)' }}>
                        Обработано
                      </TableCell>
                      <TableCell align="right" sx={{ color: 'rgba(255, 255, 255, 0.7)', fontWeight: 500, borderColor: 'rgba(255, 255, 255, 0.08)' }}>
                        Успешно
                      </TableCell>
                      <TableCell align="right" sx={{ color: 'rgba(255, 255, 255, 0.7)', fontWeight: 500, borderColor: 'rgba(255, 255, 255, 0.08)' }}>
                        Ошибки
                      </TableCell>
                      <TableCell align="right" sx={{ color: 'rgba(255, 255, 255, 0.7)', fontWeight: 500, borderColor: 'rgba(255, 255, 255, 0.08)' }}>
                        Успешность
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {stats.profileStats.map((profile) => (
                      <TableRow 
                        key={profile.profileId} 
                        hover
                        sx={{
                          '&:hover': {
                            backgroundColor: 'rgba(255, 255, 255, 0.05)',
                          },
                          '& td': {
                            borderColor: 'rgba(255, 255, 255, 0.08)',
                          },
                        }}
                      >
                        <TableCell sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>{profile.profileName}</TableCell>
                        <TableCell align="right" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>{profile.processed}</TableCell>
                        <TableCell align="right">
                          <Typography sx={{ color: '#4caf50' }}>{profile.success}</Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography sx={{ color: '#f44336' }}>{profile.failed}</Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Chip
                            size="small"
                            label={`${(profile.successRate ?? 0).toFixed(1)}%`}
                            sx={{
                              backgroundColor:
                                (profile.successRate ?? 0) >= 80 ? 'rgba(76, 175, 80, 0.2)' :
                                (profile.successRate ?? 0) >= 50 ? 'rgba(255, 152, 0, 0.2)' :
                                'rgba(244, 67, 54, 0.2)',
                              color:
                                (profile.successRate ?? 0) >= 80 ? '#4caf50' :
                                (profile.successRate ?? 0) >= 50 ? '#ff9800' :
                                '#f44336',
                              border: '1px solid',
                              borderColor:
                                (profile.successRate ?? 0) >= 80 ? 'rgba(76, 175, 80, 0.4)' :
                                (profile.successRate ?? 0) >= 50 ? 'rgba(255, 152, 0, 0.4)' :
                                'rgba(244, 67, 54, 0.4)',
                            }}
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
            <Paper sx={{ p: 2.5, backgroundColor: 'rgba(255, 255, 255, 0.06)', borderRadius: '16px', border: 'none' }}>
              <Typography variant="h6" gutterBottom sx={{ color: '#f44336', fontWeight: 500 }}>
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
                      p: 1.5,
                      backgroundColor: 'rgba(255, 255, 255, 0.05)',
                      borderRadius: '12px',
                    }}
                  >
                    <Typography variant="body2" sx={{ flex: 1, color: 'rgba(255, 255, 255, 0.7)' }}>
                      {error.error}
                    </Typography>
                    <Chip
                      size="small"
                      label={error.count}
                      sx={{
                        backgroundColor: 'rgba(244, 67, 54, 0.2)',
                        color: '#f44336',
                        border: '1px solid rgba(244, 67, 54, 0.4)',
                      }}
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



