/**
 * Страница управления профилями Chrome
 * 
 * Полнофункциональная страница с:
 * - Список профилей с real-time статусами
 * - Запуск/остановка профилей
 * - Мониторинг ресурсов (CPU, память)
 * - Сетевая статистика
 * - Алерты и уведомления
 * - Управление мессенджерами
 */

import { useState, useMemo, useCallback } from 'react';
import {
  Box,
  Typography,
  Button,
  Alert,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Pagination,
  Dialog,
  DialogContent,
  DialogActions,
  Card,
  CardContent,
  Chip,
  IconButton,
  Tooltip,
  LinearProgress,
  Badge,
  Collapse,
  Divider,
  Grid,
  Switch,
} from '@mui/material';
import { StyledSelect, MenuProps, selectInputLabelStyles } from '@/components/common/SelectStyles';
import { StyledButton, StyledTextField, CancelButton } from '@/components/common/FormStyles';
import { dialogPaperProps, dialogTitleStyles, dialogContentStyles, dialogActionsStyles } from '@/components/common/DialogStyles';
import { LOADING_ICON_SIZE } from '@/components/common/Constants';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import StopIcon from '@mui/icons-material/Stop';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import InfoIcon from '@mui/icons-material/Info';
import ChatIcon from '@mui/icons-material/Chat';
import RefreshIcon from '@mui/icons-material/Refresh';
import WarningIcon from '@mui/icons-material/Warning';
import NotificationsIcon from '@mui/icons-material/Notifications';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import MemoryIcon from '@mui/icons-material/Memory';
import NetworkCheckIcon from '@mui/icons-material/NetworkCheck';
import HealthAndSafetyIcon from '@mui/icons-material/HealthAndSafety';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { useQueryClient } from '@tanstack/react-query';
import {
  useProfiles,
  useDeleteProfile,
  useStartProfile,
  useStopProfile,
  useProfileStatus,
  useProfileResources,
  useProfileHealth,
  useProfileNetworkStats,
  useProfileAlerts,
  useProfileUnreadAlertsCount,
  useMarkAlertAsRead,
  useMarkAllAlertsAsRead,
  profilesKeys,
} from '@/hooks/useProfiles';
import { useProfilesWebSocket } from '@/hooks/useProfilesWebSocket';
import { CreateProfileDialog } from '@/components/CreateProfileDialog';
import { EditProfileDialog } from '@/components/EditProfileDialog';
import { ProfileDetailsDialog } from '@/components/ProfileDetailsDialog';
import { MessengerAccountsDialog } from '@/components/MessengerAccountsDialog';
import { ProfileStatusChip } from '@/components/ProfileStatusChip';
import { getMessengerAccountsCounts } from '@/utils/api';
import { useQuery } from '@tanstack/react-query';
import type { Profile, ProfileStatus } from '@/types';

// Компонент для отображения ресурсов профиля
function ProfileResourcesDisplay({ profileId, isRunning }: { profileId: string; isRunning: boolean }) {
  const { data: resources } = useProfileResources(profileId, {
    refetchInterval: isRunning ? 5000 : false,
    enabled: isRunning,
  });

  if (!isRunning || !resources) {
    return (
      <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)' }}>
        Профиль остановлен
      </Typography>
    );
  }

  return (
    <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
      <Tooltip title="CPU">
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <MemoryIcon sx={{ fontSize: 16, color: resources.cpuUsage > 80 ? '#f44336' : '#4caf50' }} />
          <Typography variant="caption" sx={{ color: '#ffffff' }}>
            {resources.cpuUsage.toFixed(1)}%
          </Typography>
        </Box>
      </Tooltip>
      <Tooltip title="Память">
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Box sx={{ width: 50 }}>
            <LinearProgress
              variant="determinate"
              value={Math.min(resources.memoryUsagePercent, 100)}
              sx={{
                height: 6,
                borderRadius: 3,
                backgroundColor: 'rgba(255,255,255,0.1)',
                '& .MuiLinearProgress-bar': {
                  backgroundColor: resources.memoryUsagePercent > 80 ? '#f44336' : '#4caf50',
                },
              }}
            />
          </Box>
          <Typography variant="caption" sx={{ color: '#ffffff' }}>
            {resources.memoryUsage.toFixed(0)} MB
          </Typography>
        </Box>
      </Tooltip>
    </Box>
  );
}

