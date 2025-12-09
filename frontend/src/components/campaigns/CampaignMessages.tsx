/**
 * CampaignMessages.tsx
 * 
 * Компонент для отображения списка сообщений кампании
 */

import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Skeleton,
  Chip,
  IconButton,
  Tooltip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Stack,
  TextField,
  InputAdornment,
} from '@mui/material';
import {
  Search as SearchIcon,
  Refresh as RefreshIcon,
  FilterList as FilterIcon,
} from '@mui/icons-material';
import type {
  CampaignMessage,
  ListMessagesQuery,
  MessageStatus,
  MessengerType,
} from '@/types/campaign';
import { MESSAGE_STATUS_LABELS } from '@/types/campaign';
import { MessageStatusBadge } from './MessageStatusBadge';

interface CampaignMessagesProps {
  campaignId: string;
  messages: CampaignMessage[];
  totalCount: number;
  isLoading?: boolean;
  query: ListMessagesQuery;
  onQueryChange: (query: ListMessagesQuery) => void;
  onRefresh?: () => void;
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
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function CampaignMessages({
  campaignId,
  messages,
  totalCount,
  isLoading,
  query,
  onQueryChange,
  onRefresh,
}: CampaignMessagesProps) {
  const [showFilters, setShowFilters] = useState(false);

  const handlePageChange = (_: unknown, newPage: number) => {
    onQueryChange({ ...query, page: newPage + 1 });
  };

  const handleRowsPerPageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    onQueryChange({ ...query, limit: parseInt(event.target.value, 10), page: 1 });
  };

  const handleStatusChange = (event: any) => {
    const value = event.target.value;
    onQueryChange({
      ...query,
      status: value === '' ? undefined : value as MessageStatus,
      page: 1,
    });
  };

  const handleMessengerChange = (event: any) => {
    const value = event.target.value;
    onQueryChange({
      ...query,
      messenger: value === '' ? undefined : value as MessengerType,
      page: 1,
    });
  };

  if (isLoading && messages.length === 0) {
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
            Сообщения ({totalCount})
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
              <InputLabel>Статус</InputLabel>
              <Select
                value={query.status || ''}
                onChange={handleStatusChange}
                label="Статус"
              >
                <MenuItem value="">Все</MenuItem>
                {Object.entries(MESSAGE_STATUS_LABELS).map(([value, label]) => (
                  <MenuItem key={value} value={value}>
                    {label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>Мессенджер</InputLabel>
              <Select
                value={query.messenger || ''}
                onChange={handleMessengerChange}
                label="Мессенджер"
              >
                <MenuItem value="">Все</MenuItem>
                <MenuItem value="WHATSAPP">WhatsApp</MenuItem>
                <MenuItem value="TELEGRAM">Telegram</MenuItem>
              </Select>
            </FormControl>
          </Stack>
        )}
      </Box>

      {/* Table */}
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Клиент / Телефон</TableCell>
              <TableCell>Мессенджер</TableCell>
              <TableCell>Профиль</TableCell>
              <TableCell>Статус</TableCell>
              <TableCell>Отправлено</TableCell>
              <TableCell>Ошибка</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {messages.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center">
                  <Typography color="text.secondary" sx={{ py: 4 }}>
                    {isLoading ? 'Загрузка...' : 'Нет сообщений'}
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              messages.map((message) => (
                <TableRow key={message.id} hover>
                  <TableCell>
                    <Box>
                      <Typography variant="body2" fontWeight={500}>
                        {message.clientName || 'Клиент'}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {message.phoneNumber || message.clientPhoneId}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    {message.messenger ? (
                      <Chip
                        size="small"
                        label={message.messenger === 'WHATSAPP' ? 'WhatsApp' : 'Telegram'}
                        color={message.messenger === 'WHATSAPP' ? 'success' : 'info'}
                        variant="outlined"
                      />
                    ) : (
                      <Typography variant="caption" color="text.secondary">—</Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {message.profileName || message.profileId || '—'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <MessageStatusBadge status={message.status} size="small" />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {formatDateTime(message.sentAt)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {message.errorMessage ? (
                      <Tooltip title={message.errorMessage}>
                        <Typography
                          variant="caption"
                          color="error"
                          sx={{
                            display: 'block',
                            maxWidth: 200,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {message.errorMessage}
                        </Typography>
                      </Tooltip>
                    ) : (
                      <Typography variant="caption" color="text.secondary">—</Typography>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Pagination */}
      <TablePagination
        component="div"
        count={totalCount}
        page={(query.page || 1) - 1}
        rowsPerPage={query.limit || 20}
        onPageChange={handlePageChange}
        onRowsPerPageChange={handleRowsPerPageChange}
        rowsPerPageOptions={[10, 20, 50, 100]}
        labelRowsPerPage="Строк:"
        labelDisplayedRows={({ from, to, count }) => `${from}-${to} из ${count}`}
      />
    </Paper>
  );
}


