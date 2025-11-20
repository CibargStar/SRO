/**
 * Страница управления клиентами
 * 
 * Предоставляет интерфейс для управления клиентами:
 * - Список клиентов с пагинацией
 * - Поиск по ФИО
 * - Фильтрация по региону, группе, статусу
 * - Сортировка
 * - Создание клиента
 * - Редактирование клиента
 * - Удаление клиента
 */

import React, { useState } from 'react';
import {
  Box,
  Typography,
  Button,
  Alert,
  CircularProgress,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Pagination,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import { useClients, useDeleteClient } from '@/hooks/useClients';
import { useRegions } from '@/hooks/useRegions';
import { useClientGroups } from '@/hooks/useClientGroups';
import { ClientTable } from '@/components/ClientTable';
import { CreateClientDialog } from '@/components/CreateClientDialog';
import { EditClientDialog } from '@/components/EditClientDialog';
import type { Client, ClientStatus } from '@/types';

const StyledButton = styled(Button)(({ theme }) => ({
  borderRadius: '12px',
  backgroundColor: '#f5f5f5',
  color: '#212121',
  textTransform: 'none',
  fontWeight: 500,
  padding: theme.spacing(1.5, 3),
  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  '&:hover': {
    backgroundColor: '#ffffff',
    transform: 'translateY(-2px)',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
  },
}));

const StyledTextField = styled(TextField)({
  '& .MuiOutlinedInput-root': {
    borderRadius: '12px',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    color: '#ffffff',
    '& fieldset': { border: 'none' },
    '&:hover fieldset': { border: 'none' },
    '&.Mui-focused fieldset': { border: 'none' },
  },
  '& .MuiInputLabel-root': { color: 'rgba(255, 255, 255, 0.7)' },
  '& .MuiInputLabel-root.Mui-focused': { color: 'rgba(255, 255, 255, 0.9)' },
});

const StyledSelect = styled(Select)({
  borderRadius: '12px',
  backgroundColor: 'rgba(255, 255, 255, 0.05)',
  color: '#ffffff',
  '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
  '&:hover .MuiOutlinedInput-notchedOutline': { border: 'none' },
  '&.Mui-focused .MuiOutlinedInput-notchedOutline': { border: 'none' },
  '& .MuiSelect-icon': { color: 'rgba(255, 255, 255, 0.7)' },
});

export function ClientsPage() {
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [search, setSearch] = useState('');
  const [regionId, setRegionId] = useState<string | undefined>(undefined);
  const [groupId, setGroupId] = useState<string | undefined>(undefined);
  const [status, setStatus] = useState<ClientStatus | undefined>(undefined);
  const [sortBy, setSortBy] = useState<'createdAt' | 'lastName' | 'firstName' | 'regionId' | 'status'>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);

  const { data: clientsData, isLoading, error } = useClients({
    page,
    limit,
    search: search || undefined,
    regionId,
    groupId,
    status,
    sortBy,
    sortOrder,
  });

  const { data: regions = [] } = useRegions();
  const { data: groups = [] } = useClientGroups();
  const deleteMutation = useDeleteClient();

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

  const errorMessage = error ? 'Не удалось загрузить клиентов' : null;

  return (
    <Box sx={{ width: '100%' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Typography variant="h4" component="h1" sx={{ color: '#f5f5f5', fontWeight: 500 }}>
          Управление клиентами
        </Typography>
        <StyledButton startIcon={<AddIcon />} onClick={() => setCreateDialogOpen(true)}>
          Создать клиента
        </StyledButton>
      </Box>

      {/* Фильтры и поиск */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mb: 3 }}>
        <StyledTextField
          fullWidth
          placeholder="Поиск по ФИО..."
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
            <InputLabel sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>Регион</InputLabel>
            <StyledSelect
              value={regionId || ''}
              onChange={(e) => {
                setRegionId(e.target.value || undefined);
                setPage(1);
              }}
              label="Регион"
            >
              <MenuItem value="">Все</MenuItem>
              {regions.map((region) => (
                <MenuItem key={region.id} value={region.id}>
                  {region.name}
                </MenuItem>
              ))}
            </StyledSelect>
          </FormControl>

          <FormControl sx={{ minWidth: 200 }}>
            <InputLabel sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>Группа</InputLabel>
            <StyledSelect
              value={groupId || ''}
              onChange={(e) => {
                setGroupId(e.target.value || undefined);
                setPage(1);
              }}
              label="Группа"
            >
              <MenuItem value="">Все</MenuItem>
              {groups.map((group) => (
                <MenuItem key={group.id} value={group.id}>
                  {group.name}
                </MenuItem>
              ))}
            </StyledSelect>
          </FormControl>

          <FormControl sx={{ minWidth: 150 }}>
            <InputLabel sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>Статус</InputLabel>
            <StyledSelect
              value={status || ''}
              onChange={(e) => {
                setStatus((e.target.value as ClientStatus) || undefined);
                setPage(1);
              }}
              label="Статус"
            >
              <MenuItem value="">Все</MenuItem>
              <MenuItem value="NEW">Новый</MenuItem>
              <MenuItem value="OLD">Старый</MenuItem>
            </StyledSelect>
          </FormControl>

          <FormControl sx={{ minWidth: 150 }}>
            <InputLabel sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>Сортировка</InputLabel>
            <StyledSelect
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              label="Сортировка"
            >
              <MenuItem value="createdAt">По дате</MenuItem>
              <MenuItem value="lastName">По фамилии</MenuItem>
              <MenuItem value="firstName">По имени</MenuItem>
              <MenuItem value="regionId">По региону</MenuItem>
              <MenuItem value="status">По статусу</MenuItem>
            </StyledSelect>
          </FormControl>

          <FormControl sx={{ minWidth: 120 }}>
            <InputLabel sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>Порядок</InputLabel>
            <StyledSelect value={sortOrder} onChange={(e) => setSortOrder(e.target.value as typeof sortOrder)} label="Порядок">
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

      <CreateClientDialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} />
      <EditClientDialog open={editDialogOpen} client={selectedClient} onClose={handleCloseEditDialog} />

      {/* Диалог подтверждения удаления */}
      <Dialog
        open={deleteDialogOpen}
        onClose={handleCloseDeleteDialog}
        PaperProps={{ sx: { backgroundColor: '#212121', borderRadius: '12px' } }}
      >
        <DialogTitle sx={{ color: '#f5f5f5' }}>Подтверждение удаления</DialogTitle>
        <DialogContent>
          <Typography sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
            Вы уверены, что хотите удалить клиента {selectedClient ? `${selectedClient.lastName} ${selectedClient.firstName}` : ''}?
            Это действие нельзя отменить.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <CancelButton onClick={handleCloseDeleteDialog} disabled={deleteMutation.isPending}>
            Отмена
          </CancelButton>
          <StyledButton onClick={handleConfirmDelete} disabled={deleteMutation.isPending}>
            {deleteMutation.isPending ? <CircularProgress size={20} /> : 'Удалить'}
          </StyledButton>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

const CancelButton = styled(Button)(({ theme }) => ({
  borderRadius: '12px',
  backgroundColor: 'transparent',
  color: 'rgba(255, 255, 255, 0.7)',
  textTransform: 'none',
  padding: theme.spacing(1.5, 3),
  '&:hover': { backgroundColor: 'rgba(255, 255, 255, 0.1)', color: '#ffffff' },
}));

