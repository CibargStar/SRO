/**
 * Таблица аккаунтов мессенджеров профиля
 * 
 * Отображает список аккаунтов мессенджеров в виде MUI таблицы.
 * Предоставляет действия: включение/выключение, проверка статуса, удаление.
 */

import React, { useState } from 'react';
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
  Switch,
  Tooltip,
  Alert,
  Button,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import DeleteIcon from '@mui/icons-material/Delete';
import RefreshIcon from '@mui/icons-material/Refresh';
import AddIcon from '@mui/icons-material/Add';
import QrCodeIcon from '@mui/icons-material/QrCode';
import LockIcon from '@mui/icons-material/Lock';
import type { ProfileMessengerAccount } from '@/types';
import { MessengerAccountStatusChip } from './MessengerAccountStatusChip';
import { useEnableMessengerAccount, useDisableMessengerAccount, useDeleteMessengerAccount, useCheckMessengerAccountStatus } from '@/hooks/useMessengers';

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

interface MessengerAccountsTableProps {
  profileId: string;
  accounts: ProfileMessengerAccount[];
  isLoading?: boolean;
  isProfileRunning?: boolean; // Статус профиля - запущен ли
  onCreateAccount: () => void;
  onShowQRCode?: (account: ProfileMessengerAccount, qrCode: string, cloudPasswordRequired?: boolean) => void;
}

/**
 * Компонент таблицы аккаунтов мессенджеров
 */