// Компонент для отображения сетевой статистики
function ProfileNetworkDisplay({ profileId, isRunning }: { profileId: string; isRunning: boolean }) {
  const { data: network } = useProfileNetworkStats(profileId, {
    refetchInterval: isRunning ? 5000 : false,
    enabled: isRunning,
  });

  if (!isRunning || !network) return null;

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  };

  return (
    <Tooltip title={`↓ ${formatBytes(network.bytesReceived)} / ↑ ${formatBytes(network.bytesSent)}`}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <NetworkCheckIcon sx={{ fontSize: 16, color: '#2196f3' }} />
        <Typography variant="caption" sx={{ color: '#ffffff' }}>
          {formatBytes(network.receiveRate)}/s
        </Typography>
      </Box>
    </Tooltip>
  );
}

// Компонент для отображения здоровья профиля
function ProfileHealthDisplay({ profileId, isRunning }: { profileId: string; isRunning: boolean }) {
  const { data: health } = useProfileHealth(profileId, {
    enabled: isRunning,
  });

  if (!isRunning || !health) return null;

  const healthColors = {
    healthy: '#4caf50',
    degraded: '#ff9800',
    unhealthy: '#f44336',
    unknown: '#9e9e9e',
  };

  return (
    <Tooltip title={`Здоровье: ${health.status}`}>
      <HealthAndSafetyIcon sx={{ fontSize: 18, color: healthColors[health.status] }} />
    </Tooltip>
  );
}

// Компонент для отображения алертов профиля
function ProfileAlertsDisplay({
  profileId,
  onOpenAlerts,
}: {
  profileId: string;
  onOpenAlerts: () => void;
}) {
  const { data: unreadCount } = useProfileUnreadAlertsCount(profileId, {
    refetchInterval: 30000,
  });

  const count = unreadCount?.unreadCount || 0;

  return (
    <Tooltip title={count > 0 ? `${count} непрочитанных алертов` : 'Нет алертов'}>
      <IconButton size="small" onClick={onOpenAlerts} sx={{ color: count > 0 ? '#ff9800' : 'rgba(255,255,255,0.5)' }}>
        <Badge badgeContent={count} color="error" max={99}>
          <NotificationsIcon sx={{ fontSize: 20 }} />
        </Badge>
      </IconButton>
    </Tooltip>
  );
}

