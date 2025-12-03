/**
 * Диалог детального просмотра профиля
 * 
 * Отображает полную информацию о профиле:
 * - Основная информация
 * - Статус и статистика ресурсов
 * - Сетевая статистика
 * - Алерты
 * - Аналитика
 */

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  Tabs,
  Tab,
  Button,
  CircularProgress,
  Alert,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import { dialogPaperProps, dialogTitleStyles, dialogActionsStyles } from './common/DialogStyles';
import { StyledButton } from './common/FormStyles';
import { ProfileStatusChip } from './ProfileStatusChip';
import { useProfile, useProfileResources, useProfileHealth, useProfileNetworkStats, useProfileAlerts, useProfileUnreadAlertsCount, useProfileAnalytics, useMarkAlertAsRead, useMarkAllAlertsAsRead, useProfileResourcesHistory } from '@/hooks/useProfiles';
import type { Profile } from '@/types';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`profile-tabpanel-${index}`}
      aria-labelledby={`profile-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  );
}

const StyledTabs = styled(Tabs)({
  borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
  '& .MuiTabs-indicator': {
    backgroundColor: '#ffffff',
  },
  '& .MuiTab-root': {
    color: 'rgba(255, 255, 255, 0.7)',
    '&.Mui-selected': {
      color: '#ffffff',
    },
  },
});

interface ProfileDetailsDialogProps {
  open: boolean;
  onClose: () => void;
  profileId: string | null;
}

export function ProfileDetailsDialog({ open, onClose, profileId }: ProfileDetailsDialogProps) {
  const [activeTab, setActiveTab] = useState(0);

  const { data: profile, isLoading: profileLoading } = useProfile(profileId || '', {
    enabled: !!profileId && open,
  });


  const { data: resources, isLoading: resourcesLoading } = useProfileResources(profileId || '', {
    enabled: !!profileId && open && activeTab === 1,
    refetchInterval: 5000, // Обновляем каждые 5 секунд
  });

  const { data: health, isLoading: healthLoading } = useProfileHealth(profileId || '', {
    enabled: !!profileId && open && activeTab === 1,
  });

  const { data: networkStats, isLoading: networkLoading } = useProfileNetworkStats(profileId || '', {
    enabled: !!profileId && open && activeTab === 2,
    refetchInterval: 5000,
  });

  const { data: alertsData, isLoading: alertsLoading } = useProfileAlerts(profileId || '', 50, false, undefined, undefined, {
    enabled: !!profileId && open && activeTab === 3,
  });

  const { data: unreadCount } = useProfileUnreadAlertsCount(profileId || '', {
    enabled: !!profileId && open,
    refetchInterval: 10000,
  });

  const { data: analytics, isLoading: analyticsLoading } = useProfileAnalytics(profileId || '', 'day', undefined, undefined, {
    enabled: !!profileId && open && activeTab === 4,
  });

  const markAlertAsReadMutation = useMarkAlertAsRead();
  const markAllAlertsAsReadMutation = useMarkAllAlertsAsRead();

  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  const handleMarkAlertAsRead = (alertId: string) => {
    if (profileId) {
      markAlertAsReadMutation.mutate({ profileId, alertId });
    }
  };

  const handleMarkAllAlertsAsRead = () => {
    if (profileId) {
      markAllAlertsAsReadMutation.mutate(profileId);
    }
  };


  if (!profileId) {
    return null;
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('ru-RU', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  return (
    <Dialog open={open} onClose={onClose} PaperProps={dialogPaperProps} maxWidth="lg" fullWidth>
      {profileLoading ? (
        <DialogContent>
          <Box display="flex" justifyContent="center" alignItems="center" minHeight={200}>
            <CircularProgress sx={{ color: '#f5f5f5' }} />
          </Box>
        </DialogContent>
      ) : profile ? (
        <>
          <Box sx={dialogTitleStyles}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="h6">{profile.name}</Typography>
              <ProfileStatusChip status={profile.status} />
            </Box>
          </Box>

          <DialogContent>
            <StyledTabs value={activeTab} onChange={handleTabChange}>
              <Tab label="Основная информация" />
              <Tab label={`Ресурсы ${resources ? `(${resources.cpuUsage.toFixed(1)}%)` : ''}`} />
              <Tab label={`Сеть ${networkStats ? `(${formatBytes(networkStats.bytesReceived + networkStats.bytesSent)})` : ''}`} />
              <Tab label={`Алерты ${unreadCount ? `(${unreadCount.unreadCount})` : ''}`} />
              <Tab label="Аналитика" />
            </StyledTabs>

            <TabPanel value={activeTab} index={0}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Box>
                  <Typography variant="subtitle2" sx={{ color: 'rgba(255, 255, 255, 0.7)', mb: 0.5 }}>
                    Название
                  </Typography>
                  <Typography sx={{ color: '#ffffff' }}>{profile.name}</Typography>
                </Box>
                <Box>
                  <Typography variant="subtitle2" sx={{ color: 'rgba(255, 255, 255, 0.7)', mb: 0.5 }}>
                    Описание
                  </Typography>
                  <Typography sx={{ color: '#ffffff' }}>{profile.description || 'Нет описания'}</Typography>
                </Box>
                <Box>
                  <Typography variant="subtitle2" sx={{ color: 'rgba(255, 255, 255, 0.7)', mb: 0.5 }}>
                    Статус
                  </Typography>
                  <ProfileStatusChip status={profile.status} />
                </Box>
                <Box>
                  <Typography variant="subtitle2" sx={{ color: 'rgba(255, 255, 255, 0.7)', mb: 0.5 }}>
                    Режим работы
                  </Typography>
                  <Typography sx={{ color: '#ffffff' }}>
                    {profile.headless === true ? 'Без UI (фоновый режим)' : 'С UI (видимое окно)'}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="subtitle2" sx={{ color: 'rgba(255, 255, 255, 0.7)', mb: 0.5 }}>
                    Создан
                  </Typography>
                  <Typography sx={{ color: '#ffffff' }}>{formatDate(profile.createdAt)}</Typography>
                </Box>
                {profile.lastActiveAt && (
                  <Box>
                    <Typography variant="subtitle2" sx={{ color: 'rgba(255, 255, 255, 0.7)', mb: 0.5 }}>
                      Последняя активность
                    </Typography>
                    <Typography sx={{ color: '#ffffff' }}>{formatDate(profile.lastActiveAt)}</Typography>
                  </Box>
                )}
              </Box>
            </TabPanel>

            <TabPanel value={activeTab} index={1}>
              {resourcesLoading || healthLoading ? (
                <Box display="flex" justifyContent="center" alignItems="center" minHeight={200}>
                  <CircularProgress sx={{ color: '#f5f5f5' }} />
                </Box>
              ) : resources ? (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <Box>
                    <Typography variant="subtitle2" sx={{ color: 'rgba(255, 255, 255, 0.7)', mb: 1 }}>
                      Использование CPU
                    </Typography>
                    <Typography variant="h6" sx={{ color: '#ffffff' }}>
                      {resources.cpuUsage.toFixed(2)}%
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="subtitle2" sx={{ color: 'rgba(255, 255, 255, 0.7)', mb: 1 }}>
                      Использование памяти
                    </Typography>
                    <Typography variant="h6" sx={{ color: '#ffffff' }}>
                      {resources.memoryUsage.toFixed(2)} MB ({resources.memoryUsagePercent.toFixed(2)}%)
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="subtitle2" sx={{ color: 'rgba(255, 255, 255, 0.7)', mb: 1 }}>
                      PID процесса
                    </Typography>
                    <Typography sx={{ color: '#ffffff' }}>{resources.pid}</Typography>
                  </Box>
                  {health && (
                    <Box>
                      <Typography variant="subtitle2" sx={{ color: 'rgba(255, 255, 255, 0.7)', mb: 1 }}>
                        Здоровье профиля
                      </Typography>
                      <Typography sx={{ color: '#ffffff' }}>
                        {health.status === 'healthy' ? 'Здоров' : health.status === 'unhealthy' ? 'Не здоров' : health.status === 'degraded' ? 'Ухудшено' : 'Неизвестно'}
                      </Typography>
                    </Box>
                  )}
                </Box>
              ) : (
                <Alert severity="info" sx={{ backgroundColor: 'rgba(33, 150, 243, 0.1)', color: '#ffffff' }}>
                  Профиль не запущен. Статистика ресурсов будет доступна после запуска.
                </Alert>
              )}
            </TabPanel>

            <TabPanel value={activeTab} index={2}>
              {networkLoading ? (
                <Box display="flex" justifyContent="center" alignItems="center" minHeight={200}>
                  <CircularProgress sx={{ color: '#f5f5f5' }} />
                </Box>
              ) : networkStats ? (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <Box>
                    <Typography variant="subtitle2" sx={{ color: 'rgba(255, 255, 255, 0.7)', mb: 1 }}>
                      Входящий трафик
                    </Typography>
                    <Typography variant="h6" sx={{ color: '#ffffff' }}>
                      {formatBytes(networkStats.bytesReceived)}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="subtitle2" sx={{ color: 'rgba(255, 255, 255, 0.7)', mb: 1 }}>
                      Исходящий трафик
                    </Typography>
                    <Typography variant="h6" sx={{ color: '#ffffff' }}>
                      {formatBytes(networkStats.bytesSent)}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="subtitle2" sx={{ color: 'rgba(255, 255, 255, 0.7)', mb: 1 }}>
                      Скорость приема
                    </Typography>
                    <Typography sx={{ color: '#ffffff' }}>
                      {formatBytes(networkStats.receiveRate)}/с
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="subtitle2" sx={{ color: 'rgba(255, 255, 255, 0.7)', mb: 1 }}>
                      Скорость отправки
                    </Typography>
                    <Typography sx={{ color: '#ffffff' }}>
                      {formatBytes(networkStats.sendRate)}/с
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="subtitle2" sx={{ color: 'rgba(255, 255, 255, 0.7)', mb: 1 }}>
                      Активных соединений
                    </Typography>
                    <Typography sx={{ color: '#ffffff' }}>{networkStats.connectionsCount}</Typography>
                  </Box>
                </Box>
              ) : (
                <Alert severity="info" sx={{ backgroundColor: 'rgba(33, 150, 243, 0.1)', color: '#ffffff' }}>
                  Профиль не запущен. Статистика сетевой активности будет доступна после запуска.
                </Alert>
              )}
            </TabPanel>

            <TabPanel value={activeTab} index={3}>
              {alertsLoading ? (
                <Box display="flex" justifyContent="center" alignItems="center" minHeight={200}>
                  <CircularProgress sx={{ color: '#f5f5f5' }} />
                </Box>
              ) : alertsData && alertsData.alerts.length > 0 ? (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {unreadCount && unreadCount.unreadCount > 0 && (
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <StyledButton
                        variant="outlined"
                        size="small"
                        onClick={handleMarkAllAlertsAsRead}
                        disabled={markAllAlertsAsReadMutation.isPending}
                      >
                        Отметить все как прочитанные
                      </StyledButton>
                    </Box>
                  )}
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {alertsData.alerts.map((alert) => {
                      const isMessengerLoginAlert = alert.type === 'MESSENGER_LOGIN_REQUIRED';
                      const alertMetadata = alert.metadata || {};
                      const qrCodeFromAlert = alertMetadata.qrCode as string | undefined;
                      const cloudPasswordRequired = alertMetadata.cloudPasswordRequired as boolean | undefined;
                      const accountId = alertMetadata.accountId as string | undefined;
                      const serviceName = alertMetadata.serviceName as string | undefined;

                      // Функция для показа QR кода из алерта удалена, так как управление мессенджерами вынесено в отдельный диалог

                      return (
                        <Alert
                          key={alert.id}
                          severity={alert.severity === 'critical' ? 'error' : alert.severity === 'error' ? 'error' : alert.severity === 'warning' ? 'warning' : 'info'}
                          sx={{
                            backgroundColor: 'rgba(33, 150, 243, 0.1)',
                            color: '#ffffff',
                            opacity: alert.read ? 0.6 : 1,
                          }}
                          action={
                            !alert.read && (
                              <Button
                                size="small"
                                onClick={() => handleMarkAlertAsRead(alert.id)}
                                disabled={markAlertAsReadMutation.isPending}
                                sx={{ color: '#ffffff' }}
                              >
                                Отметить
                              </Button>
                            )
                          }
                        >
                          <Typography variant="subtitle2">{alert.title}</Typography>
                          <Typography variant="body2">{alert.message}</Typography>
                          <Typography variant="caption" sx={{ display: 'block', mt: 0.5, opacity: 0.7 }}>
                            {formatDate(alert.timestamp)}
                          </Typography>
                        </Alert>
                      );
                    })}
                  </Box>
                </Box>
              ) : (
                <Alert severity="info" sx={{ backgroundColor: 'rgba(33, 150, 243, 0.1)', color: '#ffffff' }}>
                  Алерты отсутствуют
                </Alert>
              )}
            </TabPanel>

            <TabPanel value={activeTab} index={4}>
              {analyticsLoading ? (
                <Box display="flex" justifyContent="center" alignItems="center" minHeight={200}>
                  <CircularProgress sx={{ color: '#f5f5f5' }} />
                </Box>
              ) : analytics ? (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <Box>
                    <Typography variant="h6" sx={{ color: '#ffffff', mb: 2 }}>
                      Статистика ресурсов
                    </Typography>
                    {analytics.resourceStats.length > 0 ? (
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {analytics.resourceStats.map((stat, index) => (
                          <Box
                            key={index}
                            sx={{
                              p: 2,
                              borderRadius: '8px',
                              backgroundColor: 'rgba(255, 255, 255, 0.05)',
                            }}
                          >
                            <Typography variant="subtitle2" sx={{ color: 'rgba(255, 255, 255, 0.7)', mb: 1 }}>
                              {new Date(stat.periodStart).toLocaleDateString('ru-RU')} -{' '}
                              {new Date(stat.periodEnd).toLocaleDateString('ru-RU')}
                            </Typography>
                            <Box sx={{ display: 'flex', gap: 3 }}>
                              <Box>
                                <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.5)' }}>
                                  Среднее CPU
                                </Typography>
                                <Typography sx={{ color: '#ffffff' }}>{stat.avgCpuUsage.toFixed(2)}%</Typography>
                              </Box>
                              <Box>
                                <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.5)' }}>
                                  Макс. CPU
                                </Typography>
                                <Typography sx={{ color: '#ffffff' }}>{stat.maxCpuUsage.toFixed(2)}%</Typography>
                              </Box>
                              <Box>
                                <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.5)' }}>
                                  Среднее память
                                </Typography>
                                <Typography sx={{ color: '#ffffff' }}>
                                  {stat.avgMemoryUsage.toFixed(2)} MB
                                </Typography>
                              </Box>
                              <Box>
                                <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.5)' }}>
                                  Макс. память
                                </Typography>
                                <Typography sx={{ color: '#ffffff' }}>
                                  {stat.maxMemoryUsage.toFixed(2)} MB
                                </Typography>
                              </Box>
                            </Box>
                          </Box>
                        ))}
                      </Box>
                    ) : (
                      <Alert severity="info" sx={{ backgroundColor: 'rgba(33, 150, 243, 0.1)', color: '#ffffff' }}>
                        Нет данных о ресурсах за выбранный период
                      </Alert>
                    )}
                  </Box>
                  <Box>
                    <Typography variant="h6" sx={{ color: '#ffffff', mb: 2 }}>
                      Сетевая статистика
                    </Typography>
                    {analytics.networkStats.length > 0 ? (
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {analytics.networkStats.map((stat, index) => (
                          <Box
                            key={index}
                            sx={{
                              p: 2,
                              borderRadius: '8px',
                              backgroundColor: 'rgba(255, 255, 255, 0.05)',
                            }}
                          >
                            <Typography variant="subtitle2" sx={{ color: 'rgba(255, 255, 255, 0.7)', mb: 1 }}>
                              {new Date(stat.periodStart).toLocaleDateString('ru-RU')} -{' '}
                              {new Date(stat.periodEnd).toLocaleDateString('ru-RU')}
                            </Typography>
                            <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                              <Box>
                                <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.5)' }}>
                                  Входящий трафик
                                </Typography>
                                <Typography sx={{ color: '#ffffff' }}>{formatBytes(stat.totalBytesReceived)}</Typography>
                              </Box>
                              <Box>
                                <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.5)' }}>
                                  Исходящий трафик
                                </Typography>
                                <Typography sx={{ color: '#ffffff' }}>{formatBytes(stat.totalBytesSent)}</Typography>
                              </Box>
                              <Box>
                                <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.5)' }}>
                                  Средняя скорость приема
                                </Typography>
                                <Typography sx={{ color: '#ffffff' }}>
                                  {formatBytes(stat.avgReceiveRate)}/с
                                </Typography>
                              </Box>
                              <Box>
                                <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.5)' }}>
                                  Средняя скорость отправки
                                </Typography>
                                <Typography sx={{ color: '#ffffff' }}>{formatBytes(stat.avgSendRate)}/с</Typography>
                              </Box>
                            </Box>
                          </Box>
                        ))}
                      </Box>
                    ) : (
                      <Alert severity="info" sx={{ backgroundColor: 'rgba(33, 150, 243, 0.1)', color: '#ffffff' }}>
                        Нет данных о сетевой активности за выбранный период
                      </Alert>
                    )}
                  </Box>
                </Box>
              ) : (
                <Alert severity="info" sx={{ backgroundColor: 'rgba(33, 150, 243, 0.1)', color: '#ffffff' }}>
                  Аналитика недоступна. Профиль должен быть запущен для сбора статистики.
                </Alert>
              )}
            </TabPanel>

          </DialogContent>

          <DialogActions sx={dialogActionsStyles}>
            <StyledButton onClick={onClose}>Закрыть</StyledButton>
          </DialogActions>
        </>
      ) : null}

    </Dialog>
  );
}

