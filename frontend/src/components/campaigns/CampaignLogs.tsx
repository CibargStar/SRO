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
  Select,
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

  const handleLevelChange = (event: any) => {
    const value = event.target.value;
    onQueryChange({
      ...query,
      level: value === '' ? undefined : value as LogLevel,
      page: 1,
    });
  };

  if (isLoading && logs.length === 0) {
    return (
      <Paper sx={{ p: 3 }}>
        <Skeleton variant="text" width={200} height={32} sx={{ mb: 2 }} />
        <Skeleton variant="rectangular" height={400} />
      </Paper>
    );
  }

  return (
    <Paper sx={{ overflow: 'hidden' }}>
      {/* Header */}
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: showFilters ? 2 : 0 }}>
          <Typography variant="h6">
            Логи событий ({totalCount})
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Tooltip title="Фильтры">
              <IconButton onClick={() => setShowFilters(!showFilters)} color={showFilters ? 'primary' : 'default'}>
                <FilterIcon />
              </IconButton>
            </Tooltip>
            {onRefresh && (
              <Tooltip title="Обновить">
                <IconButton onClick={onRefresh} disabled={isLoading}>
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
              <InputLabel>Уровень</InputLabel>
              <Select
                value={query.level || ''}
                onChange={handleLevelChange}
                label="Уровень"
              >
                <MenuItem value="">Все</MenuItem>
                {Object.entries(LOG_LEVEL_LABELS).map(([value, label]) => (
                  <MenuItem key={value} value={value}>
                    {label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>
        )}
      </Box>

      {/* Logs List */}
      {logs.length === 0 ? (
        <Box sx={{ p: 4, textAlign: 'center' }}>
          <Typography color="text.secondary">
            {isLoading ? 'Загрузка...' : 'Нет записей в логе'}
          </Typography>
        </Box>
      ) : (
        <List dense disablePadding>
          {logs.map((log, index) => (
            <React.Fragment key={log.id}>
              {index > 0 && <Divider component="li" />}
              <ListItem
                sx={{
                  py: 1.5,
                  '&:hover': {
                    bgcolor: 'action.hover',
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
                      <Typography variant="body2" fontWeight={500}>
                        {log.action}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
                        {formatDateTime(log.createdAt)}
                      </Typography>
                    </Box>
                  }
                  secondary={
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
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
        <Box sx={{ p: 2, display: 'flex', justifyContent: 'center', borderTop: 1, borderColor: 'divider' }}>
          <Pagination
            count={totalPages}
            page={query.page || 1}
            onChange={handlePageChange}
            color="primary"
            size="small"
          />
        </Box>
      )}
    </Paper>
  );
}