export function MessengerAccountsTable({
  profileId,
  accounts,
  isLoading,
  isProfileRunning = true, // По умолчанию считаем запущенным
  onCreateAccount,
  onShowQRCode,
}: MessengerAccountsTableProps) {
  const [checkingAccountId, setCheckingAccountId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const enableMutation = useEnableMessengerAccount();
  const disableMutation = useDisableMessengerAccount();
  const deleteMutation = useDeleteMessengerAccount();
  const checkStatusMutation = useCheckMessengerAccountStatus();

  const handleToggleEnabled = async (account: ProfileMessengerAccount) => {
    setError(null);
    try {
      if (account.isEnabled) {
        await disableMutation.mutateAsync({ profileId, accountId: account.id });
      } else {
        await enableMutation.mutateAsync({ profileId, accountId: account.id });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка при изменении статуса');
    }
  };

  const handleCheckStatus = async (account: ProfileMessengerAccount) => {
    setError(null);
    setCheckingAccountId(account.id);
    try {
      const result = await checkStatusMutation.mutateAsync({ profileId, accountId: account.id });
      
      // Если требуется вход - показываем диалог
      if (result.status === 'NOT_LOGGED_IN' && onShowQRCode) {
        // Всегда показываем диалог - он сам загрузит QR или покажет форму пароля
        onShowQRCode(account, result.qrCode || '', result.cloudPasswordRequired);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка при проверке статуса');
    } finally {
      setCheckingAccountId(null);
    }
  };

  const handleDelete = async (account: ProfileMessengerAccount) => {
    if (!window.confirm(`Удалить аккаунт ${account.service.displayName}?`)) {
      return;
    }

    setError(null);
    try {
      await deleteMutation.mutateAsync({ profileId, accountId: account.id });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка при удалении');
    }
  };

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('ru-RU', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight={200}>
        <CircularProgress sx={{ color: '#f5f5f5' }} />
      </Box>
    );
  }

  return (
    <Box>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h6" sx={{ color: '#ffffff' }}>
          Аккаунты мессенджеров
        </Typography>
        <StyledIconButton onClick={onCreateAccount} aria-label="Добавить аккаунт" title="Добавить аккаунт мессенджера">
          <AddIcon />
        </StyledIconButton>
      </Box>

      {accounts.length === 0 ? (
        <Box display="flex" justifyContent="center" alignItems="center" minHeight={200}>
          <Typography variant="body1" sx={{ color: 'rgba(255, 255, 255, 0.5)' }}>
            Аккаунты мессенджеров не найдены. Добавьте аккаунт для мониторинга.
          </Typography>
        </Box>
      ) : (
        <StyledTableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <StyledTableCell>Мессенджер</StyledTableCell>
                <StyledTableCell align="center">Статус</StyledTableCell>
                <StyledTableCell align="center">Включен</StyledTableCell>
                <StyledTableCell>Последняя проверка</StyledTableCell>
                <StyledTableCell align="center" sx={{ width: '200px' }}>
                  Действия
                </StyledTableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {accounts.map((account) => {
                const isChecking = checkingAccountId === account.id;
                const isMutating = enableMutation.isPending || disableMutation.isPending || deleteMutation.isPending;

                return (
                  <StyledTableRow key={account.id}>
                    <StyledTableCell>
                      <Box display="flex" alignItems="center" gap={1}>
                        <Typography sx={{ color: '#ffffff', fontWeight: 500 }}>
                          {account.service.displayName}
                        </Typography>
                      </Box>
                    </StyledTableCell>
                    <StyledTableCell align="center">
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                        {isProfileRunning ? (
                          <>
                            <MessengerAccountStatusChip 
                              status={account.status} 
                              showTooltip 
                              cloudPasswordRequired={account.metadata?.cloudPasswordRequired as boolean}
                            />
                            {account.status === 'NOT_LOGGED_IN' && onShowQRCode && (
                              account.metadata?.cloudPasswordRequired ? (
                                // Кнопка для ввода облачного пароля
                                <Tooltip title="Ввести облачный пароль">
                                  <Button
                                    size="small"
                                    variant="outlined"
                                    startIcon={<LockIcon />}
                                    onClick={() => handleCheckStatus(account)}
                                    disabled={isChecking}
                                    sx={{
                                      color: '#ff9800',
                                      borderColor: '#ff9800',
                                      fontSize: '0.75rem',
                                      padding: '2px 8px',
                                      minWidth: 'auto',
                                      '&:hover': {
                                        borderColor: '#ffa726',
                                        backgroundColor: 'rgba(255, 152, 0, 0.1)',
                                      },
                                    }}
                                  >
                                    {isChecking ? <CircularProgress size={14} /> : 'Пароль'}
                                  </Button>
                                </Tooltip>
                              ) : (
                                // Кнопка для показа QR кода
                                <Tooltip title="Показать QR код для входа">
                                  <Button
                                    size="small"
                                    variant="outlined"
                                    startIcon={<QrCodeIcon />}
                                    onClick={() => handleCheckStatus(account)}
                                    disabled={isChecking}
                                    sx={{
                                      color: '#4caf50',
                                      borderColor: '#4caf50',
                                      fontSize: '0.75rem',
                                      padding: '2px 8px',
                                      minWidth: 'auto',
                                      '&:hover': {
                                        borderColor: '#66bb6a',
                                        backgroundColor: 'rgba(76, 175, 80, 0.1)',
                                      },
                                    }}
                                  >
                                    {isChecking ? <CircularProgress size={14} /> : 'QR'}
                                  </Button>
                                </Tooltip>
                              )
                            )}
                          </>
                        ) : (
                          // Профиль остановлен - статус не актуален
                          <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.4)', fontStyle: 'italic' }}>
                            Профиль остановлен
                          </Typography>
                        )}
                      </Box>
                    </StyledTableCell>
                    <StyledTableCell align="center">
                      <Switch
                        checked={account.isEnabled}
                        onChange={() => handleToggleEnabled(account)}
                        disabled={isMutating}
                        color="primary"
                      />
                    </StyledTableCell>
                    <StyledTableCell sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                      {formatDate(account.lastCheckedAt)}
                    </StyledTableCell>
                    <StyledTableCell align="center" sx={{ width: '200px' }}>
                      <Box display="flex" gap={1} justifyContent="center">
                        <Tooltip title="Проверить статус входа">
                          <StyledIconButton
                            size="small"
                            onClick={() => handleCheckStatus(account)}
                            disabled={isChecking || isMutating}
                            aria-label="Проверить статус"
                          >
                            {isChecking ? (
                              <CircularProgress size={16} sx={{ color: '#f5f5f5' }} />
                            ) : (
                              <RefreshIcon fontSize="small" />
                            )}
                          </StyledIconButton>
                        </Tooltip>
                        <Tooltip title="Удалить аккаунт">
                          <StyledIconButton
                            size="small"
                            onClick={() => handleDelete(account)}
                            disabled={isMutating}
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
                        </Tooltip>
                      </Box>
                    </StyledTableCell>
                  </StyledTableRow>
                );
              })}
            </TableBody>
          </Table>
        </StyledTableContainer>
      )}
    </Box>
  );
}


