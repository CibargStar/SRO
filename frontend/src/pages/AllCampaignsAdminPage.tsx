import React, { useMemo, useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  MenuItem,
  Stack,
  IconButton,
  CircularProgress,
  Alert,
  FormControl,
  InputLabel,
  Tooltip,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import { Cancel as CancelIcon, Refresh as RefreshIcon, Visibility as ViewIcon } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { StyledTextField, StyledButton, StyledSelect, MenuProps, selectInputLabelStyles } from '@/components/common';
import { LOADING_ICON_SIZE } from '@/components/common/Constants';
import { useAdminCampaigns, useCancelAnyCampaign } from '@/hooks/useAdminCampaigns';
import type { AdminCampaignsListResponse, CampaignStatus } from '@/types/campaign';

const STATUS_OPTIONS: CampaignStatus[] = [
  'DRAFT',
  'SCHEDULED',
  'QUEUED',
  'RUNNING',
  'PAUSED',
  'COMPLETED',
  'CANCELLED',
  'ERROR',
  'ARCHIVED',
];

const STATUS_LABELS: Record<CampaignStatus, string> = {
  DRAFT: 'Черновик',
  SCHEDULED: 'Запланирована',
  QUEUED: 'В очереди',
  RUNNING: 'Запущена',
  PAUSED: 'Приостановлена',
  COMPLETED: 'Завершена',
  CANCELLED: 'Отменена',
  ERROR: 'Ошибка',
  ARCHIVED: 'Архивирована',
};

const StyledTableContainer = styled(TableContainer)({
  borderRadius: '12px',
  backgroundColor: 'rgba(255, 255, 255, 0.06)',
  border: 'none',
});

const StyledTable = styled(Table)({
  '& .MuiTableHead-root': {
    '& .MuiTableRow-root': {
      '& .MuiTableCell-root': {
        color: '#f5f5f5',
        fontWeight: 500,
        fontSize: '0.875rem',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        backgroundColor: 'rgba(255, 255, 255, 0.04)',
      },
    },
  },
  '& .MuiTableBody-root': {
    '& .MuiTableRow-root': {
      '&:hover': {
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
      },
      '& .MuiTableCell-root': {
        color: 'rgba(255, 255, 255, 0.9)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
        fontSize: '0.875rem',
      },
    },
  },
});

export function AllCampaignsAdminPage() {
  const [status, setStatus] = useState<string>('');
  const [userFilter, setUserFilter] = useState<string>('');
  const [page] = useState<number>(1);
  const [limit] = useState<number>(50);

  const params = useMemo(
    () => ({
      status: status || undefined,
      userId: userFilter || undefined,
      page,
      limit,
    }),
    [status, userFilter, page, limit]
  );

  const { data, isLoading, error, refetch } = useAdminCampaigns(params);
  const cancelMutation = useCancelAnyCampaign();
  const navigate = useNavigate();

  const handleCancel = (campaignId: string) => {
    cancelMutation.mutate({ campaignId, params });
  };

  const rows = data?.data ?? [];

  return (
    <Box
      sx={{
        width: '100%',
        overflowY: 'auto',
        '&::-webkit-scrollbar': {
          display: 'none',
          width: 0,
          height: 0,
        },
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
        '& *': {
          '&::-webkit-scrollbar': {
            display: 'none',
            width: 0,
            height: 0,
          },
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        },
      }}
    >
      <Box sx={{ maxWidth: 1600, mx: 'auto', p: 3 }}>
        {/* Заголовок */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Typography variant="h4" component="h1" sx={{ color: '#f5f5f5', fontWeight: 500 }}>
            Все кампании (ROOT)
          </Typography>
          <Tooltip title="Обновить">
            <IconButton 
              onClick={() => refetch()} 
              disabled={isLoading}
              sx={{
                color: 'rgba(255, 255, 255, 0.7)',
                '&:hover': {
                  color: '#fff',
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                },
              }}
            >
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </Box>

        {/* Фильтры */}
        <Paper sx={{ p: 3, mb: 3, backgroundColor: 'rgba(255, 255, 255, 0.06)', borderRadius: '16px', border: 'none' }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="flex-end">
            <FormControl sx={{ minWidth: 200 }}>
              <InputLabel shrink sx={selectInputLabelStyles}>
                Статус
              </InputLabel>
              <StyledSelect
                size="small"
                displayEmpty
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                label="Статус"
                MenuProps={MenuProps}
              >
                <MenuItem value="">Все статусы</MenuItem>
                {STATUS_OPTIONS.map((s) => (
                  <MenuItem key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </MenuItem>
                ))}
              </StyledSelect>
            </FormControl>
            <StyledTextField
              size="small"
              label="UserId"
              value={userFilter}
              onChange={(e) => setUserFilter(e.target.value)}
              placeholder="UUID пользователя"
              sx={{ flex: 1, maxWidth: 400 }}
            />
            <StyledButton onClick={() => refetch()} disabled={isLoading} sx={{ minWidth: 120 }}>
              {isLoading ? (
                <CircularProgress size={LOADING_ICON_SIZE} color="inherit" />
              ) : (
                'Применить'
              )}
            </StyledButton>
          </Stack>
        </Paper>

        {/* Загрузка */}
        {isLoading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress />
          </Box>
        )}

        {/* Ошибка */}
        {error && (
          <Alert 
            severity="error"
            sx={{
              mb: 3,
              borderRadius: '12px',
              backgroundColor: 'rgba(244, 67, 54, 0.1)',
              color: '#f44336',
              border: '1px solid rgba(244, 67, 54, 0.2)',
            }}
          >
            Ошибка загрузки: {error.message}
          </Alert>
        )}

        {/* Таблица */}
        {!isLoading && !error && (
          <StyledTableContainer>
            <StyledTable size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Кампания</TableCell>
                  <TableCell>Пользователь</TableCell>
                  <TableCell>Тип</TableCell>
                  <TableCell>Мессенджер</TableCell>
                  <TableCell>Статус</TableCell>
                  <TableCell>Создано</TableCell>
                  <TableCell align="right">Действия</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} align="center" sx={{ py: 6 }}>
                      <Typography sx={{ color: 'rgba(255, 255, 255, 0.6)' }}>
                        Кампании не найдены
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((c) => (
                    <TableRow key={c.id} hover>
                      <TableCell>
                        <Typography sx={{ color: '#f5f5f5', fontWeight: 500 }}>
                          {c.name}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography sx={{ color: 'rgba(255, 255, 255, 0.8)' }}>
                          {c.user?.email ?? c.userId}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={c.campaignType}
                          size="small"
                          sx={{
                            backgroundColor: 'rgba(99, 102, 241, 0.2)',
                            color: '#818cf8',
                            fontSize: '0.75rem',
                            height: '24px',
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={c.messengerType}
                          size="small"
                          sx={{
                            backgroundColor: 'rgba(76, 175, 80, 0.2)',
                            color: '#4caf50',
                            fontSize: '0.75rem',
                            height: '24px',
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={STATUS_LABELS[c.status] || c.status}
                          size="small"
                          sx={{
                            backgroundColor:
                              c.status === 'RUNNING'
                                ? 'rgba(76, 175, 80, 0.2)'
                                : c.status === 'ERROR'
                                ? 'rgba(244, 67, 54, 0.2)'
                                : c.status === 'COMPLETED'
                                ? 'rgba(33, 150, 243, 0.2)'
                                : 'rgba(255, 255, 255, 0.12)',
                            color:
                              c.status === 'RUNNING'
                                ? '#4caf50'
                                : c.status === 'ERROR'
                                ? '#f44336'
                                : c.status === 'COMPLETED'
                                ? '#2196f3'
                                : '#f5f5f5',
                            fontSize: '0.75rem',
                            height: '24px',
                            fontWeight: 500,
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <Typography sx={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '0.85rem' }}>
                          {new Date(c.createdAt).toLocaleString('ru-RU')}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                          <Tooltip title="Просмотр">
                            <IconButton
                              size="small"
                              onClick={() => navigate(`/campaigns/${c.id}`)}
                              sx={{
                                color: 'rgba(255, 255, 255, 0.7)',
                                '&:hover': {
                                  color: '#2196f3',
                                  backgroundColor: 'rgba(33, 150, 243, 0.1)',
                                },
                              }}
                            >
                              <ViewIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          {['RUNNING', 'QUEUED', 'PAUSED', 'SCHEDULED'].includes(c.status) && (
                            <Tooltip title="Отменить">
                              <IconButton
                                size="small"
                                onClick={() => handleCancel(c.id)}
                                disabled={cancelMutation.isPending}
                                sx={{
                                  color: 'rgba(255, 255, 255, 0.7)',
                                  '&:hover': {
                                    color: '#f44336',
                                    backgroundColor: 'rgba(244, 67, 54, 0.1)',
                                  },
                                  '&:disabled': {
                                    color: 'rgba(255, 255, 255, 0.3)',
                                  },
                                }}
                              >
                                {cancelMutation.isPending ? (
                                  <CircularProgress size={16} />
                                ) : (
                                  <CancelIcon fontSize="small" />
                                )}
                              </IconButton>
                            </Tooltip>
                          )}
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </StyledTable>
          </StyledTableContainer>
        )}
      </Box>
    </Box>
  );
}

export default AllCampaignsAdminPage;



