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
import { CampaignProgressBar } from './CampaignProgressBar';

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
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 1 }}>
      <Box sx={{ color: 'text.secondary', display: 'flex' }}>{icon}</Box>
      <Typography variant="body2" color="text.secondary" sx={{ minWidth: 140 }}>
        {label}:
      </Typography>
      {valueComponent || (
        <Typography variant="body2" fontWeight={500}>
          {value ?? '—'}
        </Typography>
      )}
    </Box>
  );
}

export function CampaignDetails({ campaign, isLoading }: CampaignDetailsProps) {
  if (isLoading) {
    return (
      <Paper sx={{ p: 3 }}>
        <Skeleton variant="text" width={200} height={32} sx={{ mb: 2 }} />
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Skeleton variant="rectangular" height={200} />
          </Grid>
          <Grid item xs={12} md={6}>
            <Skeleton variant="rectangular" height={200} />
          </Grid>
        </Grid>
      </Paper>
    );
  }

  if (!campaign) {
    return (
      <Paper sx={{ p: 3 }}>
        <Typography color="text.secondary">Кампания не найдена</Typography>
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
    <Paper sx={{ p: 3 }}>
      {/* Заголовок */}
      <Box sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
          <Typography variant="h5" fontWeight={600}>
            {campaign.name}
          </Typography>
          <CampaignStatusBadge status={campaign.status} />
        </Box>
        
        {campaign.description && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
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
              variant="outlined"
            />
          )}
        </Stack>
      </Box>

      <Divider sx={{ my: 2 }} />

      {/* Прогресс */}
      {campaign.status !== 'DRAFT' && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" gutterBottom>
            Прогресс выполнения
          </Typography>
          <CampaignProgressBar
            processed={campaign.processedContacts}
            total={campaign.totalContacts}
            sx={{ mb: 2 }}
          />
          <Grid container spacing={2}>
            <Grid item xs={6} sm={3}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h6" color="primary.main">
                  {campaign.totalContacts}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Всего
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h6" color="success.main">
                  {campaign.successfulContacts}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Успешно
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h6" color="error.main">
                  {campaign.failedContacts}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Ошибки
                </Typography>
              </Box>
            </Grid>
            <Grid item xs={6} sm={3}>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="h6" color="warning.main">
                  {campaign.skippedContacts}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Пропущено
                </Typography>
              </Box>
            </Grid>
          </Grid>
          <Divider sx={{ my: 2 }} />
        </Box>
      )}

      <Grid container spacing={3}>
        {/* Левая колонка - основная информация */}
        <Grid item xs={12} md={6}>
          <Typography variant="subtitle2" gutterBottom sx={{ mb: 2 }}>
            Основная информация
          </Typography>

          <InfoRow
            icon={<TemplateIcon fontSize="small" />}
            label="Шаблон"
            value={campaign.template?.name || campaign.templateId}
          />
          <InfoRow
            icon={<GroupIcon fontSize="small" />}
            label="Группа клиентов"
            value={campaign.clientGroup?.name || campaign.clientGroupId}
          />
          <InfoRow
            icon={<ContactsIcon fontSize="small" />}
            label="Контактов"
            value={campaign.totalContacts}
          />
          <InfoRow
            icon={<ProfileIcon fontSize="small" />}
            label="Профилей"
            value={campaign._count?.profiles || campaign.profiles?.length || 0}
          />

          <Divider sx={{ my: 2 }} />

          <Typography variant="subtitle2" gutterBottom sx={{ mb: 2 }}>
            Временные метки
          </Typography>

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
        </Grid>

        {/* Правая колонка - настройки */}
        <Grid item xs={12} md={6}>
          {/* Расписание */}
          {hasScheduleConfig && campaign.scheduleConfig && (
            <>
              <Typography variant="subtitle2" gutterBottom sx={{ mb: 2 }}>
                Расписание
              </Typography>

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
              <Divider sx={{ my: 2 }} />
            </>
          )}

          {/* Фильтры */}
          {hasFilterConfig && campaign.filterConfig && (
            <>
              <Typography variant="subtitle2" gutterBottom sx={{ mb: 2 }}>
                Фильтры базы
              </Typography>

              {campaign.filterConfig.limitContacts && (
                <InfoRow
                  icon={<ContactsIcon fontSize="small" />}
                  label="Лимит контактов"
                  value={campaign.filterConfig.limitContacts}
                />
              )}
              {campaign.filterConfig.randomOrder && (
                <Chip
                  size="small"
                  label="Случайный порядок"
                  color="info"
                  sx={{ mr: 1, mb: 1 }}
                />
              )}
              {campaign.filterConfig.neverCampaigned && (
                <Chip
                  size="small"
                  label="Только новые клиенты"
                  color="info"
                  sx={{ mr: 1, mb: 1 }}
                />
              )}
              <Divider sx={{ my: 2 }} />
            </>
          )}

          {/* Опции */}
          {hasOptionsConfig && campaign.optionsConfig && (
            <>
              <Typography variant="subtitle2" gutterBottom sx={{ mb: 2 }}>
                Дополнительные опции
              </Typography>

              <Stack direction="row" spacing={1} flexWrap="wrap">
                {campaign.optionsConfig.deduplicationEnabled && (
                  <Tooltip title={`Период: ${campaign.optionsConfig.deduplicationPeriodDays || 30} дней`}>
                    <Chip size="small" label="Дедупликация" color="primary" variant="outlined" />
                  </Tooltip>
                )}
                {campaign.optionsConfig.cooldownEnabled && (
                  <Tooltip title={`Интервал: ${campaign.optionsConfig.cooldownMinutes || 60} мин`}>
                    <Chip size="small" label="Cooldown" color="primary" variant="outlined" />
                  </Tooltip>
                )}
                {campaign.optionsConfig.warmupEnabled && (
                  <Tooltip title="Постепенный прогрев профиля">
                    <Chip size="small" label="Прогрев" color="primary" variant="outlined" />
                  </Tooltip>
                )}
                {campaign.optionsConfig.autoResumeEnabled && (
                  <Chip size="small" label="Авто-возобновление" color="success" variant="outlined" />
                )}
              </Stack>
            </>
          )}

          {/* Профили */}
          {campaign.profiles && campaign.profiles.length > 0 && (
            <>
              <Divider sx={{ my: 2 }} />
              <Typography variant="subtitle2" gutterBottom sx={{ mb: 2 }}>
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
                      p: 1,
                      bgcolor: 'action.hover',
                      borderRadius: 1,
                    }}
                  >
                    <Typography variant="body2">
                      {cp.profile?.name || cp.profileId}
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="caption" color="text.secondary">
                        {cp.processedCount}/{cp.assignedCount}
                      </Typography>
                      <Chip
                        size="small"
                        label={cp.status}
                        color={
                          cp.status === 'COMPLETED' ? 'success' :
                          cp.status === 'RUNNING' ? 'primary' :
                          cp.status === 'ERROR' ? 'error' : 'default'
                        }
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