// Диалог с алертами профиля
function ProfileAlertsDialog({
  open,
  onClose,
  profileId,
  onOpenMessengers,
}: {
  open: boolean;
  onClose: () => void;
  profileId: string | null;
  onOpenMessengers?: () => void;
}) {
  const { data: alertsData, isLoading, refetch } = useProfileAlerts(profileId || '', 50, false, undefined, undefined, {
    enabled: !!profileId && open,
    refetchInterval: open ? 10000 : false, // Обновление каждые 10 сек когда открыт
  });
  const markAlertAsReadMutation = useMarkAlertAsRead();
  const markAllAsReadMutation = useMarkAllAlertsAsRead();

  if (!profileId) return null;

  const handleMarkAsRead = (alertId: string) => {
    markAlertAsReadMutation.mutate(
      { profileId, alertId },
      { onSuccess: () => refetch() }
    );
  };

  const handleMarkAllAsRead = () => {
    markAllAsReadMutation.mutate(profileId, { onSuccess: () => refetch() });
  };

  const severityColors: Record<string, string> = {
    info: '#2196f3',
    warning: '#ff9800',
    error: '#f44336',
    critical: '#d32f2f',
  };

  const typeIcons: Record<string, string> = {
    MESSENGER_LOGIN_REQUIRED: '🔐',
    PROFILE_ERROR: '❌',
    PROFILE_CRASHED: '💥',
    RESOURCE_LIMIT_EXCEEDED: '⚠️',
    PROFILE_HEALTH_DEGRADED: '🏥',
  };

  // Количество непрочитанных
  const unreadCount = alertsData?.alerts.filter((a) => !a.read).length || 0;

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      PaperProps={{
        ...dialogPaperProps,
        sx: {
          ...dialogPaperProps.sx,
          borderRadius: '16px',
        },
      }} 
      maxWidth="md" 
      fullWidth
    >
      <Box sx={{ ...dialogTitleStyles, borderBottom: '1px solid rgba(255, 255, 255, 0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Typography variant="h6" sx={{ color: '#f5f5f5', fontWeight: 500 }}>
            Алерты профиля
          </Typography>
          {unreadCount > 0 && (
            <Chip
              label={`${unreadCount} новых`}
              size="small"
              sx={{ 
                backgroundColor: 'rgba(244, 67, 54, 0.2)', 
                color: '#f44336',
                fontSize: '0.75rem', 
                height: '22px',
                fontWeight: 500,
              }}
            />
          )}
        </Box>
        {alertsData && alertsData.alerts.length > 0 && unreadCount > 0 && (
          <StyledButton
            size="small"
            onClick={handleMarkAllAsRead}
            disabled={markAllAsReadMutation.isPending}
            sx={{ minWidth: 140 }}
          >
            {markAllAsReadMutation.isPending ? (
              <CircularProgress size={LOADING_ICON_SIZE} color="inherit" />
            ) : (
              'Прочитать все'
            )}
          </StyledButton>
        )}
      </Box>
      <DialogContent sx={{ ...dialogContentStyles, pt: 3 }}>
        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : alertsData && alertsData.alerts.length > 0 ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {alertsData.alerts.map((alert) => (
              <Card
                key={alert.id}
                sx={{
                  backgroundColor: alert.read ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.08)',
                  borderLeft: `4px solid ${severityColors[alert.severity] || '#888'}`,
                  borderRadius: '12px',
                  border: 'none',
                  transition: 'all 0.2s',
                  '&:hover': {
                    backgroundColor: alert.read ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.12)',
                  },
                }}
              >
                <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <Box sx={{ flex: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <span style={{ fontSize: '1rem' }}>{typeIcons[alert.type] || '📋'}</span>
                        <Typography variant="subtitle2" sx={{ color: '#ffffff', fontWeight: alert.read ? 400 : 600 }}>
                          {alert.title}
                        </Typography>
                        {!alert.read && (
                          <Chip 
                            label="Новый" 
                            size="small" 
                            sx={{ 
                              backgroundColor: 'rgba(99, 102, 241, 0.2)', 
                              color: '#818cf8',
                              fontSize: '0.7rem', 
                              height: '20px',
                              fontWeight: 500,
                            }} 
                          />
                        )}
                      </Box>
                      <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)', mt: 0.5 }}>
                        {alert.message}
                      </Typography>
                      
                      {/* Специальная обработка для MESSENGER_LOGIN_REQUIRED */}
                      {alert.type === 'MESSENGER_LOGIN_REQUIRED' && onOpenMessengers && (
                        <StyledButton
                          size="small"
                          onClick={() => {
                            handleMarkAsRead(alert.id);
                            onOpenMessengers();
                            onClose();
                          }}
                          sx={{
                            mt: 1.5,
                            backgroundColor: 'rgba(76, 175, 80, 0.15)',
                            color: '#4caf50',
                            border: '1px solid rgba(76, 175, 80, 0.3)',
                            fontSize: '0.8rem',
                            '&:hover': {
                              backgroundColor: 'rgba(76, 175, 80, 0.25)',
                              borderColor: '#4caf50',
                            },
                          }}
                        >
                          Войти в мессенджер
                        </StyledButton>
                      )}
                    </Box>
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0.5 }}>
                      <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', whiteSpace: 'nowrap' }}>
                        {new Date(alert.timestamp).toLocaleString()}
                      </Typography>
                      {!alert.read && (
                        <IconButton
                          size="small"
                          onClick={() => handleMarkAsRead(alert.id)}
                          disabled={markAlertAsReadMutation.isPending}
                          sx={{ color: 'rgba(255,255,255,0.5)', '&:hover': { color: '#4caf50' } }}
                        >
                          <CheckCircleIcon sx={{ fontSize: 16 }} />
                        </IconButton>
                      )}
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            ))}
          </Box>
        ) : (
          <Box sx={{ textAlign: 'center', py: 6 }}>
            <Typography sx={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.95rem' }}>
              Нет алертов
            </Typography>
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={dialogActionsStyles}>
        <CancelButton onClick={onClose}>Закрыть</CancelButton>
      </DialogActions>
    </Dialog>
  );
}

