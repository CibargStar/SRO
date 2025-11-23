/**
 * Страница управления клиентами
 * 
 * Предоставляет интерфейс для управления клиентами и группами клиентов:
 * - Список клиентов с пагинацией
 * - Поиск по ФИО
 * - Фильтрация по региону, группе, статусу
 * - Сортировка
 * - Создание клиента
 * - Редактирование клиента
 * - Удаление клиента
 * - Управление группами клиентов (создание, редактирование, удаление)
 */

import React, { useState, useEffect } from 'react';
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
import { dialogPaperProps, dialogTitleStyles, dialogActionsStyles } from '@/components/common/DialogStyles';
import { LOADING_ICON_SIZE } from '@/components/common/Constants';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import GroupIcon from '@mui/icons-material/Group';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import DownloadIcon from '@mui/icons-material/Download';
import IconButton from '@mui/material/IconButton';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import { useClients, useDeleteClient } from '@/hooks/useClients';
import { useRegions } from '@/hooks/useRegions';
import { useClientGroups, useDeleteClientGroup } from '@/hooks/useClientGroups';
import { useUsers } from '@/hooks/useUsers';
import { useExportGroup } from '@/hooks/useExport';
import { useAuthStore } from '@/store';
import { ClientGroupSelector } from '@/components/ClientGroupSelector';
import { ClientTable } from '@/components/ClientTable';
import { CreateClientDialog } from '@/components/CreateClientDialog';
import { EditClientDialog } from '@/components/EditClientDialog';
import { CreateClientGroupDialog } from '@/components/CreateClientGroupDialog';
import { EditClientGroupDialog } from '@/components/EditClientGroupDialog';
import { ImportClientsDialog } from '@/components/ImportClientsDialog';
import { formatClientName } from '@/utils';
import type { Client, ClientStatus, ClientGroup } from '@/types';


