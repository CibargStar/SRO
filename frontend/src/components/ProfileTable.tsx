/**
 * Таблица профилей
 * 
 * Отображает список профилей Chrome в виде MUI таблицы.
 * Предоставляет действия: редактирование, удаление, запуск/остановка.
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
import DeleteIcon from '@mui/icons-material/Delete';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import StopIcon from '@mui/icons-material/Stop';
import InfoIcon from '@mui/icons-material/Info';
import MessageIcon from '@mui/icons-material/Message';
import type { Profile } from '@/types';
import { ProfileStatusChip } from './ProfileStatusChip';

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

interface ProfileTableProps {
  profiles: Profile[];
  isLoading?: boolean;
  onEdit: (profile: Profile) => void;
  onDelete: (profile: Profile) => void;
  onStart: (profile: Profile) => void;
  onStop: (profile: Profile) => void;
  onDetails: (profile: Profile) => void;
  onMessengers?: (profile: Profile) => void; // Обработчик открытия диалога мессенджеров
  messengerAccountsCounts?: Record<string, number>; // Количество аккаунтов мессенджеров для каждого профиля
  isStarting?: string | null; // ID профиля, который сейчас запускается
  isStopping?: string | null; // ID профиля, который сейчас останавливается
}

/**
 * Компонент таблицы профилей
 */
export function ProfileTable({
  profiles,
  isLoading,
  onEdit,
  onDelete,
  onStart,
  onStop,
  onDetails,
  onMessengers,
  messengerAccountsCounts = {},
  isStarting,
  isStopping,
}: ProfileTableProps) {
  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight={200}>
        <CircularProgress sx={{ color: '#f5f5f5' }} />
      </Box>
    );
  }

  if (profiles.length === 0) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight={200}>
        <Typography
          variant="body1"
          sx={{
            color: 'rgba(255, 255, 255, 0.5)',
          }}
        >
          Профили не найдены
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
            <StyledTableCell>Название</StyledTableCell>
            <StyledTableCell>Описание</StyledTableCell>
            <StyledTableCell align="center">Статус</StyledTableCell>
            <StyledTableCell align="center">Режим</StyledTableCell>
            <StyledTableCell align="center">Мессенджеры</StyledTableCell>
            <StyledTableCell>Последняя активность</StyledTableCell>
            <StyledTableCell>Создан</StyledTableCell>
            <StyledTableCell align="center" sx={{ width: '250px' }}>
              Действия
            </StyledTableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {profiles.map((profile) => {
            const isProfileStarting = isStarting === profile.id;
            const isProfileStopping = isStopping === profile.id;
            const canStart = profile.status === 'STOPPED' || profile.status === 'ERROR';
            const canStop = profile.status === 'RUNNING';

            return (
              <StyledTableRow key={profile.id}>
                <StyledTableCell>{profile.name}</StyledTableCell>
                <StyledTableCell sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                  {profile.description || '-'}
                </StyledTableCell>
                <StyledTableCell align="center">
                  <ProfileStatusChip status={profile.status} />
                </StyledTableCell>
                <StyledTableCell align="center" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                  {profile.headless === true ? 'Без UI' : profile.headless === false ? 'С UI' : 'Без UI'}
                </StyledTableCell>
                <StyledTableCell align="center">
                  {messengerAccountsCounts[profile.id] !== undefined ? (
                    <Box
                      sx={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 0.5,
                        padding: '4px 8px',
                        borderRadius: '12px',
                        backgroundColor: messengerAccountsCounts[profile.id] > 0 
                          ? 'rgba(33, 150, 243, 0.2)' 
                          : 'rgba(255, 255, 255, 0.05)',
                        color: messengerAccountsCounts[profile.id] > 0 
                          ? '#2196f3' 
                          : 'rgba(255, 255, 255, 0.5)',
                      }}
                    >
                      <MessageIcon sx={{ fontSize: 16 }} />
                      <Typography variant="caption" sx={{ fontWeight: 500 }}>
                        {messengerAccountsCounts[profile.id]}
                      </Typography>
                    </Box>
                  ) : (
                    <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.3)' }}>
                      -
                    </Typography>
                  )}
                </StyledTableCell>
                <StyledTableCell sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                  {profile.lastActiveAt ? formatDate(profile.lastActiveAt) : '-'}
                </StyledTableCell>
                <StyledTableCell sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                  {formatDate(profile.createdAt)}
                </StyledTableCell>
                <StyledTableCell align="center" sx={{ width: '250px' }}>
                  <Box display="flex" gap={1} justifyContent="center">
                    <StyledIconButton
                      size="small"
                      onClick={() => onDetails(profile)}
                      aria-label="Детали"
                      title="Детали профиля"
                    >
                      <InfoIcon fontSize="small" />
                    </StyledIconButton>
                    {onMessengers && (
                      <StyledIconButton
                        size="small"
                        onClick={() => onMessengers(profile)}
                        aria-label="Мессенджеры"
                        title="Управление мессенджерами"
                        sx={{
                          color: messengerAccountsCounts[profile.id] > 0 
                            ? 'rgba(33, 150, 243, 0.7)' 
                            : 'rgba(255, 255, 255, 0.7)',
                          '&:hover': {
                            color: '#2196f3',
                            backgroundColor: 'rgba(33, 150, 243, 0.1)',
                          },
                        }}
                      >
                        <MessageIcon fontSize="small" />
                      </StyledIconButton>
                    )}
                    {canStart && (
                      <StyledIconButton
                        size="small"
                        onClick={() => onStart(profile)}
                        disabled={isProfileStarting}
                        aria-label="Запустить"
                        title="Запустить профиль"
                        sx={{
                          color: 'rgba(76, 175, 80, 0.7)',
                          '&:hover': {
                            color: '#4caf50',
                            backgroundColor: 'rgba(76, 175, 80, 0.1)',
                          },
                        }}
                      >
                        {isProfileStarting ? (
                          <CircularProgress size={16} sx={{ color: '#4caf50' }} />
                        ) : (
                          <PlayArrowIcon fontSize="small" />
                        )}
                      </StyledIconButton>
                    )}
                    {canStop && (
                      <StyledIconButton
                        size="small"
                        onClick={() => onStop(profile)}
                        disabled={isProfileStopping}
                        aria-label="Остановить"
                        title="Остановить профиль"
                        sx={{
                          color: 'rgba(255, 152, 0, 0.7)',
                          '&:hover': {
                            color: '#ff9800',
                            backgroundColor: 'rgba(255, 152, 0, 0.1)',
                          },
                        }}
                      >
                        {isProfileStopping ? (
                          <CircularProgress size={16} sx={{ color: '#ff9800' }} />
                        ) : (
                          <StopIcon fontSize="small" />
                        )}
                      </StyledIconButton>
                    )}
                    <StyledIconButton
                      size="small"
                      onClick={() => onEdit(profile)}
                      aria-label="Редактировать"
                      title="Редактировать профиль"
                    >
                      <EditIcon fontSize="small" />
                    </StyledIconButton>
                    <StyledIconButton
                      size="small"
                      onClick={() => onDelete(profile)}
                      aria-label="Удалить"
                      title="Удалить профиль"
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

