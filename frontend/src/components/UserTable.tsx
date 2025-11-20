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
  IconButton,
  CircularProgress,
  Box,
  Typography,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import EditIcon from '@mui/icons-material/Edit';
import type { User } from '@/types';

/**
 * Стилизованный контейнер таблицы
 * 
 * Минималистичный дизайн без обводок и фона.
 */
const StyledTableContainer = styled(TableContainer)({
  borderRadius: '12px',
  backgroundColor: 'transparent',
});

/**
 * Стилизованная ячейка таблицы
 * 
 * Минималистичный дизайн с полупрозрачным фоном при наведении.
 */
const StyledTableCell = styled(TableCell)(({ theme }) => ({
  color: '#ffffff',
  borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
  padding: theme.spacing(2),
  '&.MuiTableCell-head': {
    color: 'rgba(255, 255, 255, 0.7)',
    fontWeight: 500,
    borderBottom: '1px solid rgba(255, 255, 255, 0.2)',
  },
}));

/**
 * Стилизованная строка таблицы
 * 
 * Плавное изменение фона при наведении.
 */
const StyledTableRow = styled(TableRow)({
  transition: 'background-color 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  '&:hover': {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  '&:last-child td': {
    borderBottom: 'none',
  },
});

/**
 * Стилизованная кнопка редактирования
 * 
 * Минималистичный дизайн с плавными переходами.
 */
const StyledIconButton = styled(IconButton)({
  color: 'rgba(255, 255, 255, 0.7)',
  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  '&:hover': {
    color: '#ffffff',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
});

/**
 * Стилизованный бейдж роли
 * 
 * Минималистичный дизайн без ярких цветов.
 */
const RoleBadge = styled(Box)(({ theme }) => ({
  display: 'inline-block',
  padding: theme.spacing(0.5, 1.5),
  borderRadius: '8px',
  fontSize: '0.75rem',
  fontWeight: 500,
  backgroundColor: 'rgba(255, 255, 255, 0.1)',
  color: '#ffffff',
}));

/**
 * Стилизованный бейдж статуса
 * 
 * Минималистичный дизайн с разными оттенками для активного/неактивного.
 */
const StatusBadge = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'active',
})<{ active?: boolean }>(({ theme, active }) => ({
  display: 'inline-block',
  padding: theme.spacing(0.5, 1.5),
  borderRadius: '8px',
  fontSize: '0.75rem',
  fontWeight: 500,
  backgroundColor: active
    ? 'rgba(76, 175, 80, 0.2)'
    : 'rgba(158, 158, 158, 0.2)',
  color: active ? '#4caf50' : 'rgba(255, 255, 255, 0.5)',
}));

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
        <Typography
          variant="body1"
          sx={{
            color: 'rgba(255, 255, 255, 0.5)',
          }}
        >
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
    <StyledTableContainer>
      <Table>
        <TableHead>
          <TableRow>
            <StyledTableCell>Email</StyledTableCell>
            <StyledTableCell>Имя</StyledTableCell>
            <StyledTableCell>Роль</StyledTableCell>
            <StyledTableCell align="center">Статус</StyledTableCell>
            <StyledTableCell>Создан</StyledTableCell>
            <StyledTableCell>Обновлен</StyledTableCell>
            <StyledTableCell align="center">Действия</StyledTableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {users.map((user) => (
            <StyledTableRow key={user.id}>
              <StyledTableCell>{user.email}</StyledTableCell>
              <StyledTableCell sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                {user.name || '-'}
              </StyledTableCell>
              <StyledTableCell>
                <RoleBadge>{user.role}</RoleBadge>
              </StyledTableCell>
              <StyledTableCell align="center">
                <StatusBadge active={user.isActive}>
                  {user.isActive ? 'Активен' : 'Неактивен'}
                </StatusBadge>
              </StyledTableCell>
              <StyledTableCell sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                {formatDate(user.createdAt)}
              </StyledTableCell>
              <StyledTableCell sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                {formatDate(user.updatedAt)}
              </StyledTableCell>
              <StyledTableCell align="center">
                {/* Не показываем кнопку редактирования для ROOT пользователей */}
                {user.role !== 'ROOT' && (
                  <StyledIconButton
                    size="small"
                    onClick={() => onEdit(user)}
                    aria-label="Редактировать"
                  >
                    <EditIcon fontSize="small" />
                  </StyledIconButton>
                )}
              </StyledTableCell>
            </StyledTableRow>
          ))}
        </TableBody>
      </Table>
    </StyledTableContainer>
  );
}

