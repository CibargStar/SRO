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
  Stack,
  IconButton,
  Tooltip,
  Breadcrumbs,
  Link,
  Divider,
  Paper,
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
import { StyledButton, CancelButton, LOADING_ICON_SIZE } from '@/components/common';
import { CancelCampaignDialog, ArchiveCampaignDialog, ExportCampaignDialog } from '@/components/campaigns';
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
  const [exportDialogOpen, setExportDialogOpen] = useState(false);

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
    setExportDialogOpen(true);
  }, []);

  const handleRefresh = useCallback(() => {
    refetchCampaign();
    if (tabValue === 1) refetchMessages();
    if (tabValue === 2) refetchLogs();
    if (['RUNNING', 'QUEUED'].includes(campaign?.status || '')) refetchProgress();
  }, [refetchCampaign, refetchMessages, refetchLogs, refetchProgress, tabValue, campaign]);

  // Loading state
  if (campaignLoading) {
    return (
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '50vh',
        maxWidth: 1600,
        mx: 'auto',
      }}>
        <CircularProgress sx={{ color: '#6366f1' }} />
      </Box>
    );
  }

  // Error state
  if (campaignError) {
    return (
      <Box sx={{ maxWidth: 1200, mx: 'auto', p: 3 }}>
        <Alert 
          severity="error"
          sx={{
            borderRadius: '12px',
            backgroundColor: 'rgba(244, 67, 54, 0.1)',
            color: '#f44336',
            border: '1px solid rgba(244, 67, 54, 0.2)',
            mb: 2,
          }}
        >
          Ошибка загрузки кампании: {(campaignError as Error).message}
        </Alert>
        <StyledButton onClick={handleBack}>
          Вернуться к списку
        </StyledButton>
      </Box>
    );
  }

  // Not found state
  if (!campaign) {
    return (
      <Box sx={{ maxWidth: 1200, mx: 'auto', p: 3 }}>
        <Alert 
          severity="warning"
          sx={{
            borderRadius: '12px',
            backgroundColor: 'rgba(255, 152, 0, 0.1)',
            color: '#ff9800',
            border: '1px solid rgba(255, 152, 0, 0.2)',
            mb: 2,
          }}
        >
          Кампания не найдена
        </Alert>
        <StyledButton onClick={handleBack}>
          Вернуться к списку
        </StyledButton>
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
        {/* Header */}
        <Box sx={{ mb: 3 }}>
          {/* Breadcrumbs */}
          <Breadcrumbs sx={{ mb: 2 }}>
            <Link
              href="/campaigns"
              onClick={(e) => { e.preventDefault(); handleBack(); }}
              sx={{ 
                cursor: 'pointer', 
                color: 'rgba(255, 255, 255, 0.7)',
                '&:hover': { color: '#6366f1' }
              }}
            >
              Кампании
            </Link>
            <Typography sx={{ color: 'rgba(255, 255, 255, 0.5)' }}>{campaign.name}</Typography>
          </Breadcrumbs>

          {/* Title and Actions */}
          <Paper sx={{ p: 3, backgroundColor: 'rgba(255, 255, 255, 0.06)', borderRadius: '16px', border: 'none', mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <IconButton 
                  onClick={handleBack}
                  sx={{
                    color: 'rgba(255, 255, 255, 0.7)',
                    '&:hover': {
                      backgroundColor: 'rgba(255, 255, 255, 0.08)',
                      color: '#f5f5f5',
                    },
                  }}
                >
                  <BackIcon />
                </IconButton>
                <Typography variant="h4" component="h1" sx={{ color: '#f5f5f5', fontWeight: 500 }}>
                  {campaign.name}
                </Typography>
                <CampaignStatusBadge status={campaign.status} />
              </Box>

              <Stack direction="row" spacing={1} flexWrap="wrap">
                {/* Action buttons based on status */}
                {canStart && (
                  <StyledButton
                    startIcon={<StartIcon />}
                    onClick={handleStart}
                    disabled={startMutation.isPending}
                    sx={{
                      backgroundColor: '#4caf50',
                      '&:hover': { backgroundColor: '#45a049' },
                    }}
                  >
                    {startMutation.isPending ? <CircularProgress size={LOADING_ICON_SIZE} color="inherit" /> : 'Запустить'}
                  </StyledButton>
                )}
                {canPause && (
                  <StyledButton
                    variant="outlined"
                    startIcon={<PauseIcon />}
                    onClick={handlePause}
                    disabled={pauseMutation.isPending}
                    sx={{
                      borderColor: '#f59e0b',
                      color: '#f59e0b',
                      '&:hover': {
                        borderColor: '#f59e0b',
                        backgroundColor: 'rgba(245, 158, 11, 0.1)',
                      },
                    }}
                  >
                    {pauseMutation.isPending ? <CircularProgress size={LOADING_ICON_SIZE} color="inherit" /> : 'Пауза'}
                  </StyledButton>
                )}
                {canResume && (
                  <StyledButton
                    startIcon={<StartIcon />}
                    onClick={handleResume}
                    disabled={resumeMutation.isPending}
                  >
                    {resumeMutation.isPending ? <CircularProgress size={LOADING_ICON_SIZE} color="inherit" /> : 'Продолжить'}
                  </StyledButton>
                )}
                {canCancel && (
                  <StyledButton
                    variant="outlined"
                    startIcon={<StopIcon />}
                    onClick={() => setCancelDialogOpen(true)}
                    sx={{
                      borderColor: '#f44336',
                      color: '#f44336',
                      '&:hover': {
                        borderColor: '#f44336',
                        backgroundColor: 'rgba(244, 67, 54, 0.1)',
                      },
                    }}
                  >
                    Отменить
                  </StyledButton>
                )}
                {canEdit && (
                  <Tooltip title="Редактировать">
                    <IconButton 
                      onClick={() => navigate(`/campaigns/${campaignId}/edit`)}
                      sx={{
                        color: 'rgba(255, 255, 255, 0.7)',
                        '&:hover': {
                          backgroundColor: 'rgba(255, 255, 255, 0.08)',
                          color: '#f5f5f5',
                        },
                      }}
                    >
                      <EditIcon />
                    </IconButton>
                  </Tooltip>
                )}
                <Tooltip title="Дублировать">
                  <IconButton 
                    onClick={handleDuplicate} 
                    disabled={duplicateMutation.isPending}
                    sx={{
                      color: 'rgba(255, 255, 255, 0.7)',
                      '&:hover': {
                        backgroundColor: 'rgba(255, 255, 255, 0.08)',
                        color: '#f5f5f5',
                      },
                    }}
                  >
                    <DuplicateIcon />
                  </IconButton>
                </Tooltip>
                {isFinished && (
                  <>
                    <Tooltip title="Экспорт результатов">
                      <IconButton 
                        onClick={() => setExportDialogOpen(true)} 
                        disabled={exportMutation.isPending}
                        sx={{
                          color: 'rgba(255, 255, 255, 0.7)',
                          '&:hover': {
                            backgroundColor: 'rgba(255, 255, 255, 0.08)',
                            color: '#f5f5f5',
                          },
                        }}
                      >
                        <ExportIcon />
                      </IconButton>
                    </Tooltip>
                    {canArchive && (
                      <Tooltip title="Архивировать">
                        <IconButton 
                          onClick={() => setArchiveDialogOpen(true)}
                          sx={{
                            color: 'rgba(255, 255, 255, 0.7)',
                            '&:hover': {
                              backgroundColor: 'rgba(255, 255, 255, 0.08)',
                              color: '#f5f5f5',
                            },
                          }}
                        >
                          <ArchiveIcon />
                        </IconButton>
                      </Tooltip>
                    )}
                  </>
                )}
                <Tooltip title="Обновить">
                  <IconButton 
                    onClick={handleRefresh}
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
              </Stack>
            </Box>
          </Paper>

          {/* Tabs */}
          <Paper sx={{ backgroundColor: 'rgba(255, 255, 255, 0.06)', borderRadius: '16px', border: 'none', overflow: 'hidden' }}>
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
              <Tab label="Информация" />
              <Tab label={`Сообщения (${campaign._count?.messages || 0})`} />
              <Tab label={`Логи (${campaign._count?.logs || 0})`} />
              <Tab label="Статистика" disabled={!isFinished} />
            </Tabs>
          </Paper>
        </Box>

        {/* Tab Panels */}
        <TabPanel value={tabValue} index={0}>
          <Stack spacing={3}>
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

        {/* Dialogs */}
        <CancelCampaignDialog
          open={cancelDialogOpen}
          onClose={() => setCancelDialogOpen(false)}
          campaign={campaign}
          onSuccess={() => {
            setCancelDialogOpen(false);
            refetchCampaign();
          }}
        />

        <ArchiveCampaignDialog
          open={archiveDialogOpen}
          onClose={() => setArchiveDialogOpen(false)}
          campaign={campaign}
          onSuccess={() => {
            setArchiveDialogOpen(false);
            navigate('/campaigns');
          }}
        />

        <ExportCampaignDialog
          open={exportDialogOpen}
          onClose={() => setExportDialogOpen(false)}
          campaign={campaign || null}
        />
      </Box>
    </Box>
  );
}

