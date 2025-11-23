/**
 * Компонент статистики по регионам
 * 
 * Отображает детальную статистику по клиентам в регионах для выбранного пользователя.
 * Позволяет переключаться между пользователями для просмотра статистики по их базам.
 */

import React, { useMemo, useState, useEffect } from 'react';
import {
  Box,
  Typography,
  FormControl,
  InputLabel,
  MenuItem,
  Card,
  CardContent,
  CircularProgress,
  Alert,
  Chip,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { StyledSelect, MenuProps, selectInputLabelStyles } from './common/SelectStyles';
import { useRegions } from '@/hooks/useRegions';
import { useUsers } from '@/hooks/useUsers';
import { listClients } from '@/utils/api';
import type { Client } from '@/types';

/**
 * Props для компонента RegionStatistics
 */
interface RegionStatisticsProps {
  selectedUserId?: string;
  onUserChange?: (userId: string | undefined) => void;
}

/**
 * Компонент статистики по регионам
 * 
 * Отображает:
 * - Список всех регионов
 * - Количество клиентов в каждом регионе для выбранного пользователя
 * - Общее количество клиентов пользователя
 * - Переключатель пользователя (для ROOT)
 */
export function RegionStatistics({ selectedUserId, onUserChange }: RegionStatisticsProps) {
  const { data: regions = [], isLoading: regionsLoading } = useRegions();
  const { data: users = [], isLoading: usersLoading } = useUsers(true); // Загружаем всех пользователей для ROOT
  const [localSelectedUserId, setLocalSelectedUserId] = useState<string | undefined>(selectedUserId);

  // Используем локальное состояние или переданное извне
  const currentUserId = selectedUserId !== undefined ? selectedUserId : localSelectedUserId;

  // Функция для получения всех клиентов пользователя через пагинацию
  const fetchAllClients = async (userId: string): Promise<Client[]> => {
    const allClients: Client[] = [];
    let page = 1;
    const limit = 100; // Максимальный лимит на бэкенде
    let hasMore = true;

    while (hasMore) {
      const response = await listClients({
        page,
        limit,
        userId,
      });

      allClients.push(...response.data);

      // Проверяем, есть ли еще страницы
      hasMore = response.pagination.hasNextPage;
      page++;
    }

    return allClients;
  };

  // Получаем всех клиентов для выбранного пользователя через пагинацию
  const {
    data: allClients,
    isLoading: clientsLoading,
  } = useQuery({
    queryKey: ['allClients', currentUserId],
    queryFn: () => (currentUserId ? fetchAllClients(currentUserId) : Promise.resolve([])),
    enabled: !!currentUserId,
    staleTime: 30 * 1000,
    retry: false,
  });

  // Вычисляем количество клиентов в каждом регионе для выбранного пользователя
  const regionClientsCount = useMemo(() => {
    const countMap = new Map<string, number>();
    
    if (!allClients || allClients.length === 0) {
      return countMap;
    }

    allClients.forEach((client) => {
      if (client.regionId) {
        const current = countMap.get(client.regionId) || 0;
        countMap.set(client.regionId, current + 1);
      }
    });

    return countMap;
  }, [allClients]);

  // Общее количество клиентов пользователя
  const totalClients = allClients?.length || 0;

  // Обработчик изменения пользователя
  const handleUserChange = (userId: string | undefined) => {
    setLocalSelectedUserId(userId);
    onUserChange?.(userId);
  };

  // Устанавливаем первого пользователя по умолчанию
  useEffect(() => {
    if (users.length > 0 && !currentUserId && selectedUserId === undefined) {
      const firstUser = users[0];
      handleUserChange(firstUser.id);
    }
  }, [users, currentUserId, selectedUserId]);

  const isLoading = regionsLoading || usersLoading || (clientsLoading && !!currentUserId);
  const selectedUser = users.find((u) => u.id === currentUserId);

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight={200}>
        <CircularProgress sx={{ color: '#f5f5f5' }} />
      </Box>
    );
  }

  if (!currentUserId) {
    return (
      <Alert
        severity="info"
        sx={{
          borderRadius: '12px',
          backgroundColor: 'rgba(33, 150, 243, 0.1)',
          color: '#ffffff',
          border: 'none',
        }}
      >
        Выберите пользователя для просмотра статистики
      </Alert>
    );
  }

  return (
    <Box>
      {/* Переключатель пользователя */}
      <Box sx={{ mb: 3 }}>
        <FormControl sx={{ minWidth: 300 }}>
          <InputLabel sx={selectInputLabelStyles}>База пользователя</InputLabel>
          <StyledSelect
            value={currentUserId || ''}
            onChange={(e) => handleUserChange(e.target.value || undefined)}
            label="База пользователя"
            MenuProps={MenuProps}
          >
            {users.map((user) => (
              <MenuItem key={user.id} value={user.id}>
                {user.name || user.email} {user.role === 'ROOT' ? '(ROOT)' : ''}
              </MenuItem>
            ))}
          </StyledSelect>
        </FormControl>
      </Box>

      {/* Общая статистика */}
      {selectedUser && (
        <Card
          sx={{
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            borderRadius: '12px',
            border: 'none',
            mb: 3,
          }}
        >
          <CardContent>
            <Typography variant="h6" sx={{ color: '#f5f5f5', mb: 2, fontWeight: 500 }}>
              Общая статистика
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <Box>
                <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)', mb: 0.5 }}>
                  Пользователь
                </Typography>
                <Typography variant="body1" sx={{ color: '#ffffff', fontWeight: 500 }}>
                  {selectedUser.name || selectedUser.email}
                </Typography>
              </Box>
              <Box>
                <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)', mb: 0.5 }}>
                  Всего клиентов
                </Typography>
                <Typography variant="body1" sx={{ color: '#ffffff', fontWeight: 500 }}>
                  {totalClients}
                </Typography>
              </Box>
              <Box>
                <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)', mb: 0.5 }}>
                  Регионов с клиентами
                </Typography>
                <Typography variant="body1" sx={{ color: '#ffffff', fontWeight: 500 }}>
                  {regionClientsCount.size}
                </Typography>
              </Box>
            </Box>
          </CardContent>
        </Card>
      )}

      {/* Статистика по регионам */}
      {regions.length === 0 ? (
        <Alert
          severity="info"
          sx={{
            borderRadius: '12px',
            backgroundColor: 'rgba(33, 150, 243, 0.1)',
            color: '#ffffff',
            border: 'none',
          }}
        >
          Регионы не найдены
        </Alert>
      ) : (
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 2 }}>
          {regions.map((region) => {
            const userClients = regionClientsCount.get(region.id) || 0;
            const totalClientsInRegion = region._count?.clients || 0;

            return (
              <Card
                key={region.id}
                sx={{
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  borderRadius: '12px',
                  border: 'none',
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  '&:hover': {
                    backgroundColor: 'rgba(255, 255, 255, 0.08)',
                    transform: 'translateY(-2px)',
                  },
                }}
              >
                <CardContent>
                  <Typography variant="h6" sx={{ color: '#f5f5f5', fontWeight: 500, mb: 2 }}>
                    {region.name}
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                        Клиентов у пользователя:
                      </Typography>
                      <Chip
                        label={userClients}
                        size="small"
                        sx={{
                          backgroundColor: userClients > 0 ? 'rgba(76, 175, 80, 0.2)' : 'rgba(158, 158, 158, 0.2)',
                          color: userClients > 0 ? '#4caf50' : '#9e9e9e',
                          fontWeight: 500,
                        }}
                      />
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                        Всего клиентов в регионе:
                      </Typography>
                      <Chip
                        label={totalClientsInRegion}
                        size="small"
                        sx={{
                          backgroundColor: 'rgba(33, 150, 243, 0.2)',
                          color: '#2196f3',
                          fontWeight: 500,
                        }}
                      />
                    </Box>
                    {userClients > 0 && (
                      <Box sx={{ mt: 1 }}>
                        <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.5)' }}>
                          {((userClients / totalClients) * 100).toFixed(1)}% от всех клиентов пользователя
                        </Typography>
                      </Box>
                    )}
                  </Box>
                </CardContent>
              </Card>
            );
          })}
        </Box>
      )}
    </Box>
  );
}

