/**
 * CampaignLogs.tsx
 * 
 * Компонент для отображения логов событий кампании
 */

import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Skeleton,
  IconButton,
  Tooltip,
  FormControl,
  InputLabel,
  MenuItem,
  Stack,
  Pagination,
  Divider,
} from '@mui/material';
import {
  Info as InfoIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  Refresh as RefreshIcon,
  FilterList as FilterIcon,
} from '@mui/icons-material';
import { StyledSelect, MenuProps, selectInputLabelStyles } from '@/components/common';
import type { CampaignLog, ListLogsQuery, LogLevel } from '@/types/campaign';
import { LOG_LEVEL_LABELS } from '@/types/campaign';
import { LogLevelBadge } from './LogLevelBadge';

interface CampaignLogsProps {
  campaignId: string;
  logs: CampaignLog[];
  totalCount: number;
  totalPages: number;
  isLoading?: boolean;
  query: ListLogsQuery;
  onQueryChange: (query: ListLogsQuery) => void;
  onRefresh?: () => void;
}

/**
 * Форматирование даты и времени
 */
function formatDateTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/**
 * Иконка для уровня лога
 */
function LogLevelIcon({ level }: { level: LogLevel }) {
  switch (level) {
    case 'ERROR':
      return <ErrorIcon color="error" />;
    case 'WARNING':
      return <WarningIcon color="warning" />;
    default:
      return <InfoIcon color="info" />;
  }
}

export function CampaignLogs({
  campaignId,
  logs,
  totalCount,
  totalPages,
  isLoading,
  query,
  onQueryChange,
  onRefresh,
}: CampaignLogsProps) {
  const [showFilters, setShowFilters] = useState(false);

  const handlePageChange = (_: unknown, newPage: number) => {
    onQueryChange({ ...query, page: newPage });
  };

  const handleLevelChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    onQueryChange({
      ...query,
      level: value === '' ? undefined : value as LogLevel,
      page: 1,
    });
  };

  if (isLoading && logs.length === 0) {
    return (
      <Paper sx={{ p: 3.5, backgroundColor: 'rgba(255, 255, 255, 0.06)', borderRadius: '16px', border: 'none' }}>
        <Skeleton variant="text" width={200} height={32} sx={{ mb: 2 }} />
        <Skeleton variant="rectangular" height={400} sx={{ borderRadius: '12px' }} />
      </Paper>
    );
  }

  return (
    <Paper sx={{ overflow: 'hidden', backgroundColor: 'rgba(255, 255, 255, 0.06)', borderRadius: '16px', border: 'none' }}>
      {/* Header */}
      <Box sx={{ p: 2.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: showFilters ? 2 : 0 }}>
          <Typography variant="h6" sx={{ color: '#f5f5f5', fontWeight: 500 }}>
            Логи событий ({totalCount})
          </Typography>
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            <Tooltip title="Фильтры">
              <IconButton 
                onClick={() => setShowFilters(!showFilters)}
                sx={{
                  color: showFilters ? '#6366f1' : 'rgba(255, 255, 255, 0.7)',
                  '&:hover': {
                    backgroundColor: 'rgba(255, 255, 255, 0.08)',
                    color: showFilters ? '#818cf8' : '#f5f5f5',
                  },
                }}
              >
                <FilterIcon />
              </IconButton>
            </Tooltip>
            {onRefresh && (
              <Tooltip title="Обновить">
                <IconButton 
                  onClick={onRefresh} 
                  disabled={isLoading}
                  sx={{
                    color: 'rgba(255, 255, 255, 0.7)',
                    '&:hover': {
                      backgroundColor: 'rgba(255, 255, 255, 0.08)',
                      color: '#f5f5f5',
                    },
                  }}
                >
                  <RefreshIcon />
                </IconButton>
              </Tooltip>
            )}
          </Box>
        </Box>

        {/* Filters */}
        {showFilters && (
          <Stack direction="row" spacing={2}>
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel sx={selectInputLabelStyles}>Уровень</InputLabel>
              <StyledSelect
                value={query.level || ''}
                onChange={handleLevelChange}
                label="Уровень"
                MenuProps={MenuProps}
              >
                <MenuItem value="">Все</MenuItem>
                {Object.entries(LOG_LEVEL_LABELS).map(([value, label]) => (
                  <MenuItem key={value} value={value}>
                    {label}
                  </MenuItem>
                ))}
              </StyledSelect>
            </FormControl>
          </Stack>
        )}
      </Box>

      {showFilters && <Divider sx={{ borderColor: 'rgba(255, 255, 255, 0.08)' }} />}

      {/* Logs List */}
      {logs.length === 0 ? (
        <Box sx={{ p: 4, textAlign: 'center' }}>
          <Typography sx={{ color: 'rgba(255, 255, 255, 0.5)' }}>
            {isLoading ? 'Загрузка...' : 'Нет записей в логе'}
          </Typography>
        </Box>
      ) : (
        <List dense disablePadding>
          {logs.map((log, index) => (
            <React.Fragment key={log.id}>
              {index > 0 && <Divider component="li" sx={{ borderColor: 'rgba(255, 255, 255, 0.08)' }} />}
              <ListItem
                sx={{
                  py: 1.5,
                  px: 2.5,
                  '&:hover': {
                    backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  },
                }}
              >
                <ListItemIcon sx={{ minWidth: 40 }}>
                  <LogLevelIcon level={log.level} />
                </ListItemIcon>
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                      <LogLevelBadge level={log.level} size="small" />
                      <Typography variant="body2" sx={{ color: '#f5f5f5', fontWeight: 500 }}>
                        {log.action}
                      </Typography>
                      <Typography variant="caption" sx={{ ml: 'auto', color: 'rgba(255, 255, 255, 0.5)' }}>
                        {formatDateTime(log.createdAt)}
                      </Typography>
                    </Box>
                  }
                  secondary={
                    <Typography variant="body2" sx={{ mt: 0.5, color: 'rgba(255, 255, 255, 0.6)' }}>
                      {log.message}
                    </Typography>
                  }
                  secondaryTypographyProps={{ component: 'div' }}
                />
              </ListItem>
            </React.Fragment>
          ))}
        </List>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <>
          <Divider sx={{ borderColor: 'rgba(255, 255, 255, 0.08)' }} />
          <Box sx={{ p: 2.5, display: 'flex', justifyContent: 'center' }}>
            <Pagination
              count={totalPages}
              page={query.page || 1}
              onChange={handlePageChange}
              size="small"
              sx={{
                '& .MuiPaginationItem-root': {
                  color: 'rgba(255, 255, 255, 0.7)',
                  '&.Mui-selected': {
                    backgroundColor: '#6366f1',
                    color: '#fff',
                    '&:hover': {
                      backgroundColor: '#818cf8',
                    },
                  },
                  '&:hover': {
                    backgroundColor: 'rgba(255, 255, 255, 0.08)',
                  },
                },
              }}
            />
          </Box>
        </>
      )}
    </Paper>
  );
}