// Карточка профиля
function ProfileCard({
  profile,
  messengerAccountsCount,
  isStarting,
  isStopping,
  onStart,
  onStop,
  onEdit,
  onDelete,
  onDetails,
  onMessengers,
  onAlerts,
}: {
  profile: Profile;
  messengerAccountsCount: number;
  isStarting: boolean;
  isStopping: boolean;
  onStart: () => void;
  onStop: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onDetails: () => void;
  onMessengers: () => void;
  onAlerts: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const isRunning = profile.status === 'RUNNING';
  const isTransitioning = profile.status === 'STARTING' || profile.status === 'STOPPING';

  return (
    <Card
      sx={{
        backgroundColor: 'rgba(255, 255, 255, 0.06)',
        borderRadius: '16px',
        border: 'none',
        transition: 'all 0.2s',
        '&:hover': {
          backgroundColor: 'rgba(255, 255, 255, 0.1)',
          transform: 'translateY(-2px)',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
        },
      }}
    >
      <CardContent sx={{ py: 2, '&:last-child': { pb: 2 } }}>
        {/* Основная информация */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Box sx={{ flex: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
              <Typography variant="h6" sx={{ color: '#ffffff', fontWeight: 500 }}>
                {profile.name}
              </Typography>
              <ProfileStatusChip status={profile.status} size="small" />
              {profile.isInCampaign && (
                <Chip
                  label={`В кампаниях: ${profile.campaignUsageCount ?? ''}`}
                  size="small"
                  color="warning"
                  sx={{ height: 24 }}
                />
              )}
              {profile.headless ? (
                <Tooltip title="Headless режим">
                  <VisibilityOffIcon sx={{ fontSize: 18, color: 'rgba(255,255,255,0.5)' }} />
                </Tooltip>
              ) : (
                <Tooltip title="С интерфейсом">
                  <VisibilityIcon sx={{ fontSize: 18, color: '#4caf50' }} />
                </Tooltip>
              )}
              <ProfileHealthDisplay profileId={profile.id} isRunning={isRunning} />
            </Box>

            {profile.description && (
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.6)', mb: 1 }}>
                {profile.description}
              </Typography>
            )}

            {/* Ресурсы и сеть */}
            <Box sx={{ display: 'flex', gap: 3, alignItems: 'center', flexWrap: 'wrap' }}>
              <ProfileResourcesDisplay profileId={profile.id} isRunning={isRunning} />
              <ProfileNetworkDisplay profileId={profile.id} isRunning={isRunning} />
              
              {messengerAccountsCount > 0 && (
                <Chip
                  icon={<ChatIcon sx={{ fontSize: 16 }} />}
                  label={`${messengerAccountsCount} мессенджер(ов)`}
                  size="small"
                  onClick={onMessengers}
                  sx={{
                    backgroundColor: 'rgba(76, 175, 80, 0.2)',
                    color: '#4caf50',
                    cursor: 'pointer',
                    '&:hover': { backgroundColor: 'rgba(76, 175, 80, 0.3)' },
                  }}
                />
              )}
            </Box>
          </Box>

          {/* Действия */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <ProfileAlertsDisplay profileId={profile.id} onOpenAlerts={onAlerts} />

            {isRunning ? (
              <Tooltip title="Остановить">
                <IconButton
                  onClick={onStop}
                  disabled={isStopping || isTransitioning}
                  sx={{ color: '#f44336' }}
                >
                  {isStopping ? <CircularProgress size={20} /> : <StopIcon />}
                </IconButton>
              </Tooltip>
            ) : (
              <Tooltip title="Запустить">
                <IconButton
                  onClick={onStart}
                  disabled={isStarting || isTransitioning}
                  sx={{ color: '#4caf50' }}
                >
                  {isStarting ? <CircularProgress size={20} /> : <PlayArrowIcon />}
                </IconButton>
              </Tooltip>
            )}

            <Tooltip title="Мессенджеры">
              <IconButton onClick={onMessengers} sx={{ color: 'rgba(255,255,255,0.7)' }}>
                <ChatIcon />
              </IconButton>
            </Tooltip>

            <Tooltip title="Редактировать">
              <IconButton onClick={onEdit} sx={{ color: 'rgba(255,255,255,0.7)' }}>
                <EditIcon />
              </IconButton>
            </Tooltip>

            <Tooltip title="Подробнее">
              <IconButton onClick={onDetails} sx={{ color: 'rgba(255,255,255,0.7)' }}>
                <InfoIcon />
              </IconButton>
            </Tooltip>

            <Tooltip title="Удалить">
              <IconButton onClick={onDelete} sx={{ color: '#f44336' }} disabled={isRunning}>
                <DeleteIcon />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {/* Дополнительная информация */}
        <Box sx={{ mt: 1, display: 'flex', gap: 2 }}>
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)' }}>
            Создан: {new Date(profile.createdAt).toLocaleDateString()}
          </Typography>
          {profile.lastActiveAt && (
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)' }}>
              Последняя активность: {new Date(profile.lastActiveAt).toLocaleString()}
            </Typography>
          )}
        </Box>
      </CardContent>
    </Card>
  );
}

// Основной компонент страницы
export function ProfilesPage() {
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<ProfileStatus | undefined>(undefined);
  const [sortBy, setSortBy] = useState<'createdAt' | 'updatedAt' | 'name' | 'status' | 'lastActiveAt'>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [onlyInCampaigns, setOnlyInCampaigns] = useState<boolean | undefined>(undefined);

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [messengersDialogOpen, setMessengersDialogOpen] = useState(false);
  const [alertsDialogOpen, setAlertsDialogOpen] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);

  const [isStarting, setIsStarting] = useState<string | null>(null);
  const [isStopping, setIsStopping] = useState<string | null>(null);

  const { data: profilesData, isLoading, error, refetch } = useProfiles({
    page,
    limit,
    status,
    sortBy,
    sortOrder,
    isInCampaign: onlyInCampaigns,
  });

  const queryClient = useQueryClient();
  // WebSocket события профилей: статус, ресурсы, здоровье, алерты
  useProfilesWebSocket({
    onStatus: (payload) => {
      queryClient.setQueryData(profilesKeys.detail(payload.profileId), (prev: any) =>
        prev ? { ...prev, status: payload.status, lastActiveAt: payload.lastActiveAt } : prev
      );
      queryClient.invalidateQueries({ queryKey: profilesKeys.lists() });
    },
    onResources: (payload) => {
      queryClient.setQueryData(profilesKeys.resources(payload.profileId), payload);
    },
    onHealth: (payload) => {
      queryClient.setQueryData(profilesKeys.health(payload.profileId), payload);
    },
    onAlert: (payload) => {
      queryClient.invalidateQueries({ queryKey: profilesKeys.alerts(payload.profileId) });
      queryClient.invalidateQueries({ queryKey: profilesKeys.unreadAlertsCount(payload.profileId) });
    },
  });

  const deleteMutation = useDeleteProfile();
  const startMutation = useStartProfile();
  const stopMutation = useStopProfile();

  // Фильтрация по поисковому запросу
  const filteredProfiles = useMemo(() => {
    if (!profilesData?.data) return [];
    if (!search) return profilesData.data;
    const searchLower = search.toLowerCase();
    return profilesData.data.filter(
      (profile) =>
        profile.name.toLowerCase().includes(searchLower) ||
        (profile.description && profile.description.toLowerCase().includes(searchLower))
    );
  }, [profilesData, search]);

  // Загрузка количества аккаунтов мессенджеров
  const profileIds = filteredProfiles.map((p) => p.id);
  const { data: messengerAccountsCounts = {} } = useQuery({
    queryKey: ['messenger-accounts-counts', profileIds],
    queryFn: () => getMessengerAccountsCounts(profileIds),
    enabled: profileIds.length > 0,
    staleTime: 30 * 1000,
  });

  const handleStart = useCallback((profile: Profile) => {
    setIsStarting(profile.id);
    startMutation.mutate(
      { profileId: profile.id },
      {
        onSettled: () => setIsStarting(null),
      }
    );
  }, [startMutation]);

  const handleStop = useCallback((profile: Profile) => {
    setIsStopping(profile.id);
    stopMutation.mutate(
      { profileId: profile.id, force: false },
      {
        onSettled: () => setIsStopping(null),
      }
    );
  }, [stopMutation]);

  const handleEdit = useCallback((profile: Profile) => {
    setSelectedProfile(profile);
    setEditDialogOpen(true);
  }, []);

  const handleDelete = useCallback((profile: Profile) => {
    setSelectedProfile(profile);
    setDeleteDialogOpen(true);
  }, []);

  const handleConfirmDelete = () => {
    if (selectedProfile) {
      deleteMutation.mutate(selectedProfile.id, {
        onSuccess: () => {
          setDeleteDialogOpen(false);
          setSelectedProfile(null);
        },
      });
    }
  };

  const handleDetails = useCallback((profile: Profile) => {
    setSelectedProfile(profile);
    setDetailsDialogOpen(true);
  }, []);

  const handleMessengers = useCallback((profile: Profile) => {
    setSelectedProfile(profile);
    setMessengersDialogOpen(true);
  }, []);

  const handleAlerts = useCallback((profile: Profile) => {
    setSelectedProfile(profile);
    setAlertsDialogOpen(true);
  }, []);

  // Статистика профилей
  const stats = useMemo(() => {
    if (!profilesData?.data) return { running: 0, stopped: 0, error: 0, total: 0 };
    return {
      running: profilesData.data.filter((p) => p.status === 'RUNNING').length,
      stopped: profilesData.data.filter((p) => p.status === 'STOPPED').length,
      error: profilesData.data.filter((p) => p.status === 'ERROR').length,
      total: profilesData.pagination.total,
    };
  }, [profilesData]);

  const errorMessage = error ? 'Не удалось загрузить профили' : null;

  return (
    <Box
      sx={{
        width: '100%',
        overflowY: 'auto',
        '&::-webkit-scrollbar': { display: 'none' },
        scrollbarWidth: 'none',
      }}
    >
      {/* Заголовок и статистика */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 4 }}>
        <Box>
          <Typography variant="h4" component="h1" sx={{ color: '#f5f5f5', fontWeight: 500, mb: 1 }}>
            Управление профилями Chrome
          </Typography>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Chip
              label={`Всего: ${stats.total}`}
              size="small"
              sx={{ 
                backgroundColor: 'rgba(255, 255, 255, 0.12)', 
                color: '#f5f5f5',
                height: '28px',
                fontSize: '0.8rem',
              }}
            />
            <Chip
              label={`Запущено: ${stats.running}`}
              size="small"
              sx={{ 
                backgroundColor: 'rgba(76, 175, 80, 0.2)', 
                color: '#4caf50',
                height: '28px',
                fontSize: '0.8rem',
              }}
            />
            <Chip
              label={`Остановлено: ${stats.stopped}`}
              size="small"
              sx={{ 
                backgroundColor: 'rgba(158, 158, 158, 0.2)', 
                color: '#9e9e9e',
                height: '28px',
                fontSize: '0.8rem',
              }}
            />
            {stats.error > 0 && (
              <Chip
                label={`Ошибок: ${stats.error}`}
                size="small"
                sx={{ 
                  backgroundColor: 'rgba(244, 67, 54, 0.2)', 
                  color: '#f44336',
                  height: '28px',
                  fontSize: '0.8rem',
                }}
              />
            )}
          </Box>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Tooltip title="Обновить">
            <IconButton onClick={() => refetch()} sx={{ color: 'rgba(255,255,255,0.7)' }}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          <StyledButton startIcon={<AddIcon />} onClick={() => setCreateDialogOpen(true)}>
            Создать профиль
          </StyledButton>
        </Box>
      </Box>

      {/* Поиск и фильтры */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mb: 3 }}>
        <StyledTextField
          fullWidth
          placeholder="Поиск по названию или описанию..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          InputProps={{
            startAdornment: <SearchIcon sx={{ color: 'rgba(255, 255, 255, 0.7)', mr: 1 }} />,
          }}
        />

        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <FormControl sx={{ minWidth: 200 }}>
            <InputLabel shrink sx={selectInputLabelStyles}>
              Статус
            </InputLabel>
            <StyledSelect
              value={status || ''}
              onChange={(e) => {
                setStatus((e.target.value as ProfileStatus) || undefined);
                setPage(1);
              }}
              label="Статус"
              MenuProps={MenuProps}
              displayEmpty
              renderValue={(selected) => {
                if (!selected) return 'Все';
                const statusText: Record<ProfileStatus, string> = {
                  STOPPED: 'Остановлен',
                  RUNNING: 'Запущен',
                  STARTING: 'Запускается',
                  STOPPING: 'Останавливается',
                  ERROR: 'Ошибка',
                };
                return statusText[selected as ProfileStatus] || selected;
              }}
            >
              <MenuItem value="">Все</MenuItem>
              <MenuItem value="STOPPED">Остановлен</MenuItem>
              <MenuItem value="RUNNING">Запущен</MenuItem>
              <MenuItem value="STARTING">Запускается</MenuItem>
              <MenuItem value="STOPPING">Останавливается</MenuItem>
              <MenuItem value="ERROR">Ошибка</MenuItem>
            </StyledSelect>
          </FormControl>

          <FormControl sx={{ minWidth: 200 }}>
            <InputLabel sx={selectInputLabelStyles}>Сортировка</InputLabel>
            <StyledSelect
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              label="Сортировка"
              MenuProps={MenuProps}
            >
              <MenuItem value="createdAt">По дате создания</MenuItem>
              <MenuItem value="updatedAt">По дате обновления</MenuItem>
              <MenuItem value="name">По названию</MenuItem>
              <MenuItem value="status">По статусу</MenuItem>
              <MenuItem value="lastActiveAt">По последней активности</MenuItem>
            </StyledSelect>
          </FormControl>

          <FormControl sx={{ minWidth: 120 }}>
            <InputLabel sx={selectInputLabelStyles}>Порядок</InputLabel>
            <StyledSelect
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as typeof sortOrder)}
              label="Порядок"
              MenuProps={MenuProps}
            >
              <MenuItem value="asc">По возрастанию</MenuItem>
              <MenuItem value="desc">По убыванию</MenuItem>
            </StyledSelect>
          </FormControl>

          <FormControl sx={{ minWidth: 180 }}>
            <InputLabel sx={selectInputLabelStyles}>Кампании</InputLabel>
            <StyledSelect
              value={onlyInCampaigns === undefined ? '' : onlyInCampaigns ? 'in' : 'out'}
              onChange={(e) => {
                const val = e.target.value as string;
                if (val === '') setOnlyInCampaigns(undefined);
                else setOnlyInCampaigns(val === 'in');
                setPage(1);
              }}
              label="Кампании"
              MenuProps={MenuProps}
            >
              <MenuItem value="">Все</MenuItem>
              <MenuItem value="in">Используются</MenuItem>
              <MenuItem value="out">Не используются</MenuItem>
            </StyledSelect>
          </FormControl>
        </Box>
      </Box>

      {errorMessage && (
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
          {errorMessage}
        </Alert>
      )}

      {isLoading ? (
        <Box display="flex" justifyContent="center" alignItems="center" minHeight={400}>
          <CircularProgress sx={{ color: '#f5f5f5' }} />
        </Box>
      ) : profilesData ? (
        <>
          {/* Список профилей */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {filteredProfiles.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 8 }}>
                <Typography variant="h6" sx={{ color: 'rgba(255,255,255,0.5)', mb: 2 }}>
                  Профили не найдены
                </Typography>
                <StyledButton startIcon={<AddIcon />} onClick={() => setCreateDialogOpen(true)}>
                  Создать первый профиль
                </StyledButton>
              </Box>
            ) : (
              filteredProfiles.map((profile) => (
                <ProfileCard
                  key={profile.id}
                  profile={profile}
                  messengerAccountsCount={messengerAccountsCounts[profile.id] || 0}
                  isStarting={isStarting === profile.id}
                  isStopping={isStopping === profile.id}
                  onStart={() => handleStart(profile)}
                  onStop={() => handleStop(profile)}
                  onEdit={() => handleEdit(profile)}
                  onDelete={() => handleDelete(profile)}
                  onDetails={() => handleDetails(profile)}
                  onMessengers={() => handleMessengers(profile)}
                  onAlerts={() => handleAlerts(profile)}
                />
              ))
            )}
          </Box>

          {/* Пагинация */}
          {profilesData.pagination.totalPages > 1 && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
                <Pagination
                count={profilesData.pagination.totalPages}
                page={page}
                onChange={(_, newPage) => setPage(newPage)}
                color="primary"
                sx={{
                  '& .MuiPaginationItem-root': {
                    color: 'rgba(255, 255, 255, 0.7)',
                    '&.Mui-selected': {
                      backgroundColor: '#6366f1',
                      color: '#ffffff',
                      '&:hover': {
                        backgroundColor: '#5856eb',
                      },
                    },
                    '&:hover': {
                      backgroundColor: 'rgba(255, 255, 255, 0.1)',
                    },
                  },
                }}
              />
            </Box>
          )}
        </>
      ) : null}

      {/* Диалоги */}
      <CreateProfileDialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} />

      <EditProfileDialog
        open={editDialogOpen}
        onClose={() => {
          setEditDialogOpen(false);
          setSelectedProfile(null);
        }}
        profile={selectedProfile}
        onProfileUpdated={(updatedProfile) => setSelectedProfile(updatedProfile)}
      />

      <Dialog
        open={deleteDialogOpen}
        onClose={() => {
          setDeleteDialogOpen(false);
          setSelectedProfile(null);
        }}
        PaperProps={{
          ...dialogPaperProps,
          sx: {
            ...dialogPaperProps.sx,
            borderRadius: '16px',
          },
        }}
      >
        <Box sx={{ ...dialogTitleStyles, borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
          <Typography variant="h6" sx={{ color: '#f5f5f5', fontWeight: 500 }}>
            Удаление профиля
          </Typography>
        </Box>
        <DialogContent sx={{ ...dialogContentStyles, pt: 3 }}>
          <Typography sx={{ color: 'rgba(255, 255, 255, 0.7)', mb: 2 }}>
            Вы уверены, что хотите удалить профиль &quot;{selectedProfile?.name}&quot;?
          </Typography>
          <Typography sx={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '0.875rem' }}>
            Это действие нельзя отменить. Профиль и все связанные данные будут удалены.
          </Typography>
          {deleteMutation.isError && (
            <Alert 
              severity="error" 
              sx={{ 
                mt: 2,
                borderRadius: '12px',
                backgroundColor: 'rgba(244, 67, 54, 0.1)',
                color: '#f44336',
                border: '1px solid rgba(244, 67, 54, 0.2)',
              }}
            >
              {deleteMutation.error instanceof Error
                ? deleteMutation.error.message
                : 'Произошла ошибка при удалении профиля'}
            </Alert>
          )}
        </DialogContent>
        <DialogActions sx={dialogActionsStyles}>
          <CancelButton
            onClick={() => {
              setDeleteDialogOpen(false);
              setSelectedProfile(null);
            }}
            disabled={deleteMutation.isPending}
          >
            Отмена
          </CancelButton>
          <StyledButton
            onClick={handleConfirmDelete}
            disabled={deleteMutation.isPending}
            sx={{
              backgroundColor: '#f44336',
              color: '#fff',
              '&:hover': {
                backgroundColor: '#d32f2f',
              },
            }}
          >
            {deleteMutation.isPending ? <CircularProgress size={LOADING_ICON_SIZE} color="inherit" /> : 'Удалить'}
          </StyledButton>
        </DialogActions>
      </Dialog>

      <ProfileDetailsDialog
        open={detailsDialogOpen}
        onClose={() => {
          setDetailsDialogOpen(false);
          setSelectedProfile(null);
        }}
        profileId={selectedProfile?.id || null}
      />

      <MessengerAccountsDialog
        open={messengersDialogOpen}
        onClose={() => {
          setMessengersDialogOpen(false);
          setSelectedProfile(null);
        }}
        profileId={selectedProfile?.id || null}
        isProfileRunning={selectedProfile?.status === 'RUNNING'}
      />

      <ProfileAlertsDialog
        open={alertsDialogOpen}
        onClose={() => {
          setAlertsDialogOpen(false);
          setSelectedProfile(null);
        }}
        profileId={selectedProfile?.id || null}
        onOpenMessengers={() => {
          setAlertsDialogOpen(false);
          setMessengersDialogOpen(true);
        }}
      />
    </Box>
  );
}
