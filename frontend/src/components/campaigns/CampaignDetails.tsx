/**
 * CampaignDetails.tsx
 * 
 * Компонент для отображения общей информации о кампании
 */

import React from 'react';
import {
  Box,
  Paper,
  Typography,
  Grid,
  Chip,
  Divider,
  Skeleton,
  Stack,
  Tooltip,
} from '@mui/material';
import {
  Schedule as ScheduleIcon,
  PlayArrow as StartIcon,
  Pause as PauseIcon,
  CheckCircle as CompletedIcon,
  Group as ContactsIcon,
  Message as TemplateIcon,
  Folder as GroupIcon,
  Person as ProfileIcon,
  CalendarToday as CalendarIcon,
  AccessTime as TimeIcon,
} from '@mui/icons-material';
import type { Campaign } from '@/types/campaign';
import {
  CAMPAIGN_TYPE_LABELS,
  MESSENGER_TARGET_LABELS,
  UNIVERSAL_TARGET_LABELS,
  WEEK_DAYS,
} from '@/types/campaign';
import { CampaignStatusBadge } from './CampaignStatusBadge';
import { CampaignTypeBadge } from './CampaignTypeBadge';
import { MessengerTargetBadge } from './MessengerTargetBadge';

interface CampaignDetailsProps {
  campaign: Campaign | undefined;
  isLoading?: boolean;
}

/**
 * Форматирование даты и времени
 */
function formatDateTime(dateString: string | null | undefined): string {
  if (!dateString) return '—';
  const date = new Date(dateString);
  return date.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Форматирование рабочих дней
 */
function formatWorkDays(days: number[] | undefined): string {
  if (!days || days.length === 0) return 'Все дни';
  if (days.length === 7) return 'Все дни';
  return days.map(d => WEEK_DAYS.find(w => w.value === d)?.label || d).join(', ');
}

/**
 * Информационная строка
 */
function InfoRow({
  icon,
  label,
  value,
  valueComponent,
}: {
  icon: React.ReactNode;
  label: string;
  value?: string | number | null;
  valueComponent?: React.ReactNode;
}) {
  return (
    <Box 
      sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: 1.5, 
        p: 1.5,
        borderRadius: '12px',
        backgroundColor: 'rgba(255, 255, 255, 0.03)',
        transition: 'background-color 0.2s',
        '&:hover': {
          backgroundColor: 'rgba(255, 255, 255, 0.05)',
        },
      }}
    >
      <Box 
        sx={{ 
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 32,
          height: 32,
          borderRadius: '8px',
          backgroundColor: 'rgba(99, 102, 241, 0.15)',
          color: '#818cf8',
        }}
      >
        {icon}
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.5)', display: 'block', mb: 0.25 }}>
          {label}
        </Typography>
        {valueComponent || (
          <Typography variant="body2" sx={{ color: '#f5f5f5', fontWeight: 500 }}>
            {value ?? '—'}
          </Typography>
        )}
      </Box>
    </Box>
  );
}

