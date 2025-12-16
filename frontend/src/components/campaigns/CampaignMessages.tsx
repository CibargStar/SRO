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
  MenuItem,
  Stack,
  Divider,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  FilterList as FilterIcon,
} from '@mui/icons-material';
import { StyledSelect, MenuProps, selectInputLabelStyles } from '@/components/common';
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
            Сообщения ({totalCount})
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
              <InputLabel sx={selectInputLabelStyles}>Статус</InputLabel>
              <StyledSelect
                value={query.status || ''}
                onChange={handleStatusChange}
                label="Статус"
                MenuProps={MenuProps}
              >
                <MenuItem value="">Все</MenuItem>
                {Object.entries(MESSAGE_STATUS_LABELS).map(([value, label]) => (
                  <MenuItem key={value} value={value}>
                    {label}
                  </MenuItem>
                ))}
              </StyledSelect>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel sx={selectInputLabelStyles}>Мессенджер</InputLabel>
              <StyledSelect
                value={query.messenger || ''}
                onChange={handleMessengerChange}
                label="Мессенджер"
                MenuProps={MenuProps}
              >
                <MenuItem value="">Все</MenuItem>
                <MenuItem value="WHATSAPP">WhatsApp</MenuItem>
                <MenuItem value="TELEGRAM">Telegram</MenuItem>
              </StyledSelect>
            </FormControl>
          </Stack>
        )}
      </Box>

      {showFilters && <Divider sx={{ borderColor: 'rgba(255, 255, 255, 0.08)' }} />}

      {/* Table */}
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ color: 'rgba(255, 255, 255, 0.7)', fontWeight: 500, borderColor: 'rgba(255, 255, 255, 0.08)' }}>
                Клиент / Телефон
              </TableCell>
              <TableCell sx={{ color: 'rgba(255, 255, 255, 0.7)', fontWeight: 500, borderColor: 'rgba(255, 255, 255, 0.08)' }}>
                Мессенджер
              </TableCell>
              <TableCell sx={{ color: 'rgba(255, 255, 255, 0.7)', fontWeight: 500, borderColor: 'rgba(255, 255, 255, 0.08)' }}>
                Профиль
              </TableCell>
              <TableCell sx={{ color: 'rgba(255, 255, 255, 0.7)', fontWeight: 500, borderColor: 'rgba(255, 255, 255, 0.08)' }}>
                Статус
              </TableCell>
              <TableCell sx={{ color: 'rgba(255, 255, 255, 0.7)', fontWeight: 500, borderColor: 'rgba(255, 255, 255, 0.08)' }}>
                Отправлено
              </TableCell>
              <TableCell sx={{ color: 'rgba(255, 255, 255, 0.7)', fontWeight: 500, borderColor: 'rgba(255, 255, 255, 0.08)' }}>
                Ошибка
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {messages.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center" sx={{ borderColor: 'rgba(255, 255, 255, 0.08)' }}>
                  <Typography sx={{ py: 4, color: 'rgba(255, 255, 255, 0.5)' }}>
                    {isLoading ? 'Загрузка...' : 'Нет сообщений'}
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              messages.map((message) => (
                <TableRow 
                  key={message.id} 
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
                  <TableCell>
                    <Box>
                      <Typography variant="body2" sx={{ color: '#f5f5f5', fontWeight: 500 }}>
                        {message.clientName || 'Клиент'}
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.5)' }}>
                        {message.phoneNumber || message.clientPhoneId}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    {message.messenger ? (
                      <Chip
                        size="small"
                        label={message.messenger === 'WHATSAPP' ? 'WhatsApp' : 'Telegram'}
                        sx={{
                          backgroundColor: message.messenger === 'WHATSAPP' 
                            ? 'rgba(37, 211, 102, 0.2)' 
                            : 'rgba(0, 136, 204, 0.2)',
                          color: message.messenger === 'WHATSAPP' ? '#25D366' : '#0088cc',
                          border: '1px solid',
                          borderColor: message.messenger === 'WHATSAPP' 
                            ? 'rgba(37, 211, 102, 0.4)' 
                            : 'rgba(0, 136, 204, 0.4)',
                        }}
                      />
                    ) : (
                      <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.5)' }}>—</Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                      {message.profileName || message.profileId || '—'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <MessageStatusBadge status={message.status} size="small" />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                      {formatDateTime(message.sentAt)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {message.errorMessage ? (
                      <Tooltip title={message.errorMessage}>
                        <Typography
                          variant="caption"
                          sx={{
                            color: '#f44336',
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
                      <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.5)' }}>—</Typography>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Pagination */}
      <Divider sx={{ borderColor: 'rgba(255, 255, 255, 0.08)' }} />
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
        sx={{
          color: 'rgba(255, 255, 255, 0.7)',
          '& .MuiTablePagination-selectLabel, & .MuiTablePagination-displayedRows': {
            color: 'rgba(255, 255, 255, 0.7)',
          },
          '& .MuiIconButton-root': {
            color: 'rgba(255, 255, 255, 0.7)',
            '&.Mui-disabled': {
              color: 'rgba(255, 255, 255, 0.3)',
            },
            '&:hover': {
              backgroundColor: 'rgba(255, 255, 255, 0.08)',
            },
          },
          '& .MuiSelect-select': {
            color: 'rgba(255, 255, 255, 0.7)',
          },
        }}
      />
    </Paper>
  );
}



