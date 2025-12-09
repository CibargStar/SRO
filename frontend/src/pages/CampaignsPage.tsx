/**
 * Страница списка кампаний
 * 
 * Отображает список кампаний пользователя с возможностью:
 * - Фильтрации по статусу и типу
 * - Поиска по названию
 * - Управления кампаниями (создание, редактирование, удаление)
 * - Запуска, паузы, отмены кампаний
 */

import React, { useState, useMemo, useCallback } from 'react';
import {
  Box,
  Typography,
  Button,
  Grid,
  Alert,
  CircularProgress,
  TextField,
  InputAdornment,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Pagination,
  Stack,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  DialogContentText,
  Tabs,
  Tab,
  Paper,
  Chip,
} from '@mui/material';
import {
  Add as AddIcon,
  Search as SearchIcon,
  FilterList as FilterIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import {
  useCampaigns,
  useDeleteCampaign,
  useDuplicateCampaign,
  useArchiveCampaign,
  useStartCampaign,
  usePauseCampaign,
  useResumeCampaign,
  useCancelCampaign,
} from '@/hooks';
import { CampaignCard } from '@/components/campaigns';
import type {
  Campaign,
  CampaignStatus,
  CampaignType,
  MessengerTarget,
  ListCampaignsQuery,
} from '@/types/campaign';
import {
  CAMPAIGN_STATUS_LABELS,
  CAMPAIGN_TYPE_LABELS,
  MESSENGER_TARGET_LABELS,
} from '@/types/campaign';

// Статусы для фильтрации
const STATUS_OPTIONS: { value: CampaignStatus | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'Все статусы' },
  { value: 'DRAFT', label: CAMPAIGN_STATUS_LABELS.DRAFT },
  { value: 'SCHEDULED', label: CAMPAIGN_STATUS_LABELS.SCHEDULED },
  { value: 'QUEUED', label: CAMPAIGN_STATUS_LABELS.QUEUED },
  { value: 'RUNNING', label: CAMPAIGN_STATUS_LABELS.RUNNING },
  { value: 'PAUSED', label: CAMPAIGN_STATUS_LABELS.PAUSED },
  { value: 'COMPLETED', label: CAMPAIGN_STATUS_LABELS.COMPLETED },
  { value: 'CANCELLED', label: CAMPAIGN_STATUS_LABELS.CANCELLED },
  { value: 'ERROR', label: CAMPAIGN_STATUS_LABELS.ERROR },
];

// Типы для фильтрации
const TYPE_OPTIONS: { value: CampaignType | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'Все типы' },
  { value: 'ONE_TIME', label: CAMPAIGN_TYPE_LABELS.ONE_TIME },
  { value: 'SCHEDULED', label: CAMPAIGN_TYPE_LABELS.SCHEDULED },
];

// Мессенджеры для фильтрации
const MESSENGER_OPTIONS: { value: MessengerTarget | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'Все мессенджеры' },
  { value: 'WHATSAPP_ONLY', label: MESSENGER_TARGET_LABELS.WHATSAPP_ONLY },
  { value: 'TELEGRAM_ONLY', label: MESSENGER_TARGET_LABELS.TELEGRAM_ONLY },
  { value: 'UNIVERSAL', label: MESSENGER_TARGET_LABELS.UNIVERSAL },
];

// Табы для быстрой фильтрации
type TabValue = 'all' | 'active' | 'completed' | 'archived';

