/**
 * Страница управления группами клиентов
 * 
 * Предоставляет интерфейс для управления группами клиентов:
 * - Список групп
 * - Создание группы
 * - Редактирование группы
 * - Удаление группы
 */

import React, { useState } from 'react';
import {
  Box,
  Typography,
  Button,
  Alert,
  CircularProgress,
  Card,
  CardContent,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import { useClientGroups, useDeleteClientGroup } from '@/hooks/useClientGroups';
import { CreateClientGroupDialog } from '@/components/CreateClientGroupDialog';
import { EditClientGroupDialog } from '@/components/EditClientGroupDialog';
import type { ClientGroup } from '@/types';

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

const StyledCard = styled(Card)({
  backgroundColor: 'rgba(255, 255, 255, 0.05)',
  borderRadius: '12px',
  border: 'none',
  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  '&:hover': {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    transform: 'translateY(-2px)',
  },
});

const StyledIconButton = styled(IconButton)({
  color: 'rgba(255, 255, 255, 0.7)',
  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  '&:hover': {
    color: '#ffffff',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
});

const CancelButton = styled(Button)(({ theme }) => ({
  borderRadius: '12px',
  backgroundColor: 'transparent',
  color: 'rgba(255, 255, 255, 0.7)',
  textTransform: 'none',
  padding: theme.spacing(1.5, 3),
  '&:hover': { backgroundColor: 'rgba(255, 255, 255, 0.1)', color: '#ffffff' },
}));

export function ClientGroupsPage() {
  const { data: groups = [], isLoading, error } = useClientGroups();
  const deleteMutation = useDeleteClientGroup();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<ClientGroup | null>(null);

  const handleEdit = (group: ClientGroup) => {
    setSelectedGroup(group);
    setEditDialogOpen(true);
  };

  const handleDelete = (group: ClientGroup) => {
    setSelectedGroup(group);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (selectedGroup) {
      deleteMutation.mutate(selectedGroup.id, {
        onSuccess: () => {
          setDeleteDialogOpen(false);
          setSelectedGroup(null);
        },
      });
    }
  };

  const handleCloseEditDialog = () => {
    setEditDialogOpen(false);
    setSelectedGroup(null);
  };

  const handleCloseDeleteDialog = () => {
    setDeleteDialogOpen(false);
    setSelectedGroup(null);
  };

  const errorMessage = error ? 'Не удалось загрузить группы' : null;

  return (
    <Box sx={{ width: '100%' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Typography variant="h4" component="h1" sx={{ color: '#f5f5f5', fontWeight: 500 }}>
          Управление группами клиентов
        </Typography>
        <StyledButton startIcon={<AddIcon />} onClick={() => setCreateDialogOpen(true)}>
          Создать группу
        </StyledButton>
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
      ) : groups.length === 0 ? (
        <Alert severity="info" sx={{ borderRadius: '12px', backgroundColor: 'rgba(33, 150, 243, 0.1)', color: '#ffffff', border: 'none' }}>
          Группы не найдены. Создайте первую группу.
        </Alert>
      ) : (
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 2 }}>
          {groups.map((group) => (
            <StyledCard key={group.id}>
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
                    <StyledIconButton size="small" onClick={() => handleEdit(group)}>
                      <EditIcon fontSize="small" />
                    </StyledIconButton>
                    <StyledIconButton size="small" onClick={() => handleDelete(group)}>
                      <DeleteIcon fontSize="small" />
                    </StyledIconButton>
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
            </StyledCard>
          ))}
        </Box>
      )}

      <CreateClientGroupDialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} />
      <EditClientGroupDialog open={editDialogOpen} group={selectedGroup} onClose={handleCloseEditDialog} />

      {/* Диалог подтверждения удаления */}
      <Dialog
        open={deleteDialogOpen}
        onClose={handleCloseDeleteDialog}
        PaperProps={{ sx: { backgroundColor: '#212121', borderRadius: '12px' } }}
      >
        <DialogTitle sx={{ color: '#f5f5f5' }}>Подтверждение удаления</DialogTitle>
        <DialogContent>
          <Typography sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
            Вы уверены, что хотите удалить группу "{selectedGroup?.name}"?
            Клиенты из этой группы останутся, но их группа будет сброшена.
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

