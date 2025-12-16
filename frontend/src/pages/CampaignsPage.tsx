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
  Grid,
  Alert,
  CircularProgress,
  InputAdornment,
  FormControl,
  InputLabel,
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
  Tooltip,
  IconButton,
} from '@mui/material';
import {
  Add as AddIcon,
  Search as SearchIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { StyledButton, StyledTextField, StyledSelect, MenuProps, selectInputLabelStyles, CancelButton, LOADING_ICON_SIZE } from '@/components/common';
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
import { CampaignCard, DeleteCampaignDialog, CancelCampaignDialog } from '@/components/campaigns';
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
    if (typeFilter !== 'ALL') q.campaignType = typeFilter;
    if (messengerFilter !== 'ALL') q.messengerType = messengerFilter;

    // Логика табов (приоритет над фильтром статуса)
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
      case 'all':
      default:
        // Для 'all' используем фильтр статуса, если он задан
        if (statusFilter !== 'ALL') {
          q.status = statusFilter;
        }
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
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            mb: 3,
          }}
        >
          <Typography variant="h4" component="h1" sx={{ color: '#f5f5f5', fontWeight: 500 }}>
            Кампании рассылок
          </Typography>
          <StyledButton
            startIcon={<AddIcon />}
            onClick={handleCreate}
            size="large"
          >
            Создать кампанию
          </StyledButton>
        </Box>

        {/* Табы */}
        <Paper sx={{ mb: 3, backgroundColor: 'rgba(255, 255, 255, 0.06)', borderRadius: '16px', border: 'none' }}>
          <Tabs
            value={tabValue}
            onChange={handleTabChange}
            sx={{
              '& .MuiTab-root': {
                color: 'rgba(255, 255, 255, 0.7)',
                '&.Mui-selected': {
                  color: '#6366f1',
                },
              },
              '& .MuiTabs-indicator': {
                backgroundColor: '#6366f1',
              },
            }}
          >
            <Tab label="Все" value="all" />
            <Tab
              label={
                <Stack direction="row" spacing={1} alignItems="center">
                  <span>Активные</span>
                  {activeCampaigns > 0 && (
                    <Chip 
                      label={activeCampaigns} 
                      size="small" 
                      sx={{
                        backgroundColor: 'rgba(99, 102, 241, 0.2)',
                        color: '#818cf8',
                        height: 20,
                        fontSize: '0.7rem',
                      }}
                    />
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
        <Paper sx={{ p: 2.5, mb: 3, backgroundColor: 'rgba(255, 255, 255, 0.06)', borderRadius: '16px', border: 'none' }}>
          <Grid container spacing={2} alignItems="center">
            {/* Поиск */}
            <Grid item xs={12} md={4}>
              <StyledTextField
                fullWidth
                size="small"
                placeholder="Поиск по названию..."
                value={search}
                onChange={handleSearchChange}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon sx={{ color: 'rgba(255, 255, 255, 0.5)' }} />
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>

            {/* Фильтр по статусу */}
            <Grid item xs={12} sm={6} md={2}>
              <FormControl fullWidth size="small">
                <InputLabel sx={selectInputLabelStyles}>Статус</InputLabel>
                <StyledSelect
                  value={statusFilter}
                  label="Статус"
                  onChange={(e) => {
                    setStatusFilter(e.target.value as CampaignStatus | 'ALL');
                    setPage(1);
                  }}
                  MenuProps={MenuProps}
                >
                  {STATUS_OPTIONS.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </StyledSelect>
              </FormControl>
            </Grid>

            {/* Фильтр по типу */}
            <Grid item xs={12} sm={6} md={2}>
              <FormControl fullWidth size="small">
                <InputLabel sx={selectInputLabelStyles}>Тип</InputLabel>
                <StyledSelect
                  value={typeFilter}
                  label="Тип"
                  onChange={(e) => {
                    setTypeFilter(e.target.value as CampaignType | 'ALL');
                    setPage(1);
                  }}
                  MenuProps={MenuProps}
                >
                  {TYPE_OPTIONS.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </StyledSelect>
              </FormControl>
            </Grid>

            {/* Фильтр по мессенджеру */}
            <Grid item xs={12} sm={6} md={2}>
              <FormControl fullWidth size="small">
                <InputLabel sx={selectInputLabelStyles}>Мессенджер</InputLabel>
                <StyledSelect
                  value={messengerFilter}
                  label="Мессенджер"
                  onChange={(e) => {
                    setMessengerFilter(e.target.value as MessengerTarget | 'ALL');
                    setPage(1);
                  }}
                  MenuProps={MenuProps}
                >
                  {MESSENGER_OPTIONS.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </StyledSelect>
              </FormControl>
            </Grid>

            {/* Кнопка обновления */}
            <Grid item xs={12} sm={6} md={2}>
              <Tooltip title="Обновить список">
                <IconButton
                  onClick={() => refetch()}
                  sx={{
                    backgroundColor: 'rgba(255, 255, 255, 0.08)',
                    color: '#f5f5f5',
                    '&:hover': {
                      backgroundColor: 'rgba(255, 255, 255, 0.12)',
                    },
                  }}
                >
                  <RefreshIcon />
                </IconButton>
              </Tooltip>
            </Grid>
          </Grid>
        </Paper>

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
              <Paper sx={{ p: 4, textAlign: 'center', backgroundColor: 'rgba(255, 255, 255, 0.06)', borderRadius: '16px', border: 'none' }}>
                <Typography variant="h6" sx={{ color: 'rgba(255, 255, 255, 0.7)', mb: 1, fontWeight: 500 }}>
                  Кампании не найдены
                </Typography>
                <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.5)', mb: 2 }}>
                  {search || statusFilter !== 'ALL' || typeFilter !== 'ALL' || messengerFilter !== 'ALL'
                    ? 'Попробуйте изменить фильтры поиска'
                    : 'Создайте вашу первую кампанию рассылок'}
                </Typography>
                {!search && statusFilter === 'ALL' && typeFilter === 'ALL' && messengerFilter === 'ALL' && (
                  <StyledButton
                    startIcon={<AddIcon />}
                    onClick={handleCreate}
                  >
                    Создать кампанию
                  </StyledButton>
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
        <DeleteCampaignDialog
          open={!!deleteDialogCampaign}
          onClose={() => setDeleteDialogCampaign(null)}
          campaign={deleteDialogCampaign}
          onSuccess={() => refetch()}
        />

        {/* Диалог отмены */}
        <CancelCampaignDialog
          open={!!cancelDialogCampaign}
          onClose={() => setCancelDialogCampaign(null)}
          campaign={cancelDialogCampaign}
          onSuccess={() => refetch()}
        />
      </Box>
    </Box>
  );
}