export function CampaignsPage() {
  const navigate = useNavigate();

  // Состояние фильтров
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<CampaignStatus | 'ALL'>('ALL');
  const [typeFilter, setTypeFilter] = useState<CampaignType | 'ALL'>('ALL');
  const [messengerFilter, setMessengerFilter] = useState<MessengerTarget | 'ALL'>('ALL');
  const [page, setPage] = useState(1);
  const [tabValue, setTabValue] = useState<TabValue>('all');

  // Состояние диалогов
  const [deleteDialogCampaign, setDeleteDialogCampaign] = useState<Campaign | null>(null);
  const [cancelDialogCampaign, setCancelDialogCampaign] = useState<Campaign | null>(null);

  // Формируем query параметры
  const query: ListCampaignsQuery = useMemo(() => {
    const q: ListCampaignsQuery = {
      page,
      limit: 12,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    };

    if (search) q.search = search;
    if (statusFilter !== 'ALL') q.status = statusFilter;
    if (typeFilter !== 'ALL') q.campaignType = typeFilter;
    if (messengerFilter !== 'ALL') q.messengerType = messengerFilter;

    // Логика табов
    switch (tabValue) {
      case 'active':
        q.status = ['RUNNING', 'PAUSED', 'QUEUED'];
        break;
      case 'completed':
        q.status = ['COMPLETED', 'CANCELLED', 'ERROR'];
        q.includeArchived = false;
        break;
      case 'archived':
        q.includeArchived = true;
        break;
    }

    return q;
  }, [page, search, statusFilter, typeFilter, messengerFilter, tabValue]);

  // Получаем список кампаний
  const { data, isLoading, error, refetch } = useCampaigns(query, {
    refetchInterval: 10000, // Обновляем каждые 10 секунд для активных кампаний
  });

  // Мутации
  const deleteMutation = useDeleteCampaign();
  const duplicateMutation = useDuplicateCampaign();
  const archiveMutation = useArchiveCampaign();
  const startMutation = useStartCampaign();
  const pauseMutation = usePauseCampaign();
  const resumeMutation = useResumeCampaign();
  const cancelMutation = useCancelCampaign();

  // Обработчики
  const handleView = useCallback((campaign: Campaign) => {
    navigate(`/campaigns/${campaign.id}`);
  }, [navigate]);

  const handleEdit = useCallback((campaign: Campaign) => {
    navigate(`/campaigns/${campaign.id}/edit`);
  }, [navigate]);

  const handleCreate = useCallback(() => {
    navigate('/campaigns/create');
  }, [navigate]);

  const handleDelete = useCallback((campaign: Campaign) => {
    setDeleteDialogCampaign(campaign);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (deleteDialogCampaign) {
      await deleteMutation.mutateAsync(deleteDialogCampaign.id);
      setDeleteDialogCampaign(null);
    }
  }, [deleteDialogCampaign, deleteMutation]);

  const handleDuplicate = useCallback(async (campaign: Campaign) => {
    await duplicateMutation.mutateAsync({ campaignId: campaign.id });
  }, [duplicateMutation]);

  const handleArchive = useCallback(async (campaign: Campaign) => {
    await archiveMutation.mutateAsync(campaign.id);
  }, [archiveMutation]);

  const handleStart = useCallback(async (campaign: Campaign) => {
    await startMutation.mutateAsync({ campaignId: campaign.id });
  }, [startMutation]);

  const handlePause = useCallback(async (campaign: Campaign) => {
    await pauseMutation.mutateAsync(campaign.id);
  }, [pauseMutation]);

  const handleResume = useCallback(async (campaign: Campaign) => {
    await resumeMutation.mutateAsync(campaign.id);
  }, [resumeMutation]);

  const handleCancel = useCallback((campaign: Campaign) => {
    setCancelDialogCampaign(campaign);
  }, []);

  const handleConfirmCancel = useCallback(async () => {
    if (cancelDialogCampaign) {
      await cancelMutation.mutateAsync(cancelDialogCampaign.id);
      setCancelDialogCampaign(null);
    }
  }, [cancelDialogCampaign, cancelMutation]);

  const handleTabChange = useCallback((_: React.SyntheticEvent, newValue: TabValue) => {
    setTabValue(newValue);
    setPage(1);
    // Сбрасываем фильтр статуса при переключении табов
    setStatusFilter('ALL');
  }, []);

  const handleSearchChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(event.target.value);
    setPage(1);
  }, []);

  const handlePageChange = useCallback((_: React.ChangeEvent<unknown>, value: number) => {
    setPage(value);
  }, []);

  // Счётчики для табов
  const activeCampaigns = data?.data.filter(
    (c) => c.status === 'RUNNING' || c.status === 'PAUSED' || c.status === 'QUEUED'
  ).length || 0;

  return (
    <Box>
      {/* Заголовок */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          mb: 3,
        }}
      >
        <Typography variant="h4" component="h1">
          Кампании рассылок
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleCreate}
          size="large"
        >
          Создать кампанию
        </Button>
      </Box>

      {/* Табы */}
      <Paper sx={{ mb: 3 }}>
        <Tabs
          value={tabValue}
          onChange={handleTabChange}
          indicatorColor="primary"
          textColor="primary"
        >
          <Tab label="Все" value="all" />
          <Tab
            label={
              <Stack direction="row" spacing={1} alignItems="center">
                <span>Активные</span>
                {activeCampaigns > 0 && (
                  <Chip label={activeCampaigns} size="small" color="primary" />
                )}
              </Stack>
            }
            value="active"
          />
          <Tab label="Завершённые" value="completed" />
          <Tab label="Архив" value="archived" />
        </Tabs>
      </Paper>

      {/* Фильтры */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          {/* Поиск */}
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              size="small"
              placeholder="Поиск по названию..."
              value={search}
              onChange={handleSearchChange}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon color="action" />
                  </InputAdornment>
                ),
              }}
            />
          </Grid>

          {/* Фильтр по статусу */}
          <Grid item xs={12} sm={6} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Статус</InputLabel>
              <Select
                value={statusFilter}
                label="Статус"
                onChange={(e) => {
                  setStatusFilter(e.target.value as CampaignStatus | 'ALL');
                  setPage(1);
                }}
              >
                {STATUS_OPTIONS.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          {/* Фильтр по типу */}
          <Grid item xs={12} sm={6} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Тип</InputLabel>
              <Select
                value={typeFilter}
                label="Тип"
                onChange={(e) => {
                  setTypeFilter(e.target.value as CampaignType | 'ALL');
                  setPage(1);
                }}
              >
                {TYPE_OPTIONS.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          {/* Фильтр по мессенджеру */}
          <Grid item xs={12} sm={6} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Мессенджер</InputLabel>
              <Select
                value={messengerFilter}
                label="Мессенджер"
                onChange={(e) => {
                  setMessengerFilter(e.target.value as MessengerTarget | 'ALL');
                  setPage(1);
                }}
              >
                {MESSENGER_OPTIONS.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          {/* Кнопка обновления */}
          <Grid item xs={12} sm={6} md={2}>
            <Button
              fullWidth
              variant="outlined"
              startIcon={<RefreshIcon />}
              onClick={() => refetch()}
            >
              Обновить
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {/* Ошибка */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          Ошибка загрузки кампаний: {(error as Error).message}
        </Alert>
      )}

      {/* Загрузка */}
      {isLoading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      )}

      {/* Список кампаний */}
      {!isLoading && data && (
        <>
          {data.data.length === 0 ? (
            <Paper sx={{ p: 4, textAlign: 'center' }}>
              <Typography variant="h6" color="text.secondary" gutterBottom>
                Кампании не найдены
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {search || statusFilter !== 'ALL' || typeFilter !== 'ALL' || messengerFilter !== 'ALL'
                  ? 'Попробуйте изменить фильтры поиска'
                  : 'Создайте вашу первую кампанию рассылок'}
              </Typography>
              {!search && statusFilter === 'ALL' && typeFilter === 'ALL' && messengerFilter === 'ALL' && (
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={handleCreate}
                >
                  Создать кампанию
                </Button>
              )}
            </Paper>
          ) : (
            <>
              <Grid container spacing={3}>
                {data.data.map((campaign) => (
                  <Grid item xs={12} sm={6} md={4} key={campaign.id}>
                    <CampaignCard
                      campaign={campaign}
                      onView={handleView}
                      onEdit={handleEdit}
                      onStart={handleStart}
                      onPause={handlePause}
                      onResume={handleResume}
                      onCancel={handleCancel}
                      onDuplicate={handleDuplicate}
                      onArchive={handleArchive}
                      onDelete={handleDelete}
                    />
                  </Grid>
                ))}
              </Grid>

              {/* Пагинация */}
              {data.pagination.totalPages > 1 && (
                <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
                  <Pagination
                    count={data.pagination.totalPages}
                    page={data.pagination.page}
                    onChange={handlePageChange}
                    color="primary"
                    showFirstButton
                    showLastButton
                  />
                </Box>
              )}
            </>
          )}
        </>
      )}

      {/* Диалог удаления */}
      <Dialog
        open={!!deleteDialogCampaign}
        onClose={() => setDeleteDialogCampaign(null)}
      >
        <DialogTitle>Удалить кампанию?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Вы уверены, что хотите удалить кампанию &quot;{deleteDialogCampaign?.name}&quot;?
            Это действие нельзя отменить.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogCampaign(null)}>
            Отмена
          </Button>
          <Button
            onClick={handleConfirmDelete}
            color="error"
            disabled={deleteMutation.isPending}
          >
            {deleteMutation.isPending ? 'Удаление...' : 'Удалить'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Диалог отмены */}
      <Dialog
        open={!!cancelDialogCampaign}
        onClose={() => setCancelDialogCampaign(null)}
      >
        <DialogTitle>Отменить кампанию?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Вы уверены, что хотите отменить кампанию &quot;{cancelDialogCampaign?.name}&quot;?
            Все необработанные сообщения будут отменены.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCancelDialogCampaign(null)}>
            Нет
          </Button>
          <Button
            onClick={handleConfirmCancel}
            color="error"
            disabled={cancelMutation.isPending}
          >
            {cancelMutation.isPending ? 'Отмена...' : 'Да, отменить'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}


