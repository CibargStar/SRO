/**
 * Таблица клиентов
 * 
 * Отображает список клиентов в виде MUI таблицы.
 * Предоставляет действия: редактирование, удаление.
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
  Chip,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import type { Client } from '@/types';
import { formatClientName } from '@/utils';
import { PhoneChips } from './PhoneChips';

/**
 * Стилизованный контейнер таблицы
 */
const StyledTableContainer = styled(TableContainer)({
  borderRadius: '12px',
  backgroundColor: 'transparent',
  '&::-webkit-scrollbar': {
    display: 'none',
    width: 0,
    height: 0,
  },
  scrollbarWidth: 'none',
  msOverflowStyle: 'none',
});

/**
 * Стилизованная ячейка таблицы
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
 * Стилизованная кнопка действия
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
 * Стилизованный бейдж статуса
 */
const StatusChip = styled(Chip)<{ status: 'NEW' | 'OLD' }>(({ status }) => ({
  fontSize: '0.75rem',
  fontWeight: 500,
  backgroundColor: status === 'NEW' ? 'rgba(76, 175, 80, 0.2)' : 'rgba(158, 158, 158, 0.2)',
  color: status === 'NEW' ? '#4caf50' : 'rgba(255, 255, 255, 0.5)',
  border: 'none',
}));

interface ClientTableProps {
  clients: Client[];
  isLoading?: boolean;
  onEdit: (client: Client) => void;
  onDelete: (client: Client) => void;
}

/**
 * Компонент таблицы клиентов
 * 
 * @param clients - Список клиентов для отображения
 * @param isLoading - Флаг загрузки
 * @param onEdit - Callback для редактирования клиента
 * @param onDelete - Callback для удаления клиента
 */
export function ClientTable({ clients, isLoading, onEdit, onDelete }: ClientTableProps) {
  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight={200}>
        <CircularProgress sx={{ color: '#f5f5f5' }} />
      </Box>
    );
  }

  if (clients.length === 0) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight={200}>
        <Typography
          variant="body1"
          sx={{
            color: 'rgba(255, 255, 255, 0.5)',
          }}
        >
          Клиенты не найдены
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
            <StyledTableCell sx={{ width: '18%' }}>ФИО</StyledTableCell>
            <StyledTableCell sx={{ padding: 'calc(16px * 0.85)' }}>Регион</StyledTableCell>
            <StyledTableCell sx={{ padding: 'calc(16px * 0.85)' }}>Группа</StyledTableCell>
            <StyledTableCell align="center" sx={{ width: '100px', padding: 'calc(16px * 0.85)' }}>Статус</StyledTableCell>
            <StyledTableCell sx={{ width: '28%', minWidth: '300px' }}>Телефоны</StyledTableCell>
            <StyledTableCell align="center" sx={{ width: '90px' }}>Кампаний</StyledTableCell>
            <StyledTableCell sx={{ width: '170px' }}>Последняя рассылка</StyledTableCell>
            <StyledTableCell>Создан</StyledTableCell>
            <StyledTableCell align="center" sx={{ width: '120px' }}>Действия</StyledTableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {clients.map((client) => (
            <StyledTableRow key={client.id}>
              <StyledTableCell sx={{ width: '18%' }}>{formatClientName(client)}</StyledTableCell>
              <StyledTableCell sx={{ color: 'rgba(255, 255, 255, 0.7)', padding: 'calc(16px * 0.85)' }}>
                {client.region?.name || '-'}
              </StyledTableCell>
              <StyledTableCell sx={{ color: 'rgba(255, 255, 255, 0.7)', padding: 'calc(16px * 0.85)' }}>
                {client.group?.name || '-'}
              </StyledTableCell>
              <StyledTableCell align="center" sx={{ width: '100px', padding: 'calc(16px * 0.85)' }}>
                <StatusChip label={client.status === 'NEW' ? 'Новый' : 'Старый'} status={client.status} size="small" />
              </StyledTableCell>
              <StyledTableCell sx={{ width: '28%', minWidth: '300px' }}>
                <PhoneChips phones={client.phones || []} />
              </StyledTableCell>
              <StyledTableCell align="center" sx={{ color: 'rgba(255, 255, 255, 0.85)' }}>
                {client.campaignCount ?? 0}
              </StyledTableCell>
              <StyledTableCell sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                {client.lastCampaignAt ? formatDate(client.lastCampaignAt) : '—'}
              </StyledTableCell>
              <StyledTableCell sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                {formatDate(client.createdAt)}
              </StyledTableCell>
              <StyledTableCell align="center" sx={{ width: '120px' }}>
                <StyledIconButton size="small" onClick={() => onEdit(client)} aria-label="Редактировать">
                  <EditIcon fontSize="small" />
                </StyledIconButton>
                <StyledIconButton
                  size="small"
                  onClick={() => onDelete(client)}
                  aria-label="Удалить"
                  sx={{
                    color: 'rgba(244, 67, 54, 0.7)',
                    '&:hover': {
                      color: '#f44336',
                      backgroundColor: 'rgba(244, 67, 54, 0.1)',
                    },
                  }}
                >
                  <DeleteIcon fontSize="small" />
                </StyledIconButton>
              </StyledTableCell>
            </StyledTableRow>
          ))}
        </TableBody>
      </Table>
    </StyledTableContainer>
  );
}

