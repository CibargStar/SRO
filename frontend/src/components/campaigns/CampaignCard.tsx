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
        backgroundColor: 'rgba(255, 255, 255, 0.06)',
        borderRadius: '16px',
        border: 'none',
        transition: 'all 0.3s ease',
        overflow: 'hidden',
        '&:hover': {
          boxShadow: '0 12px 32px rgba(0, 0, 0, 0.4)',
          transform: 'translateY(-4px)',
          backgroundColor: 'rgba(255, 255, 255, 0.08)',
        },
      }}
    >
      <CardContent sx={{ flexGrow: 1, p: 3, display: 'flex', flexDirection: 'column' }}>
        {/* Заголовок и статус */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
          <Box sx={{ flex: 1, minWidth: 0, mr: 1 }}>
            <Typography 
              variant="h6" 
              component="div" 
              sx={{ 
                color: '#f5f5f5', 
                fontWeight: 600,
                fontSize: '1.1rem',
                mb: 0.5,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
              }}
            >
              {campaign.name}
            </Typography>
            {campaign.description && (
              <Typography 
                variant="body2" 
                sx={{ 
                  color: 'rgba(255, 255, 255, 0.5)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  display: '-webkit-box',
                  WebkitLineClamp: 1,
                  WebkitBoxOrient: 'vertical',
                }}
              >
                {campaign.description}
              </Typography>
            )}
          </Box>
          <CampaignStatusBadge status={campaign.status} />
        </Box>

        {/* Бейджи типа и мессенджера */}
        <Stack direction="row" spacing={1} sx={{ mb: 2.5 }}>
          <CampaignTypeBadge type={campaign.campaignType} />
          <MessengerTargetBadge target={campaign.messengerType} />
        </Stack>

        {/* Прогресс (для активных кампаний) */}
        {isActive && (
          <Box sx={{ mb: 2.5, p: 1.5, backgroundColor: 'rgba(255, 255, 255, 0.03)', borderRadius: '12px' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.7)', fontWeight: 500 }}>
                Прогресс
              </Typography>
              <Typography variant="caption" sx={{ color: '#818cf8', fontWeight: 600 }}>
                {campaign.processedContacts} / {campaign.totalContacts}
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={progress}
              sx={{ 
                height: 10, 
                borderRadius: '8px',
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                '& .MuiLinearProgress-bar': {
                  backgroundColor: '#6366f1',
                  borderRadius: '8px',
                },
              }}
            />
          </Box>
        )}

        {/* Статистика */}
        <Box sx={{ flexGrow: 1 }}>
          <CampaignQuickStats campaign={campaign} />
        </Box>

        <Divider sx={{ my: 2, borderColor: 'rgba(255, 255, 255, 0.08)' }} />

        {/* Метаданные */}
        <Stack spacing={0.5}>
          <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '0.75rem' }}>
            Создано: {formatDate(campaign.createdAt)}
          </Typography>
          {campaign.scheduledAt && (
            <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '0.75rem' }}>
              Запланировано: {formatDate(campaign.scheduledAt)}
            </Typography>
          )}
        </Stack>
      </CardContent>

      {/* Действия */}
      <CardActions sx={{ 
        justifyContent: 'space-between', 
        px: 3, 
        pb: 2.5, 
        pt: 2,
        backgroundColor: 'rgba(255, 255, 255, 0.03)',
        borderTop: '1px solid rgba(255, 255, 255, 0.08)',
      }}>
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <Tooltip title="Просмотр">
            <IconButton 
              size="small" 
              onClick={() => onView?.(campaign)}
              sx={{
                color: 'rgba(255, 255, 255, 0.6)',
                transition: 'all 0.2s',
                '&:hover': {
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                  color: '#f5f5f5',
                  transform: 'scale(1.1)',
                },
              }}
            >
              <ViewIcon fontSize="small" />
            </IconButton>
          </Tooltip>

          {canEdit(campaign.status) && onEdit && (
            <Tooltip title="Редактировать">
              <IconButton 
                size="small" 
                onClick={() => onEdit(campaign)}
                sx={{
                  color: 'rgba(255, 255, 255, 0.6)',
                  transition: 'all 0.2s',
                  '&:hover': {
                    backgroundColor: 'rgba(255, 255, 255, 0.1)',
                    color: '#f5f5f5',
                    transform: 'scale(1.1)',
                  },
                }}
              >
                <EditIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}

          {onDuplicate && (
            <Tooltip title="Дублировать">
              <IconButton 
                size="small" 
                onClick={() => onDuplicate(campaign)}
                sx={{
                  color: 'rgba(255, 255, 255, 0.6)',
                  transition: 'all 0.2s',
                  '&:hover': {
                    backgroundColor: 'rgba(255, 255, 255, 0.1)',
                    color: '#f5f5f5',
                    transform: 'scale(1.1)',
                  },
                }}
              >
                <DuplicateIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Box>

        <Box sx={{ display: 'flex', gap: 0.5 }}>
          {/* Управление выполнением */}
          {canStart(campaign.status) && onStart && (
            <Tooltip title="Запустить">
              <IconButton 
                size="small" 
                onClick={() => onStart(campaign)}
                sx={{
                  color: '#6366f1',
                  transition: 'all 0.2s',
                  '&:hover': {
                    backgroundColor: 'rgba(99, 102, 241, 0.2)',
                    transform: 'scale(1.1)',
                  },
                }}
              >
                <StartIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}

          {canPause(campaign.status) && onPause && (
            <Tooltip title="Пауза">
              <IconButton 
                size="small" 
                onClick={() => onPause(campaign)}
                sx={{
                  color: '#f59e0b',
                  transition: 'all 0.2s',
                  '&:hover': {
                    backgroundColor: 'rgba(245, 158, 11, 0.2)',
                    transform: 'scale(1.1)',
                  },
                }}
              >
                <PauseIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}

          {canResume(campaign.status) && onResume && (
            <Tooltip title="Возобновить">
              <IconButton 
                size="small" 
                onClick={() => onResume(campaign)}
                sx={{
                  color: '#6366f1',
                  transition: 'all 0.2s',
                  '&:hover': {
                    backgroundColor: 'rgba(99, 102, 241, 0.2)',
                    transform: 'scale(1.1)',
                  },
                }}
              >
                <StartIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}

          {canCancel(campaign.status) && onCancel && (
            <Tooltip title="Отменить">
              <IconButton 
                size="small" 
                onClick={() => onCancel(campaign)}
                sx={{
                  color: '#f44336',
                  transition: 'all 0.2s',
                  '&:hover': {
                    backgroundColor: 'rgba(244, 67, 54, 0.2)',
                    transform: 'scale(1.1)',
                  },
                }}
              >
                <CancelIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}

          {canArchive(campaign.status) && onArchive && (
            <Tooltip title="Архивировать">
              <IconButton 
                size="small" 
                onClick={() => onArchive(campaign)}
                sx={{
                  color: 'rgba(255, 255, 255, 0.6)',
                  transition: 'all 0.2s',
                  '&:hover': {
                    backgroundColor: 'rgba(255, 255, 255, 0.1)',
                    color: '#f5f5f5',
                    transform: 'scale(1.1)',
                  },
                }}
              >
                <ArchiveIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}

          {canDelete(campaign.status) && onDelete && (
            <Tooltip title="Удалить">
              <IconButton 
                size="small" 
                onClick={() => onDelete(campaign)}
                sx={{
                  color: '#f44336',
                  transition: 'all 0.2s',
                  '&:hover': {
                    backgroundColor: 'rgba(244, 67, 54, 0.2)',
                    transform: 'scale(1.1)',
                  },
                }}
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      </CardActions>
    </Card>
  );
}

