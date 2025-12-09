/**
 * CampaignDetailsPage.tsx
 * 
 * Страница детальной информации о кампании
 * Отображает информацию, прогресс, сообщения, логи и статистику
 */

import React, { useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Alert,
  CircularProgress,
  Tabs,
  Tab,
  Button,
  Stack,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Breadcrumbs,
  Link,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  PlayArrow as StartIcon,
  Pause as PauseIcon,
  Stop as StopIcon,
  Refresh as RefreshIcon,
  Download as ExportIcon,
  ContentCopy as DuplicateIcon,
  Archive as ArchiveIcon,
  Edit as EditIcon,
} from '@mui/icons-material';
import {
  useCampaign,
  useCampaignProgress,
  useCampaignMessages,
  useCampaignLogs,
  useCampaignStats,
  useStartCampaign,
  usePauseCampaign,
  useResumeCampaign,
  useCancelCampaign,
  useDuplicateCampaign,
  useArchiveCampaign,
  useExportCampaign,
} from '@/hooks/useCampaigns';
import {
  CampaignDetails,
  CampaignMessages,
  CampaignLogs,
  CampaignStatsView,
  CampaignStatusBadge,
  CampaignProgress as CampaignProgressBlock,
} from '@/components/campaigns';
import type { ListMessagesQuery, ListLogsQuery, CampaignStatus } from '@/types/campaign';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel({ children, value, index, ...other }: TabPanelProps) {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`campaign-tabpanel-${index}`}
      aria-labelledby={`campaign-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  );
}

export function CampaignDetailsPage() {
  const { campaignId } = useParams<{ campaignId: string }>();
  const navigate = useNavigate();

  // Tab state
  const [tabValue, setTabValue] = useState(0);

  // Query states
  const [messagesQuery, setMessagesQuery] = useState<ListMessagesQuery>({ page: 1, limit: 20 });
  const [logsQuery, setLogsQuery] = useState<ListLogsQuery>({ page: 1, limit: 50 });

  // Dialogs
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);

  // Data queries
  const {
    data: campaign,
    isLoading: campaignLoading,
    error: campaignError,
    refetch: refetchCampaign,
  } = useCampaign(campaignId);

  const {
    data: progress,
    refetch: refetchProgress,
  } = useCampaignProgress(campaignId, {
    enabled: !!campaignId && ['RUNNING', 'QUEUED'].includes(campaign?.status || ''),
  });

  const {
    data: messagesData,
    isLoading: messagesLoading,
    refetch: refetchMessages,
  } = useCampaignMessages(campaignId, messagesQuery, {
    enabled: tabValue === 1,
  });

  const {
    data: logsData,
    isLoading: logsLoading,
    refetch: refetchLogs,
  } = useCampaignLogs(campaignId, logsQuery, {
    enabled: tabValue === 2,
  });

  const {
    data: stats,
    isLoading: statsLoading,
  } = useCampaignStats(campaignId, {
    enabled: tabValue === 3 && ['COMPLETED', 'CANCELLED', 'ERROR'].includes(campaign?.status || ''),
  });

  // Mutations
  const startMutation = useStartCampaign();
  const pauseMutation = usePauseCampaign();
  const resumeMutation = useResumeCampaign();
  const cancelMutation = useCancelCampaign();
  const duplicateMutation = useDuplicateCampaign();
  const archiveMutation = useArchiveCampaign();
  const exportMutation = useExportCampaign();

  // Handlers
  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleBack = () => {
    navigate('/campaigns');
  };

  const handleStart = useCallback(() => {
    if (campaignId) {
      startMutation.mutate({ campaignId });
    }
  }, [campaignId, startMutation]);

  const handlePause = useCallback(() => {
    if (campaignId) {
      pauseMutation.mutate(campaignId);
    }
  }, [campaignId, pauseMutation]);

  const handleResume = useCallback(() => {
    if (campaignId) {
      resumeMutation.mutate(campaignId);
    }
  }, [campaignId, resumeMutation]);

  const handleCancel = useCallback(() => {
    if (campaignId) {
      cancelMutation.mutate(campaignId, {
        onSuccess: () => setCancelDialogOpen(false),
      });
    }
  }, [campaignId, cancelMutation]);

  const handleDuplicate = useCallback(() => {
    if (campaignId) {
      duplicateMutation.mutate({ campaignId }, {
        onSuccess: (newCampaign) => {
          navigate(`/campaigns/${newCampaign.id}`);
        },
      });
    }
  }, [campaignId, duplicateMutation, navigate]);

  const handleArchive = useCallback(() => {
    if (campaignId) {
      archiveMutation.mutate(campaignId, {
        onSuccess: () => {
          setArchiveDialogOpen(false);
          navigate('/campaigns');
        },
      });
    }
  }, [campaignId, archiveMutation, navigate]);

  const handleExport = useCallback(() => {
    if (campaignId) {
      exportMutation.mutate(campaignId);
    }
  }, [campaignId, exportMutation]);

  const handleRefresh = useCallback(() => {
    refetchCampaign();
    if (tabValue === 1) refetchMessages();
    if (tabValue === 2) refetchLogs();
    if (['RUNNING', 'QUEUED'].includes(campaign?.status || '')) refetchProgress();
  }, [refetchCampaign, refetchMessages, refetchLogs, refetchProgress, tabValue, campaign]);

  // Loading state
  if (campaignLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  // Error state
  if (campaignError) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">
          Ошибка загрузки кампании: {(campaignError as Error).message}
        </Alert>
        <Button sx={{ mt: 2 }} onClick={handleBack}>
          Вернуться к списку
        </Button>
      </Box>
    );
  }

  // Not found state
  if (!campaign) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="warning">Кампания не найдена</Alert>
        <Button sx={{ mt: 2 }} onClick={handleBack}>
          Вернуться к списку
        </Button>
      </Box>
    );
  }

  // Action button logic
  const canStart = campaign.status === 'DRAFT' || campaign.status === 'SCHEDULED';
  const canPause = campaign.status === 'RUNNING';
  const canResume = campaign.status === 'PAUSED';
  const canCancel = ['RUNNING', 'PAUSED', 'QUEUED', 'SCHEDULED'].includes(campaign.status);
  const canArchive = ['COMPLETED', 'CANCELLED', 'ERROR'].includes(campaign.status);
  const canEdit = campaign.status === 'DRAFT';
  const isFinished = ['COMPLETED', 'CANCELLED', 'ERROR'].includes(campaign.status);

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        {/* Breadcrumbs */}
        <Breadcrumbs sx={{ mb: 2 }}>
          <Link
            color="inherit"
            href="/campaigns"
            onClick={(e) => { e.preventDefault(); handleBack(); }}
            sx={{ cursor: 'pointer' }}
          >
            Кампании
          </Link>
          <Typography color="text.primary">{campaign.name}</Typography>
        </Breadcrumbs>

        {/* Title and Actions */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <IconButton onClick={handleBack}>
              <BackIcon />
            </IconButton>
            <Typography variant="h4" component="h1">
              {campaign.name}
            </Typography>
            <CampaignStatusBadge status={campaign.status} />
          </Box>

          <Stack direction="row" spacing={1}>
            {/* Action buttons based on status */}
            {canStart && (
              <Button
                variant="contained"
                color="success"
                startIcon={<StartIcon />}
                onClick={handleStart}
                disabled={startMutation.isPending}
              >
                Запустить
              </Button>
            )}
            {canPause && (
              <Button
                variant="outlined"
                color="warning"
                startIcon={<PauseIcon />}
                onClick={handlePause}
                disabled={pauseMutation.isPending}
              >
                Пауза
              </Button>
            )}
            {canResume && (
              <Button
                variant="contained"
                color="primary"
                startIcon={<StartIcon />}
                onClick={handleResume}
                disabled={resumeMutation.isPending}
              >
                Продолжить
              </Button>
            )}
            {canCancel && (
              <Button
                variant="outlined"
                color="error"
                startIcon={<StopIcon />}
                onClick={() => setCancelDialogOpen(true)}
              >
                Отменить
              </Button>
            )}
            {canEdit && (
              <Tooltip title="Редактировать">
                <IconButton onClick={() => navigate(`/campaigns/${campaignId}/edit`)}>
                  <EditIcon />
                </IconButton>
              </Tooltip>
            )}
            <Tooltip title="Дублировать">
              <IconButton onClick={handleDuplicate} disabled={duplicateMutation.isPending}>
                <DuplicateIcon />
              </IconButton>
            </Tooltip>
            {isFinished && (
              <>
                <Tooltip title="Экспорт результатов">
                  <IconButton onClick={handleExport} disabled={exportMutation.isPending}>
                    <ExportIcon />
                  </IconButton>
                </Tooltip>
                {canArchive && (
                  <Tooltip title="Архивировать">
                    <IconButton onClick={() => setArchiveDialogOpen(true)}>
                      <ArchiveIcon />
                    </IconButton>
                  </Tooltip>
                )}
              </>
            )}
            <Tooltip title="Обновить">
              <IconButton onClick={handleRefresh}>
                <RefreshIcon />
              </IconButton>
            </Tooltip>
          </Stack>
        </Box>
      </Box>

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={tabValue} onChange={handleTabChange}>
          <Tab label="Информация" />
          <Tab label={`Сообщения (${campaign._count?.messages || 0})`} />
          <Tab label={`Логи (${campaign._count?.logs || 0})`} />
          <Tab label="Статистика" disabled={!isFinished} />
        </Tabs>
      </Box>

      {/* Tab Panels */}
      <TabPanel value={tabValue} index={0}>
        <Stack spacing={2}>
          <CampaignProgressBlock
            campaign={campaign}
            progress={progress}
            isLoading={campaignLoading}
          />
          <CampaignDetails
            campaign={progress ? { ...campaign, ...progress } : campaign}
            isLoading={campaignLoading}
          />
        </Stack>
      </TabPanel>

      <TabPanel value={tabValue} index={1}>
        <CampaignMessages
          campaignId={campaignId!}
          messages={messagesData?.data || []}
          totalCount={messagesData?.pagination.total || 0}
          isLoading={messagesLoading}
          query={messagesQuery}
          onQueryChange={setMessagesQuery}
          onRefresh={refetchMessages}
        />
      </TabPanel>

      <TabPanel value={tabValue} index={2}>
        <CampaignLogs
          campaignId={campaignId!}
          logs={logsData?.data || []}
          totalCount={logsData?.pagination.total || 0}
          totalPages={logsData?.pagination.totalPages || 1}
          isLoading={logsLoading}
          query={logsQuery}
          onQueryChange={setLogsQuery}
          onRefresh={refetchLogs}
        />
      </TabPanel>

      <TabPanel value={tabValue} index={3}>
        <CampaignStatsView
          stats={stats}
          isLoading={statsLoading}
        />
      </TabPanel>

      {/* Cancel Dialog */}
      <Dialog open={cancelDialogOpen} onClose={() => setCancelDialogOpen(false)}>
        <DialogTitle>Отменить кампанию?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Вы уверены, что хотите отменить кампанию "{campaign.name}"?
            Это действие нельзя отменить. Все необработанные сообщения будут пропущены.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCancelDialogOpen(false)}>
            Отмена
          </Button>
          <Button
            onClick={handleCancel}
            color="error"
            variant="contained"
            disabled={cancelMutation.isPending}
          >
            {cancelMutation.isPending ? <CircularProgress size={20} /> : 'Отменить кампанию'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Archive Dialog */}
      <Dialog open={archiveDialogOpen} onClose={() => setArchiveDialogOpen(false)}>
        <DialogTitle>Архивировать кампанию?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Вы уверены, что хотите архивировать кампанию "{campaign.name}"?
            Архивированные кампании скрыты из основного списка.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setArchiveDialogOpen(false)}>
            Отмена
          </Button>
          <Button
            onClick={handleArchive}
            color="primary"
            variant="contained"
            disabled={archiveMutation.isPending}
          >
            {archiveMutation.isPending ? <CircularProgress size={20} /> : 'Архивировать'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

