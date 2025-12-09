/**
 * Карточка кампании
 * 
 * Отображает краткую информацию о кампании в виде карточки.
 */

import React from 'react';
import {
  Card,
  CardContent,
  CardActions,
  Typography,
  Box,
  Stack,
  IconButton,
  Tooltip,
  LinearProgress,
  Divider,
} from '@mui/material';
import {
  PlayArrow as StartIcon,
  Pause as PauseIcon,
  Stop as CancelIcon,
  ContentCopy as DuplicateIcon,
  Delete as DeleteIcon,
  Archive as ArchiveIcon,
  Visibility as ViewIcon,
  Edit as EditIcon,
} from '@mui/icons-material';
import type { Campaign, CampaignStatus } from '@/types/campaign';
import { CampaignStatusBadge } from './CampaignStatusBadge';
import { CampaignTypeBadge } from './CampaignTypeBadge';
import { MessengerTargetBadge } from './MessengerTargetBadge';
import { CampaignQuickStats } from './CampaignQuickStats';

interface CampaignCardProps {
  campaign: Campaign;
  onView?: (campaign: Campaign) => void;
  onEdit?: (campaign: Campaign) => void;
  onStart?: (campaign: Campaign) => void;
  onPause?: (campaign: Campaign) => void;
  onResume?: (campaign: Campaign) => void;
  onCancel?: (campaign: Campaign) => void;
  onDuplicate?: (campaign: Campaign) => void;
  onArchive?: (campaign: Campaign) => void;
  onDelete?: (campaign: Campaign) => void;
}

/**
 * Определяет, можно ли редактировать кампанию
 */
function canEdit(status: CampaignStatus): boolean {
  return status === 'DRAFT';
}

/**
 * Определяет, можно ли запустить кампанию
 */
function canStart(status: CampaignStatus): boolean {
  return status === 'DRAFT' || status === 'SCHEDULED';
}

/**
 * Определяет, можно ли поставить на паузу
 */
function canPause(status: CampaignStatus): boolean {
  return status === 'RUNNING';
}

/**
 * Определяет, можно ли возобновить
 */
function canResume(status: CampaignStatus): boolean {
  return status === 'PAUSED';
}

/**
 * Определяет, можно ли отменить
 */
function canCancel(status: CampaignStatus): boolean {
  return status === 'RUNNING' || status === 'PAUSED' || status === 'QUEUED';
}

/**
 * Определяет, можно ли архивировать
 */
function canArchive(status: CampaignStatus): boolean {
  return status === 'COMPLETED' || status === 'CANCELLED' || status === 'ERROR';
}

/**
 * Определяет, можно ли удалить
 */
function canDelete(status: CampaignStatus): boolean {
  return status === 'DRAFT';
}

/**
 * Форматирование даты
 */
function formatDate(dateString: string | null): string {
  if (!dateString) return '—';
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function CampaignCard({
  campaign,
  onView,
  onEdit,
  onStart,
  onPause,
  onResume,
  onCancel,
  onDuplicate,
  onArchive,
  onDelete,
}: CampaignCardProps) {
  const progress = campaign.totalContacts > 0
    ? (campaign.processedContacts / campaign.totalContacts) * 100
    : 0;

  const isActive = campaign.status === 'RUNNING' || campaign.status === 'PAUSED';

  return (
    <Card
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        transition: 'box-shadow 0.2s, transform 0.2s',
        '&:hover': {
          boxShadow: 4,
          transform: 'translateY(-2px)',
        },
      }}
    >
      <CardContent sx={{ flexGrow: 1 }}>
        {/* Заголовок */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
          <Typography variant="h6" component="div" noWrap sx={{ flexGrow: 1, mr: 1 }}>
            {campaign.name}
          </Typography>
          <CampaignStatusBadge status={campaign.status} />
        </Box>

        {/* Описание */}
        {campaign.description && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }} noWrap>
            {campaign.description}
          </Typography>
        )}

        {/* Бейджи типа и мессенджера */}
        <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
          <CampaignTypeBadge type={campaign.campaignType} />
          <MessengerTargetBadge target={campaign.messengerType} />
        </Stack>

        {/* Прогресс (для активных кампаний) */}
        {isActive && (
          <Box sx={{ mb: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
              <Typography variant="caption" color="text.secondary">
                Прогресс
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {campaign.processedContacts} / {campaign.totalContacts}
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={progress}
              sx={{ height: 8, borderRadius: 1 }}
            />
          </Box>
        )}

        <CampaignQuickStats campaign={campaign} />

        <Divider sx={{ my: 1 }} />

        {/* Дата создания */}
        <Typography variant="caption" color="text.secondary">
          Создано: {formatDate(campaign.createdAt)}
        </Typography>

        {/* Дата запуска */}
        {campaign.scheduledAt && (
          <Typography variant="caption" color="text.secondary" display="block">
            Запланировано: {formatDate(campaign.scheduledAt)}
          </Typography>
        )}
      </CardContent>

      {/* Действия */}
      <CardActions sx={{ justifyContent: 'space-between', px: 2, pb: 2 }}>
        <Box>
          <Tooltip title="Просмотр">
            <IconButton size="small" onClick={() => onView?.(campaign)}>
              <ViewIcon />
            </IconButton>
          </Tooltip>

          {canEdit(campaign.status) && onEdit && (
            <Tooltip title="Редактировать">
              <IconButton size="small" onClick={() => onEdit(campaign)}>
                <EditIcon />
              </IconButton>
            </Tooltip>
          )}

          {onDuplicate && (
            <Tooltip title="Дублировать">
              <IconButton size="small" onClick={() => onDuplicate(campaign)}>
                <DuplicateIcon />
              </IconButton>
            </Tooltip>
          )}
        </Box>

        <Box>
          {/* Управление выполнением */}
          {canStart(campaign.status) && onStart && (
            <Tooltip title="Запустить">
              <IconButton size="small" color="primary" onClick={() => onStart(campaign)}>
                <StartIcon />
              </IconButton>
            </Tooltip>
          )}

          {canPause(campaign.status) && onPause && (
            <Tooltip title="Пауза">
              <IconButton size="small" color="warning" onClick={() => onPause(campaign)}>
                <PauseIcon />
              </IconButton>
            </Tooltip>
          )}

          {canResume(campaign.status) && onResume && (
            <Tooltip title="Возобновить">
              <IconButton size="small" color="primary" onClick={() => onResume(campaign)}>
                <StartIcon />
              </IconButton>
            </Tooltip>
          )}

          {canCancel(campaign.status) && onCancel && (
            <Tooltip title="Отменить">
              <IconButton size="small" color="error" onClick={() => onCancel(campaign)}>
                <CancelIcon />
              </IconButton>
            </Tooltip>
          )}

          {canArchive(campaign.status) && onArchive && (
            <Tooltip title="Архивировать">
              <IconButton size="small" onClick={() => onArchive(campaign)}>
                <ArchiveIcon />
              </IconButton>
            </Tooltip>
          )}

          {canDelete(campaign.status) && onDelete && (
            <Tooltip title="Удалить">
              <IconButton size="small" color="error" onClick={() => onDelete(campaign)}>
                <DeleteIcon />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      </CardActions>
    </Card>
  );
}

