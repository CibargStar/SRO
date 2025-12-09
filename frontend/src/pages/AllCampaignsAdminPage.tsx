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
  Select,
  MenuItem,
  TextField,
  Stack,
  IconButton,
  Button,
  CircularProgress,
  Alert,
} from '@mui/material';
import { Cancel as CancelIcon, Refresh as RefreshIcon, Visibility as ViewIcon } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
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
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h4">Все кампании (ROOT)</Typography>
        <Stack direction="row" spacing={1}>
          <IconButton onClick={() => refetch()} disabled={isLoading}>
            <RefreshIcon />
          </IconButton>
        </Stack>
      </Box>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <Select
            size="small"
            displayEmpty
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            sx={{ minWidth: 180 }}
          >
            <MenuItem value="">Все статусы</MenuItem>
            {STATUS_OPTIONS.map((s) => (
              <MenuItem key={s} value={s}>
                {s}
              </MenuItem>
            ))}
          </Select>
          <TextField
            size="small"
            label="UserId"
            value={userFilter}
            onChange={(e) => setUserFilter(e.target.value)}
            placeholder="UUID пользователя"
          />
          <Button variant="outlined" onClick={() => refetch()} disabled={isLoading}>
            Применить
          </Button>
        </Stack>
      </Paper>

      {isLoading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      )}

      {error && <Alert severity="error">Ошибка загрузки: {error.message}</Alert>}

      {!isLoading && !error && (
        <Paper>
          <TableContainer>
            <Table size="small">
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
                {rows.map((c) => (
                  <TableRow key={c.id} hover>
                    <TableCell>{c.name}</TableCell>
                    <TableCell>{c.user?.email ?? c.userId}</TableCell>
                    <TableCell>{c.campaignType}</TableCell>
                    <TableCell>{c.messengerType}</TableCell>
                    <TableCell>
                      <Chip label={c.status} size="small" color={c.status === 'RUNNING' ? 'success' : c.status === 'ERROR' ? 'error' : 'default'} />
                    </TableCell>
                    <TableCell>{new Date(c.createdAt).toLocaleString()}</TableCell>
                    <TableCell align="right">
                      <IconButton size="small" onClick={() => navigate(`/campaigns/${c.id}`)}>
                        <ViewIcon />
                      </IconButton>
                      {['RUNNING', 'QUEUED', 'PAUSED', 'SCHEDULED'].includes(c.status) && (
                        <IconButton
                          size="small"
                          color="error"
                          onClick={() => handleCancel(c.id)}
                          disabled={cancelMutation.isPending}
                        >
                          <CancelIcon />
                        </IconButton>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}
    </Box>
  );
}

export default AllCampaignsAdminPage;