export function ClientsPage() {
  const user = useAuthStore((state) => state.user);
  const isRoot = user?.role === 'ROOT';
  
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [search, setSearch] = useState('');
  const [regionId, setRegionId] = useState<string | undefined>('');
  const [groupId, setGroupId] = useState<string | undefined>('');
  const [status, setStatus] = useState<ClientStatus | undefined>('');
  const [sortBy, setSortBy] = useState<'createdAt' | 'lastName' | 'firstName' | 'regionId' | 'status'>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  
  // Состояние для выбора пользователя (только для ROOT)
  // По умолчанию выбираем ROOT пользователя
  const { data: users = [] } = useUsers(isRoot);
  const rootUser = users.find(u => u.role === 'ROOT');
  const [selectedUserId, setSelectedUserId] = useState<string | undefined>(rootUser?.id);

  // Обновляем selectedUserId когда rootUser загрузится
  useEffect(() => {
    if (isRoot && rootUser && !selectedUserId) {
      setSelectedUserId(rootUser.id);
    }
  }, [isRoot, rootUser, selectedUserId]);

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);

  // Состояния для управления группами
  const [groupsDialogOpen, setGroupsDialogOpen] = useState(false);
  const [createGroupDialogOpen, setCreateGroupDialogOpen] = useState(false);
  const [editGroupDialogOpen, setEditGroupDialogOpen] = useState(false);
  const [deleteGroupDialogOpen, setDeleteGroupDialogOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<ClientGroup | null>(null);

  // Состояние для импорта
  const [importDialogOpen, setImportDialogOpen] = useState(false);

  // Состояние для экспорта
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportGroupId, setExportGroupId] = useState<string | null>(null);
  const [exportFormat, setExportFormat] = useState<'xlsx' | 'xls' | 'csv'>('xlsx');
  const exportMutation = useExportGroup();
  

  const { data: clientsData, isLoading, error } = useClients({
    page,
    limit,
    search: search || undefined,
    regionId,
    groupId,
    status,
    userId: isRoot && selectedUserId ? selectedUserId : undefined, // Для ROOT - фильтр по выбранному пользователю
    sortBy,
    sortOrder,
  });

  const { data: regions = [] } = useRegions();
  const { data: groups = [] } = useClientGroups();
  // Для модалки управления группами: используем выбранного пользователя с главной страницы
  const { data: groupsInDialog = [] } = useClientGroups(isRoot && selectedUserId ? selectedUserId : undefined);
  const deleteMutation = useDeleteClient();
  const deleteGroupMutation = useDeleteClientGroup();

  const handleEdit = (client: Client) => {
    setSelectedClient(client);
    setEditDialogOpen(true);
  };

  const handleDelete = (client: Client) => {
    setSelectedClient(client);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (selectedClient) {
      deleteMutation.mutate(selectedClient.id, {
        onSuccess: () => {
          setDeleteDialogOpen(false);
          setSelectedClient(null);
        },
      });
    }
  };

  const handleCloseEditDialog = () => {
    setEditDialogOpen(false);
    setSelectedClient(null);
  };

  const handleCloseDeleteDialog = () => {
    setDeleteDialogOpen(false);
    setSelectedClient(null);
  };

  // Обработчики для управления группами
  const handleEditGroup = (group: ClientGroup) => {
    setSelectedGroup(group);
    setEditGroupDialogOpen(true);
  };

  const handleDeleteGroup = (group: ClientGroup) => {
    setSelectedGroup(group);
    setDeleteGroupDialogOpen(true);
  };

  const handleConfirmDeleteGroup = () => {
    if (selectedGroup) {
      deleteGroupMutation.mutate(selectedGroup.id, {
        onSuccess: () => {
          setDeleteGroupDialogOpen(false);
          setSelectedGroup(null);
        },
      });
    }
  };

  const handleCloseEditGroupDialog = () => {
    setEditGroupDialogOpen(false);
    setSelectedGroup(null);
  };

  const handleCloseDeleteGroupDialog = () => {
    setDeleteGroupDialogOpen(false);
    setSelectedGroup(null);
  };

  // Обработчики для экспорта
  const handleExportGroup = (groupId: string) => {
    setExportGroupId(groupId);
    setExportDialogOpen(true);
  };

  const handleConfirmExport = () => {
    if (exportGroupId) {
      exportMutation.mutate(
        { groupId: exportGroupId, format: exportFormat },
        {
          onSuccess: () => {
            setExportDialogOpen(false);
            setExportGroupId(null);
            setExportFormat('xlsx');
          },
        }
      );
    }
  };

  const handleCloseExportDialog = () => {
    setExportDialogOpen(false);
    setExportGroupId(null);
    setExportFormat('xlsx');
  };

  const errorMessage = error ? 'Не удалось загрузить клиентов' : null;

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
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Typography variant="h4" component="h1" sx={{ color: '#f5f5f5', fontWeight: 500 }}>
          Управление клиентами
        </Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <StyledButton startIcon={<GroupIcon />} onClick={() => setGroupsDialogOpen(true)}>
            Управление группами
          </StyledButton>
          <StyledButton startIcon={<UploadFileIcon />} onClick={() => setImportDialogOpen(true)}>
            Импорт клиентов
          </StyledButton>
          <StyledButton startIcon={<AddIcon />} onClick={() => setCreateDialogOpen(true)}>
            Создать клиента
          </StyledButton>
        </Box>
      </Box>

      {/* Селектор пользователя для ROOT */}
      {isRoot && (
        <Box sx={{ mb: 3 }}>
          <FormControl sx={{ minWidth: 270 }}>
            <InputLabel 
              sx={{ 
                color: 'rgba(255, 255, 255, 0.7)',
                '&.Mui-focused': {
                  color: 'rgba(255, 255, 255, 0.7)',
                },
                '&.MuiInputLabel-shrink': {
                  color: 'rgba(255, 255, 255, 0.7)',
                },
              }}
            >
              База пользователя
            </InputLabel>
            <StyledSelect
              value={selectedUserId || ''}
              onChange={(e) => {
                setSelectedUserId(e.target.value || undefined);
                setPage(1); // Сбрасываем на первую страницу при смене пользователя
                setGroupId(''); // Сбрасываем фильтр группы при смене пользователя
              }}
              label="База пользователя"
              MenuProps={MenuProps}
            >
              {users.map((u) => (
                <MenuItem key={u.id} value={u.id}>
                  {u.name || u.email} {u.role === 'ROOT' ? '(ROOT)' : ''}
                </MenuItem>
              ))}
            </StyledSelect>
          </FormControl>
        </Box>
      )}

      {/* Фильтры и поиск */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mb: 3 }}>
        <StyledTextField
          fullWidth
          placeholder="Поиск по ФИО или номеру телефона..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1); // Сбрасываем на первую страницу при поиске
          }}
          InputProps={{
            startAdornment: <SearchIcon sx={{ color: 'rgba(255, 255, 255, 0.7)', mr: 1 }} />,
          }}
        />

        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <FormControl sx={{ minWidth: 200 }}>
            <InputLabel 
              shrink
              sx={selectInputLabelStyles}
            >
              Регион
            </InputLabel>
            <StyledSelect
              value={regionId || ''}
              onChange={(e) => {
                setRegionId(e.target.value || undefined);
                setPage(1);
              }}
              label="Регион"
              MenuProps={MenuProps}
              displayEmpty
              renderValue={(selected) => {
                if (!selected || selected === '') {
                  return 'Все';
                }
                return regions.find(r => r.id === selected)?.name || selected;
              }}
            >
              <MenuItem value="">Все</MenuItem>
              {regions.map((region) => (
                <MenuItem key={region.id} value={region.id}>
                  {region.name}
                </MenuItem>
              ))}
            </StyledSelect>
          </FormControl>

          <ClientGroupSelector
            value={groupId || null}
            onChange={(val) => {
              setGroupId(val || undefined);
              setPage(1);
            }}
            label="Группа"
            fullWidth={false}
            userId={isRoot && selectedUserId ? selectedUserId : undefined}
          />

          <FormControl sx={{ minWidth: 150 }}>
            <InputLabel 
              shrink
              sx={selectInputLabelStyles}
            >
              Статус
            </InputLabel>
            <StyledSelect
              value={status || ''}
              onChange={(e) => {
                setStatus((e.target.value as ClientStatus) || undefined);
                setPage(1);
              }}
              label="Статус"
              MenuProps={MenuProps}
              displayEmpty
              renderValue={(selected) => {
                if (!selected || selected === '') {
                  return 'Все';
                }
                return selected === 'NEW' ? 'Новый' : selected === 'OLD' ? 'Старый' : selected;
              }}
            >
              <MenuItem value="">Все</MenuItem>
              <MenuItem value="NEW">Новый</MenuItem>
              <MenuItem value="OLD">Старый</MenuItem>
            </StyledSelect>
          </FormControl>

          <FormControl sx={{ minWidth: 150 }}>
            <InputLabel sx={selectInputLabelStyles}>
              Сортировка
            </InputLabel>
            <StyledSelect
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              label="Сортировка"
              MenuProps={MenuProps}
            >
              <MenuItem value="createdAt">По дате</MenuItem>
              <MenuItem value="lastName">По фамилии</MenuItem>
              <MenuItem value="firstName">По имени</MenuItem>
              <MenuItem value="regionId">По региону</MenuItem>
              <MenuItem value="status">По статусу</MenuItem>
            </StyledSelect>
          </FormControl>

          <FormControl sx={{ minWidth: 120 }}>
            <InputLabel sx={selectInputLabelStyles}>
              Порядок
            </InputLabel>
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
        <Alert severity="error" sx={{ mb: 3, borderRadius: '12px', backgroundColor: 'rgba(244, 67, 54, 0.1)', color: '#ffffff', border: 'none' }}>
          {errorMessage}
        </Alert>
      )}

      {isLoading ? (
        <Box display="flex" justifyContent="center" alignItems="center" minHeight={400}>
          <CircularProgress sx={{ color: '#f5f5f5' }} />
        </Box>
      ) : clientsData ? (
        <>
          <ClientTable
            clients={clientsData.data}
            isLoading={isLoading}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />

          {/* Пагинация */}
          {clientsData.pagination.totalPages > 1 && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
              <Pagination
                count={clientsData.pagination.totalPages}
                page={page}
                onChange={(_, value) => setPage(value)}
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

          {/* Информация о пагинации */}
          <Box sx={{ mt: 2, textAlign: 'center' }}>
            <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.5)' }}>
              Показано {clientsData.data.length} из {clientsData.pagination.total} клиентов
            </Typography>
          </Box>
        </>
      ) : (
        <Alert severity="info" sx={{ borderRadius: '12px', backgroundColor: 'rgba(33, 150, 243, 0.1)', color: '#ffffff', border: 'none' }}>
          Не удалось загрузить клиентов
        </Alert>
      )}

      <CreateClientDialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        userId={isRoot && selectedUserId ? selectedUserId : undefined} // Для ROOT - передаем выбранного пользователя
      />
      <EditClientDialog
        open={editDialogOpen}
        client={selectedClient}
        onClose={handleCloseEditDialog}
        userId={isRoot && selectedUserId ? selectedUserId : undefined} // Для ROOT - передаем выбранного пользователя для фильтрации групп
      />

      {/* Диалог управления группами */}
      <Dialog
        open={groupsDialogOpen}
        onClose={() => {
          setGroupsDialogOpen(false);
        }}
        maxWidth="md"
        fullWidth
        disableEnforceFocus
        PaperProps={dialogPaperProps}
      >
        <Box sx={dialogTitleStyles}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6" sx={{ color: '#f5f5f5', fontWeight: 500 }}>
              Управление группами клиентов
            </Typography>
            <StyledButton startIcon={<AddIcon />} onClick={() => setCreateGroupDialogOpen(true)} size="small">
              Создать группу
            </StyledButton>
          </Box>
        </Box>
        <DialogContent sx={{ px: 3, pt: 3 }}>
          {groupsInDialog.length === 0 ? (
            <Alert severity="info" sx={{ borderRadius: '12px', backgroundColor: 'rgba(33, 150, 243, 0.1)', color: '#ffffff', border: 'none' }}>
              Группы не найдены. Создайте первую группу.
            </Alert>
          ) : (
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 2 }}>
              {groupsInDialog.map((group) => (
                <Card
                  key={group.id}
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
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                      <Box>
                        <Typography variant="h6" sx={{ color: '#f5f5f5', fontWeight: 500, mb: 1 }}>
                          {group.name}
                        </Typography>
                        {group.description && (
                          <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)', mb: 1 }}>
                            {group.description}
                          </Typography>
                        )}
                      </Box>
                      <Box>
                        <IconButton
                          size="small"
                          onClick={() => handleExportGroup(group.id)}
                          sx={{
                            color: 'rgba(255, 255, 255, 0.7)',
                            '&:hover': { color: '#ffffff', backgroundColor: 'rgba(255, 255, 255, 0.1)' },
                            title: 'Экспортировать группу',
                          }}
                        >
                          <DownloadIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={() => handleEditGroup(group)}
                          sx={{
                            color: 'rgba(255, 255, 255, 0.7)',
                            '&:hover': { color: '#ffffff', backgroundColor: 'rgba(255, 255, 255, 0.1)' },
                          }}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={() => handleDeleteGroup(group)}
                          sx={{
                            color: 'rgba(255, 255, 255, 0.7)',
                            '&:hover': { color: '#ffffff', backgroundColor: 'rgba(255, 255, 255, 0.1)' },
                          }}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Box>
                    </Box>

                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
                      {group.color && (
                        <Chip
                          label={group.color}
                          size="small"
                          sx={{
                            backgroundColor: group.color,
                            color: '#ffffff',
                            fontSize: '0.7rem',
                            height: 20,
                          }}
                        />
                      )}
                      <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.5)' }}>
                        Клиентов: {group._count?.clients || 0}
                      </Typography>
                    </Box>
                  </CardContent>
                </Card>
              ))}
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={dialogActionsStyles}>
          <CancelButton onClick={() => setGroupsDialogOpen(false)}>Закрыть</CancelButton>
        </DialogActions>
      </Dialog>

      <CreateClientGroupDialog
        open={createGroupDialogOpen}
        onClose={() => {
          setCreateGroupDialogOpen(false);
          // Инвалидируем кэш групп для обновления списка в модалке
        }}
        userId={isRoot && selectedUserId ? selectedUserId : undefined} // Для ROOT - передаем выбранного пользователя с главной страницы
      />
      <EditClientGroupDialog
        open={editGroupDialogOpen}
        group={selectedGroup}
        onClose={handleCloseEditGroupDialog}
        ownerId={isRoot && selectedUserId ? selectedUserId : undefined} // Для ROOT - передаем выбранного пользователя с главной страницы
      />

      {/* Диалог подтверждения удаления группы */}
      <Dialog
        open={deleteGroupDialogOpen}
        onClose={handleCloseDeleteGroupDialog}
        disableEnforceFocus
        PaperProps={dialogPaperProps}
      >
        <DialogTitle sx={{ color: '#f5f5f5' }}>Подтверждение удаления</DialogTitle>
        <DialogContent>
          <Typography sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
            Вы уверены, что хотите удалить группу "{selectedGroup?.name}"?
            Все клиенты из этой группы ({selectedGroup?._count?.clients || 0} клиентов) и их телефоны будут безвозвратно удалены.
            Это действие нельзя отменить.
          </Typography>
        </DialogContent>
        <DialogActions sx={dialogActionsStyles}>
          <CancelButton onClick={handleCloseDeleteGroupDialog} disabled={deleteGroupMutation.isPending}>
            Отмена
          </CancelButton>
          <StyledButton onClick={handleConfirmDeleteGroup} disabled={deleteGroupMutation.isPending}>
            {deleteGroupMutation.isPending ? <CircularProgress size={LOADING_ICON_SIZE} /> : 'Удалить'}
          </StyledButton>
        </DialogActions>
      </Dialog>

      {/* Диалог подтверждения удаления клиента */}
      <Dialog
        open={deleteDialogOpen}
        onClose={handleCloseDeleteDialog}
        disableEnforceFocus
        PaperProps={dialogPaperProps}
      >
        <DialogTitle sx={{ color: '#f5f5f5' }}>Подтверждение удаления</DialogTitle>
        <DialogContent>
          <Typography sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
            Вы уверены, что хотите удалить клиента{' '}
            {selectedClient ? formatClientName(selectedClient) : ''}? Это действие нельзя отменить.
          </Typography>
        </DialogContent>
        <DialogActions sx={dialogActionsStyles}>
          <CancelButton onClick={handleCloseDeleteDialog} disabled={deleteMutation.isPending}>
            Отмена
          </CancelButton>
          <StyledButton onClick={handleConfirmDelete} disabled={deleteMutation.isPending}>
            {deleteMutation.isPending ? <CircularProgress size={LOADING_ICON_SIZE} /> : 'Удалить'}
          </StyledButton>
        </DialogActions>
      </Dialog>

      {/* Диалог импорта клиентов */}
      <ImportClientsDialog
        open={importDialogOpen}
        onClose={() => setImportDialogOpen(false)}
        userId={isRoot && selectedUserId ? selectedUserId : undefined} // Для ROOT - передаем выбранного пользователя
      />

      {/* Диалог экспорта группы */}
      <Dialog
        open={exportDialogOpen}
        onClose={handleCloseExportDialog}
        disableEnforceFocus
        PaperProps={dialogPaperProps}
      >
        <DialogTitle sx={{ color: '#f5f5f5' }}>Экспорт группы</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <Typography sx={{ color: 'rgba(255, 255, 255, 0.7)', mb: 1 }}>
              Выберите формат файла для экспорта:
            </Typography>
            <FormControl fullWidth>
              <InputLabel sx={selectInputLabelStyles}>
                Формат файла
              </InputLabel>
              <StyledSelect
                value={exportFormat}
                onChange={(e) => setExportFormat(e.target.value as 'xlsx' | 'xls' | 'csv')}
                label="Формат файла"
                MenuProps={MenuProps}
              >
                <MenuItem value="xlsx">Excel (XLSX)</MenuItem>
                <MenuItem value="xls">Excel (XLS)</MenuItem>
                <MenuItem value="csv">CSV</MenuItem>
              </StyledSelect>
            </FormControl>
            {exportMutation.error && (
              <Alert severity="error" sx={{ borderRadius: '12px', backgroundColor: 'rgba(244, 67, 54, 0.1)', color: '#ffffff', border: 'none' }}>
                {exportMutation.error instanceof Error ? exportMutation.error.message : 'Не удалось экспортировать группу'}
              </Alert>
            )}
          </Box>
        </DialogContent>
        <DialogActions sx={dialogActionsStyles}>
          <CancelButton onClick={handleCloseExportDialog} disabled={exportMutation.isPending}>
            Отмена
          </CancelButton>
          <StyledButton onClick={handleConfirmExport} disabled={exportMutation.isPending} startIcon={<DownloadIcon />}>
            {exportMutation.isPending ? <CircularProgress size={LOADING_ICON_SIZE} /> : 'Экспортировать'}
          </StyledButton>
        </DialogActions>
      </Dialog>
    </Box>
  );
}


