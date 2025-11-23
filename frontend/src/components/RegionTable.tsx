/**
 * Таблица регионов
 * 
 * Отображает список регионов в виде MUI таблицы.
 * Предоставляет действия: редактирование и удаление.
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
import type { Region } from '@/types';

/**
 * Стилизованный контейнер таблицы
 */
const StyledTableContainer = styled(TableContainer)({
  borderRadius: '12px',
  backgroundColor: 'transparent',
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
 * Стилизованный бейдж количества клиентов
 */
const CountBadge = styled(Chip)(({ theme }) => ({
  backgroundColor: 'rgba(33, 150, 243, 0.2)',
  color: '#2196f3',
  fontSize: '0.75rem',
  fontWeight: 500,
  height: 24,
  '& .MuiChip-label': {
    padding: theme.spacing(0, 1),
  },
}));

/**
 * Props для компонента RegionTable
 */
interface RegionTableProps {
  regions: Region[];
  isLoading?: boolean;
  onEdit: (region: Region) => void;
  onDelete: (region: Region) => void;
}

/**
 * Компонент таблицы регионов
 * 
 * Отображает список регионов с возможностью редактирования и удаления.
 * Показывает общее количество клиентов в регионе и количество для выбранного пользователя (если указано).
 */
export function RegionTable({
  regions,
  isLoading = false,
  onEdit,
  onDelete,
}: RegionTableProps) {
  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight={200}>
        <CircularProgress sx={{ color: '#f5f5f5' }} />
      </Box>
    );
  }

  if (regions.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <Typography variant="body1" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
          Регионы не найдены. Создайте первый регион.
        </Typography>
      </Box>
    );
  }

  return (
    <StyledTableContainer>
      <Table>
        <TableHead>
          <TableRow>
            <StyledTableCell>Название</StyledTableCell>
            <StyledTableCell align="center">Всего клиентов</StyledTableCell>
            <StyledTableCell align="center">Дата создания</StyledTableCell>
            <StyledTableCell align="center">Действия</StyledTableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {regions.map((region) => {
            const totalClients = region._count?.clients || 0;
            const canDelete = totalClients === 0;

            return (
              <StyledTableRow key={region.id}>
                <StyledTableCell>
                  <Typography variant="body1" sx={{ color: '#ffffff', fontWeight: 500 }}>
                    {region.name}
                  </Typography>
                </StyledTableCell>
                <StyledTableCell align="center">
                  <CountBadge label={totalClients} />
                </StyledTableCell>
                <StyledTableCell align="center">
                  <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                    {new Date(region.createdAt).toLocaleDateString('ru-RU')}
                  </Typography>
                </StyledTableCell>
                <StyledTableCell align="center">
                  <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1 }}>
                    <StyledIconButton
                      onClick={() => onEdit(region)}
                      title="Редактировать регион"
                    >
                      <EditIcon />
                    </StyledIconButton>
                    <IconButton
                      size="small"
                      onClick={() => onDelete(region)}
                      disabled={!canDelete}
                      title={canDelete ? 'Удалить регион' : 'Нельзя удалить регион с клиентами'}
                      sx={{
                        color: canDelete ? 'rgba(244, 67, 54, 0.7)' : 'rgba(255, 255, 255, 0.3)',
                        cursor: canDelete ? 'pointer' : 'not-allowed',
                        '&:hover': canDelete
                          ? {
                              color: '#f44336',
                              backgroundColor: 'rgba(244, 67, 54, 0.1)',
                            }
                          : {
                              color: 'rgba(255, 255, 255, 0.3)',
                              backgroundColor: 'transparent',
                            },
                      }}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Box>
                </StyledTableCell>
              </StyledTableRow>
            );
          })}
        </TableBody>
      </Table>
    </StyledTableContainer>
  );
}

