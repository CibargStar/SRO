/**
 * Страница управления профилями Chrome
 * 
 * Предоставляет интерфейс для управления профилями:
 * - Список профилей с пагинацией
 * - Фильтрация по статусу
 * - Сортировка
 * - Создание профиля
 * - Редактирование профиля
 * - Удаление профиля
 * - Запуск/остановка профилей
 * - Просмотр деталей профиля
 */

import React, { useState, useMemo, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Alert,
  CircularProgress,
  TextField,
  FormControl,
  InputLabel,
  MenuItem,
  Pagination,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import { StyledSelect, MenuProps, selectInputLabelStyles } from '@/components/common/SelectStyles';
import { StyledButton, StyledTextField, CancelButton } from '@/components/common/FormStyles';
import { dialogPaperProps } from '@/components/common/DialogStyles';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import { useQueryClient } from '@tanstack/react-query';
import { useProfiles, useDeleteProfile, useStartProfile, useStopProfile, profilesKeys } from '@/hooks/useProfiles';
import { ProfileTable } from '@/components/ProfileTable';
import { CreateProfileDialog } from '@/components/CreateProfileDialog';
import { EditProfileDialog } from '@/components/EditProfileDialog';
import { ProfileDetailsDialog } from '@/components/ProfileDetailsDialog';
import type { Profile, ProfileStatus } from '@/types';

export function ProfilesPage() {
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<ProfileStatus | undefined>(undefined);
  const [sortBy, setSortBy] = useState<'createdAt' | 'updatedAt' | 'name' | 'status' | 'lastActiveAt'>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);

  const [isStarting, setIsStarting] = useState<string | null>(null);
  const [isStopping, setIsStopping] = useState<string | null>(null);

  const { data: profilesData, isLoading, error } = useProfiles({
    page,
    limit,
    status,
    sortBy,
    sortOrder,
  });

  const queryClient = useQueryClient();
  const deleteMutation = useDeleteProfile();
  const startMutation = useStartProfile();
  const stopMutation = useStopProfile();

  // Фильтрация по поисковому запросу (client-side, т.к. бэкенд не поддерживает поиск)
  // Используем useMemo для пересчета при изменении profilesData
  const filteredProfiles = useMemo(() => {
    if (!profilesData?.data) return [];
    if (!search) return profilesData.data;
    const searchLower = search.toLowerCase();
    return profilesData.data.filter((profile) => 
      profile.name.toLowerCase().includes(searchLower) ||
      (profile.description && profile.description.toLowerCase().includes(searchLower))
    );
  }, [profilesData, search]); // Используем весь profilesData, а не только data
  
  // Логирование для отладки обновления данных
  useEffect(() => {
    if (profilesData?.data) {
      const testProfile = profilesData.data.find(p => p.id === '5a4b9aee-a352-42dc-8b6c-f9e4c4b5b85f');
      if (testProfile) {
        console.log('[ProfilesPage] Test profile headless value:', testProfile.headless, 'Full data:', profilesData);
      }
    }
  }, [profilesData]);

  const handleEdit = (profile: Profile) => {
    // Используем профиль из кэша, если он там есть (более актуальный)
    // Иначе используем переданный профиль
    const cachedProfile = queryClient.getQueryData<Profile>(profilesKeys.detail(profile.id));
    setSelectedProfile(cachedProfile || profile);
    setEditDialogOpen(true);
  };

  const handleDelete = (profile: Profile) => {
    setSelectedProfile(profile);
    setDeleteDialogOpen(true);
  };

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

  const handleStart = (profile: Profile) => {
    setIsStarting(profile.id);
    startMutation.mutate(
      { profileId: profile.id },
      {
        onSuccess: () => {
          setIsStarting(null);
        },
        onError: () => {
          setIsStarting(null);
        },
      }
    );
  };

  const handleStop = (profile: Profile) => {
    setIsStopping(profile.id);
    stopMutation.mutate(
      { profileId: profile.id, force: false },
      {
        onSuccess: () => {
          setIsStopping(null);
        },
        onError: () => {
          setIsStopping(null);
        },
      }
    );
  };

  const handleDetails = (profile: Profile) => {
    setSelectedProfile(profile);
    setDetailsDialogOpen(true);
  };

  const handleCloseEditDialog = () => {
    setEditDialogOpen(false);
    setSelectedProfile(null);
  };

  const handleCloseDeleteDialog = () => {
    setDeleteDialogOpen(false);
    setSelectedProfile(null);
  };

  const handleCloseDetailsDialog = () => {
    setDetailsDialogOpen(false);
    setSelectedProfile(null);
  };

  const errorMessage = error ? 'Не удалось загрузить профили' : null;

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
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Typography variant="h4" component="h1" sx={{ color: '#f5f5f5', fontWeight: 500 }}>
          Управление профилями Chrome
        </Typography>
        <StyledButton startIcon={<AddIcon />} onClick={() => setCreateDialogOpen(true)}>
          Создать профиль
        </StyledButton>
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
                if (!selected || selected === '') {
                  return 'Все';
                }
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
        </Box>
      </Box>

      {errorMessage && (
        <Alert severity="error" sx={{ mb: 3, borderRadius: '12px', backgroundColor: 'rgba(244, 67, 54, 0.1)', color: '#ffffff' }}>
          {errorMessage}
        </Alert>
      )}

      {isLoading ? (
        <Box display="flex" justifyContent="center" alignItems="center" minHeight={400}>
          <CircularProgress sx={{ color: '#f5f5f5' }} />
        </Box>
      ) : profilesData ? (
        <>
          <ProfileTable
            profiles={filteredProfiles}
            isLoading={isLoading}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onStart={handleStart}
            onStop={handleStop}
            onDetails={handleDetails}
            isStarting={isStarting}
            isStopping={isStopping}
          />

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
                      backgroundColor: 'rgba(255, 255, 255, 0.1)',
                      color: '#ffffff',
                    },
                    '&:hover': {
                      backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    },
                  },
                }}
              />
            </Box>
          )}
        </>
      ) : null}

      {/* Диалог создания */}
      <CreateProfileDialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} />

      {/* Диалог редактирования */}
      <EditProfileDialog
        open={editDialogOpen}
        onClose={handleCloseEditDialog}
        profile={selectedProfile}
        onProfileUpdated={(updatedProfile) => {
          // Обновляем selectedProfile с новым значением из сервера
          setSelectedProfile(updatedProfile);
        }}
      />

      {/* Диалог удаления */}
      <Dialog open={deleteDialogOpen} onClose={handleCloseDeleteDialog} PaperProps={dialogPaperProps}>
        <DialogTitle sx={{ color: '#ffffff' }}>Удаление профиля</DialogTitle>
        <DialogContent>
          <Typography sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
            Вы уверены, что хотите удалить профиль &quot;{selectedProfile?.name}&quot;?
            <br />
            <br />
            Это действие нельзя отменить. Профиль и все связанные данные будут удалены.
          </Typography>
          {deleteMutation.isError && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {deleteMutation.error instanceof Error
                ? deleteMutation.error.message
                : 'Произошла ошибка при удалении профиля'}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <CancelButton onClick={handleCloseDeleteDialog} disabled={deleteMutation.isPending}>
            Отмена
          </CancelButton>
          <StyledButton
            onClick={handleConfirmDelete}
            disabled={deleteMutation.isPending}
            color="error"
            variant="contained"
          >
            {deleteMutation.isPending ? <CircularProgress size={20} /> : 'Удалить'}
          </StyledButton>
        </DialogActions>
      </Dialog>

      {/* Диалог деталей профиля */}
      <ProfileDetailsDialog
        open={detailsDialogOpen}
        onClose={handleCloseDetailsDialog}
        profileId={selectedProfile?.id || null}
      />
    </Box>
  );
}

