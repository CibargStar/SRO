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
  Container,
  Box,
  Typography,
  Button,
  Paper,
  Alert,
  CircularProgress,
} from '@mui/material';
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
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          Управление пользователями
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setCreateDialogOpen(true)}
        >
          Создать пользователя
        </Button>
      </Box>

      {errorMessage && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {errorMessage}
        </Alert>
      )}

      <Paper sx={{ p: 2 }}>
        {isLoading ? (
          <Box display="flex" justifyContent="center" alignItems="center" minHeight={200}>
            <CircularProgress />
          </Box>
        ) : users ? (
          <UserTable users={users} isLoading={isLoading} onEdit={handleEdit} />
        ) : (
          <Alert severity="info">Не удалось загрузить пользователей</Alert>
        )}
      </Paper>

      <CreateUserDialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} />
      <EditUserDialog
        open={editDialogOpen}
        user={selectedUser}
        onClose={handleCloseEditDialog}
      />
    </Container>
  );
}

