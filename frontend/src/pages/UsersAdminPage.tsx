/**
 * Страница админки пользователей
 * 
 * Предоставляет интерфейс для управления пользователями (только для ROOT):
 * - Список пользователей
 * - Создание пользователя
 * - Редактирование пользователя
 */

import React, { useState } from 'react';
import {
  Box,
  Typography,
  Alert,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import { StyledButton, CancelButton } from '@/components/common/FormStyles';
import { dialogPaperProps, dialogTitleStyles, dialogActionsStyles } from '@/components/common/DialogStyles';
import { LOADING_ICON_SIZE } from '@/components/common/Constants';
import AddIcon from '@mui/icons-material/Add';
import { useUsers, useDeleteUser } from '@/hooks/useUsers';
import { UserTable } from '@/components/UserTable';
import { CreateUserDialog } from '@/components/CreateUserDialog';
import { EditUserDialog } from '@/components/EditUserDialog';
import type { User } from '@/types';

/**
 * Страница админки пользователей
 * 
 * Требует ROOT роль. Frontend проверяет через RootRoute,
 * backend проверяет через middleware requireRoot.
 */
export function UsersAdminPage() {
  const { data: users, isLoading, error } = useUsers();
  const deleteUserMutation = useDeleteUser();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  const handleEdit = (user: User) => {
    setSelectedUser(user);
    setEditDialogOpen(true);
  };

  const handleCloseEditDialog = () => {
    setEditDialogOpen(false);
    setSelectedUser(null);
  };

  const handleDelete = (user: User) => {
    setSelectedUser(user);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (selectedUser) {
      deleteUserMutation.mutate(selectedUser.id, {
        onSuccess: () => {
          setDeleteDialogOpen(false);
          setSelectedUser(null);
        },
      });
    }
  };

  const handleCloseDeleteDialog = () => {
    setDeleteDialogOpen(false);
    setSelectedUser(null);
  };

  // Ошибка загрузки
  // ВАЖНО: Не показываем технические детали ошибок пользователю
  // Показываем только общее сообщение для безопасности
  const errorMessage = error ? 'Не удалось загрузить пользователей' : null;

  return (
    <Box sx={{ width: '100%' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Typography
          variant="h4"
          component="h1"
          sx={{
            color: '#f5f5f5',
            fontWeight: 500,
          }}
        >
          Управление пользователями
        </Typography>
        <StyledButton
          startIcon={<AddIcon />}
          onClick={() => setCreateDialogOpen(true)}
        >
          Создать пользователя
        </StyledButton>
      </Box>

      {errorMessage && (
        <Alert
          severity="error"
          sx={{
            mb: 3,
            borderRadius: '12px',
            backgroundColor: 'rgba(244, 67, 54, 0.1)',
            color: '#ffffff',
            border: 'none',
          }}
        >
          {errorMessage}
        </Alert>
      )}

      {isLoading ? (
        <Box display="flex" justifyContent="center" alignItems="center" minHeight={400}>
          <CircularProgress sx={{ color: '#f5f5f5' }} />
        </Box>
      ) : users ? (
        <UserTable users={users} isLoading={isLoading} onEdit={handleEdit} onDelete={handleDelete} />
      ) : (
        <Alert
          severity="info"
          sx={{
            borderRadius: '12px',
            backgroundColor: 'rgba(33, 150, 243, 0.1)',
            color: '#ffffff',
            border: 'none',
          }}
        >
          Не удалось загрузить пользователей
        </Alert>
      )}

      <CreateUserDialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} />
      <EditUserDialog
        open={editDialogOpen}
        user={selectedUser}
        onClose={handleCloseEditDialog}
      />

      {/* Диалог подтверждения удаления */}
      <Dialog
        open={deleteDialogOpen}
        onClose={handleCloseDeleteDialog}
        disableEnforceFocus
        PaperProps={dialogPaperProps}
      >
        <DialogTitle sx={{ color: '#f5f5f5' }}>Удаление пользователя</DialogTitle>
        <DialogContent>
          <Typography sx={{ color: 'rgba(255, 255, 255, 0.7)', mb: 2 }}>
            Вы уверены, что хотите удалить пользователя <strong>{selectedUser?.email}</strong>?
          </Typography>
          <Alert
            severity="warning"
            sx={{
              borderRadius: '12px',
              backgroundColor: 'rgba(255, 152, 0, 0.1)',
              color: '#ffffff',
              border: 'none',
            }}
          >
            Это действие нельзя отменить. Все данные пользователя (группы, клиенты, конфигурации) будут удалены.
          </Alert>
          {deleteUserMutation.error && (
            <Alert
              severity="error"
              sx={{
                mt: 2,
                borderRadius: '12px',
                backgroundColor: 'rgba(244, 67, 54, 0.1)',
                color: '#ffffff',
                border: 'none',
              }}
            >
              {deleteUserMutation.error instanceof Error
                ? deleteUserMutation.error.message
                : 'Не удалось удалить пользователя'}
            </Alert>
          )}
        </DialogContent>
        <DialogActions sx={dialogActionsStyles}>
          <CancelButton onClick={handleCloseDeleteDialog} disabled={deleteUserMutation.isPending}>
            Отмена
          </CancelButton>
          <StyledButton
            onClick={handleConfirmDelete}
            disabled={deleteUserMutation.isPending}
            sx={{
              backgroundColor: 'rgba(244, 67, 54, 0.2)',
              color: '#f44336',
              '&:hover': {
                backgroundColor: 'rgba(244, 67, 54, 0.3)',
              },
            }}
          >
            {deleteUserMutation.isPending ? (
              <CircularProgress size={LOADING_ICON_SIZE} sx={{ color: '#f44336' }} />
            ) : (
              'Удалить'
            )}
          </StyledButton>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