export function CampaignDetails({ campaign, isLoading }: CampaignDetailsProps) {
  if (isLoading) {
    return (
      <Paper sx={{ p: 3.5, backgroundColor: 'rgba(255, 255, 255, 0.06)', borderRadius: '16px', border: 'none' }}>
        <Skeleton variant="text" width={200} height={32} sx={{ mb: 2 }} />
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Skeleton variant="rectangular" height={200} sx={{ borderRadius: '12px' }} />
          </Grid>
          <Grid item xs={12} md={6}>
            <Skeleton variant="rectangular" height={200} sx={{ borderRadius: '12px' }} />
          </Grid>
        </Grid>
      </Paper>
    );
  }

  if (!campaign) {
    return (
      <Paper sx={{ p: 3.5, backgroundColor: 'rgba(255, 255, 255, 0.06)', borderRadius: '16px', border: 'none' }}>
        <Typography sx={{ color: 'rgba(255, 255, 255, 0.6)' }}>Кампания не найдена</Typography>
      </Paper>
    );
  }

  const hasScheduleConfig = campaign.scheduleConfig && (
    campaign.scheduleConfig.workHoursEnabled ||
    campaign.scheduleConfig.workDaysEnabled ||
    campaign.scheduleConfig.recurrence !== 'NONE'
  );

  const hasFilterConfig = campaign.filterConfig && (
    (campaign.filterConfig.regionIds && campaign.filterConfig.regionIds.length > 0) ||
    campaign.filterConfig.limitContacts ||
    campaign.filterConfig.neverCampaigned ||
    campaign.filterConfig.randomOrder
  );

  const hasOptionsConfig = campaign.optionsConfig && (
    campaign.optionsConfig.deduplicationEnabled ||
    campaign.optionsConfig.cooldownEnabled ||
    campaign.optionsConfig.warmupEnabled
  );

  return (
    <Paper sx={{ p: 3.5, backgroundColor: 'rgba(255, 255, 255, 0.06)', borderRadius: '16px', border: 'none' }}>
      {/* Заголовок */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" sx={{ color: '#f5f5f5', fontWeight: 600, mb: 1.5 }}>
          Основная информация
        </Typography>
        
        {campaign.description && (
          <Typography variant="body2" sx={{ mb: 2, color: 'rgba(255, 255, 255, 0.6)' }}>
            {campaign.description}
          </Typography>
        )}

        <Stack direction="row" spacing={1} flexWrap="wrap">
          <CampaignTypeBadge type={campaign.campaignType} />
          <MessengerTargetBadge target={campaign.messengerType} />
          {campaign.universalTarget && (
            <Chip
              size="small"
              label={UNIVERSAL_TARGET_LABELS[campaign.universalTarget]}
              sx={{
                backgroundColor: 'rgba(99, 102, 241, 0.2)',
                color: '#818cf8',
                border: '1px solid rgba(99, 102, 241, 0.4)',
              }}
            />
          )}
        </Stack>
      </Box>

      <Grid container spacing={3}>
        {/* Левая колонка - основная информация */}
        <Grid item xs={12} md={6}>
          <Box sx={{ 
            p: 2.5, 
            backgroundColor: 'rgba(255, 255, 255, 0.03)', 
            borderRadius: '12px',
            mb: 3,
          }}>
            <Typography variant="subtitle1" gutterBottom sx={{ mb: 2, color: '#f5f5f5', fontWeight: 600, fontSize: '1rem' }}>
              Параметры кампании
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <InfoRow
                  icon={<TemplateIcon fontSize="small" />}
                  label="Шаблон"
                  value={campaign.template?.name || campaign.templateId}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <InfoRow
                  icon={<GroupIcon fontSize="small" />}
                  label="Группа клиентов"
                  value={campaign.clientGroup?.name || campaign.clientGroupId}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <InfoRow
                  icon={<ContactsIcon fontSize="small" />}
                  label="Контактов"
                  value={campaign.totalContacts}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <InfoRow
                  icon={<ProfileIcon fontSize="small" />}
                  label="Профилей"
                  value={campaign._count?.profiles || campaign.profiles?.length || 0}
                />
              </Grid>
            </Grid>
          </Box>

          <Box sx={{ 
            p: 2.5, 
            backgroundColor: 'rgba(255, 255, 255, 0.03)', 
            borderRadius: '12px',
          }}>
            <Typography variant="subtitle1" gutterBottom sx={{ mb: 2, color: '#f5f5f5', fontWeight: 600, fontSize: '1rem' }}>
              Временные метки
            </Typography>
            <Stack spacing={1.5}>
              <InfoRow
                icon={<CalendarIcon fontSize="small" />}
                label="Создана"
                value={formatDateTime(campaign.createdAt)}
              />
              {campaign.scheduledAt && (
                <InfoRow
                  icon={<ScheduleIcon fontSize="small" />}
                  label="Запланирована"
                  value={formatDateTime(campaign.scheduledAt)}
                />
              )}
              {campaign.startedAt && (
                <InfoRow
                  icon={<StartIcon fontSize="small" />}
                  label="Запущена"
                  value={formatDateTime(campaign.startedAt)}
                />
              )}
              {campaign.pausedAt && (
                <InfoRow
                  icon={<PauseIcon fontSize="small" />}
                  label="На паузе с"
                  value={formatDateTime(campaign.pausedAt)}
                />
              )}
              {campaign.completedAt && (
                <InfoRow
                  icon={<CompletedIcon fontSize="small" />}
                  label="Завершена"
                  value={formatDateTime(campaign.completedAt)}
                />
              )}
            </Stack>
          </Box>
        </Grid>

        {/* Правая колонка - настройки */}
        <Grid item xs={12} md={6}>
          {/* Расписание */}
          {hasScheduleConfig && campaign.scheduleConfig && (
            <Box sx={{ 
              p: 2.5, 
              backgroundColor: 'rgba(255, 255, 255, 0.03)', 
              borderRadius: '12px',
              mb: 3,
            }}>
              <Typography variant="subtitle1" gutterBottom sx={{ mb: 2, color: '#f5f5f5', fontWeight: 600, fontSize: '1rem' }}>
                Расписание
              </Typography>
              <Stack spacing={1.5}>
                {campaign.scheduleConfig.workHoursEnabled && (
                  <InfoRow
                    icon={<TimeIcon fontSize="small" />}
                    label="Рабочие часы"
                    value={`${campaign.scheduleConfig.workHoursStart || '09:00'} - ${campaign.scheduleConfig.workHoursEnd || '18:00'}`}
                  />
                )}
                {campaign.scheduleConfig.workDaysEnabled && (
                  <InfoRow
                    icon={<CalendarIcon fontSize="small" />}
                    label="Рабочие дни"
                    value={formatWorkDays(campaign.scheduleConfig.workDays)}
                  />
                )}
              </Stack>
            </Box>
          )}

          {/* Фильтры */}
          {hasFilterConfig && campaign.filterConfig && (
            <Box sx={{ 
              p: 2.5, 
              backgroundColor: 'rgba(255, 255, 255, 0.03)', 
              borderRadius: '12px',
              mb: 3,
            }}>
              <Typography variant="subtitle1" gutterBottom sx={{ mb: 2, color: '#f5f5f5', fontWeight: 600, fontSize: '1rem' }}>
                Фильтры базы
              </Typography>
              <Stack spacing={1.5}>
                {campaign.filterConfig.limitContacts && (
                  <InfoRow
                    icon={<ContactsIcon fontSize="small" />}
                    label="Лимит контактов"
                    value={campaign.filterConfig.limitContacts}
                  />
                )}
                {(campaign.filterConfig.randomOrder || campaign.filterConfig.neverCampaigned) && (
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 0.5 }}>
                    {campaign.filterConfig.randomOrder && (
                      <Chip
                        size="small"
                        label="Случайный порядок"
                        sx={{
                          backgroundColor: 'rgba(99, 102, 241, 0.2)',
                          color: '#818cf8',
                          border: '1px solid rgba(99, 102, 241, 0.4)',
                        }}
                      />
                    )}
                    {campaign.filterConfig.neverCampaigned && (
                      <Chip
                        size="small"
                        label="Только новые клиенты"
                        sx={{
                          backgroundColor: 'rgba(99, 102, 241, 0.2)',
                          color: '#818cf8',
                          border: '1px solid rgba(99, 102, 241, 0.4)',
                        }}
                      />
                    )}
                  </Box>
                )}
              </Stack>
            </Box>
          )}

          {/* Опции */}
          {hasOptionsConfig && campaign.optionsConfig && (
            <Box sx={{ 
              p: 2.5, 
              backgroundColor: 'rgba(255, 255, 255, 0.03)', 
              borderRadius: '12px',
              mb: 3,
            }}>
              <Typography variant="subtitle1" gutterBottom sx={{ mb: 2, color: '#f5f5f5', fontWeight: 600, fontSize: '1rem' }}>
                Дополнительные опции
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap">
                {campaign.optionsConfig.deduplicationEnabled && (
                  <Tooltip title={`Период: ${campaign.optionsConfig.deduplicationPeriodDays || 30} дней`}>
                    <Chip 
                      size="small" 
                      label="Дедупликация" 
                      sx={{
                        backgroundColor: 'rgba(99, 102, 241, 0.2)',
                        color: '#818cf8',
                        border: '1px solid rgba(99, 102, 241, 0.4)',
                      }}
                    />
                  </Tooltip>
                )}
                {campaign.optionsConfig.cooldownEnabled && (
                  <Tooltip title={`Интервал: ${campaign.optionsConfig.cooldownMinutes || 60} мин`}>
                    <Chip 
                      size="small" 
                      label="Cooldown" 
                      sx={{
                        backgroundColor: 'rgba(99, 102, 241, 0.2)',
                        color: '#818cf8',
                        border: '1px solid rgba(99, 102, 241, 0.4)',
                      }}
                    />
                  </Tooltip>
                )}
                {campaign.optionsConfig.warmupEnabled && (
                  <Tooltip title="Постепенный прогрев профиля">
                    <Chip 
                      size="small" 
                      label="Прогрев" 
                      sx={{
                        backgroundColor: 'rgba(99, 102, 241, 0.2)',
                        color: '#818cf8',
                        border: '1px solid rgba(99, 102, 241, 0.4)',
                      }}
                    />
                  </Tooltip>
                )}
                {campaign.optionsConfig.autoResumeEnabled && (
                  <Chip 
                    size="small" 
                    label="Авто-возобновление" 
                    sx={{
                      backgroundColor: 'rgba(76, 175, 80, 0.2)',
                      color: '#4caf50',
                      border: '1px solid rgba(76, 175, 80, 0.4)',
                    }}
                  />
                )}
              </Stack>
            </Box>
          )}

          {/* Профили */}
          {campaign.profiles && campaign.profiles.length > 0 && (
            <>
              <Divider sx={{ my: 2.5, borderColor: 'rgba(255, 255, 255, 0.08)' }} />
              <Typography variant="subtitle2" gutterBottom sx={{ mb: 2, color: '#f5f5f5', fontWeight: 500 }}>
                Профили ({campaign.profiles.length})
              </Typography>
              <Stack spacing={1}>
                {campaign.profiles.map((cp) => (
                  <Box
                    key={cp.id}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      p: 1.5,
                      backgroundColor: 'rgba(255, 255, 255, 0.05)',
                      borderRadius: '12px',
                    }}
                  >
                    <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                      {cp.profile?.name || cp.profileId}
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.5)' }}>
                        {cp.processedCount}/{cp.assignedCount}
                      </Typography>
                      <Chip
                        size="small"
                        label={cp.status}
                        sx={{
                          backgroundColor:
                            cp.status === 'COMPLETED' ? 'rgba(76, 175, 80, 0.2)' :
                            cp.status === 'RUNNING' ? 'rgba(99, 102, 241, 0.2)' :
                            cp.status === 'ERROR' ? 'rgba(244, 67, 54, 0.2)' : 'rgba(255, 255, 255, 0.08)',
                          color:
                            cp.status === 'COMPLETED' ? '#4caf50' :
                            cp.status === 'RUNNING' ? '#818cf8' :
                            cp.status === 'ERROR' ? '#f44336' : 'rgba(255, 255, 255, 0.7)',
                          border: '1px solid',
                          borderColor:
                            cp.status === 'COMPLETED' ? 'rgba(76, 175, 80, 0.4)' :
                            cp.status === 'RUNNING' ? 'rgba(99, 102, 241, 0.4)' :
                            cp.status === 'ERROR' ? 'rgba(244, 67, 54, 0.4)' : 'rgba(255, 255, 255, 0.12)',
                        }}
                      />
                    </Box>
                  </Box>
                ))}
              </Stack>
            </>
          )}
        </Grid>
      </Grid>
    </Paper>
  );
}



