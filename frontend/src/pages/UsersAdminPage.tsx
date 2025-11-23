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
  Button,
  Alert,
  CircularProgress,
} from '@mui/material';
import { StyledButton } from '@/components/common/FormStyles';
import AddIcon from '@mui/icons-material/Add';
import { useUsers } from '@/hooks/useUsers';
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
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  const handleEdit = (user: User) => {
    setSelectedUser(user);
    setEditDialogOpen(true);
  };

  const handleCloseEditDialog = () => {
    setEditDialogOpen(false);
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
        <UserTable users={users} isLoading={isLoading} onEdit={handleEdit} />
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
    </Box>
  );
}

