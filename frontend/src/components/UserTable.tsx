/**
 * Таблица пользователей
 * 
 * Отображает список пользователей в виде MUI таблицы.
 * Предоставляет действия: редактирование.
 */

import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Chip,
  CircularProgress,
  Box,
  Typography,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import type { User } from '@/types';

interface UserTableProps {
  users: User[];
  isLoading?: boolean;
  onEdit: (user: User) => void;
}

/**
 * Компонент таблицы пользователей
 * 
 * @param users - Список пользователей для отображения
 * @param isLoading - Флаг загрузки
 * @param onEdit - Callback для редактирования пользователя
 */
export function UserTable({ users, isLoading, onEdit }: UserTableProps) {
  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight={200}>
        <CircularProgress />
      </Box>
    );
  }

  if (users.length === 0) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight={200}>
        <Typography variant="body1" color="text.secondary">
          Пользователи не найдены
        </Typography>
      </Box>
    );
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('ru-RU', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <TableContainer component={Paper}>
      <Table>
        <TableHead>
          <TableRow>
            <TableCell>Email</TableCell>
            <TableCell>Имя</TableCell>
            <TableCell>Роль</TableCell>
            <TableCell align="center">Статус</TableCell>
            <TableCell>Создан</TableCell>
            <TableCell>Обновлен</TableCell>
            <TableCell align="center">Действия</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {users.map((user) => (
            <TableRow key={user.id} hover>
              <TableCell>{user.email}</TableCell>
              <TableCell>{user.name || '-'}</TableCell>
              <TableCell>
                <Chip
                  label={user.role}
                  color={user.role === 'ROOT' ? 'primary' : 'default'}
                  size="small"
                />
              </TableCell>
              <TableCell align="center">
                <Chip
                  label={user.isActive ? 'Активен' : 'Неактивен'}
                  color={user.isActive ? 'success' : 'default'}
                  size="small"
                />
              </TableCell>
              <TableCell>{formatDate(user.createdAt)}</TableCell>
              <TableCell>{formatDate(user.updatedAt)}</TableCell>
              <TableCell align="center">
                {/* Не показываем кнопку редактирования для ROOT пользователей */}
                {user.role !== 'ROOT' && (
                  <IconButton
                    size="small"
                    onClick={() => onEdit(user)}
                    aria-label="Редактировать"
                  >
                    <EditIcon />
                  </IconButton>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

