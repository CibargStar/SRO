/**
 * Диалог отображения QR кода или формы облачного пароля для входа в мессенджер
 * 
 * Отображает:
 * - QR код для сканирования (WhatsApp, Telegram)
 * - Форму ввода облачного пароля (Telegram 2FA)
 * 
 * ВКЛЮЧАЕТ автообновление статуса и индикатор загрузки.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogActions,
  Box,
  Typography,
  Button,
  Alert,
  CircularProgress,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import LockIcon from '@mui/icons-material/Lock';
import { dialogPaperProps, dialogTitleStyles, dialogActionsStyles } from './common/DialogStyles';
import { StyledButton, StyledTextField } from './common/FormStyles';
import type { ProfileMessengerAccount } from '@/types';

interface MessengerQRCodeDialogProps {
  open: boolean;
  onClose: () => void;
  account: ProfileMessengerAccount | null;
  qrCode: string; // Base64 изображение
  cloudPasswordRequired?: boolean;
  onCloudPasswordSubmit?: (password: string) => Promise<void>;
  onRefreshStatus?: () => Promise<{ status: string; qrCode?: string; cloudPasswordRequired?: boolean }>; // Callback для обновления статуса
  refreshIntervalMs?: number; // Интервал автообновления (по умолчанию 15 сек)
}

/**
 * Компонент диалога с QR кодом
 */
export function MessengerQRCodeDialog({
  open,
  onClose,
  account,
  qrCode: initialQrCode,
  cloudPasswordRequired: initialCloudPasswordRequired = false,
  onCloudPasswordSubmit,
  onRefreshStatus,
  refreshIntervalMs = 15000, // 15 секунд по умолчанию
}: MessengerQRCodeDialogProps) {
  const [cloudPassword, setCloudPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState(initialQrCode);
  const [needsCloudPassword, setNeedsCloudPassword] = useState(initialCloudPasswordRequired);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [timeUntilRefresh, setTimeUntilRefresh] = useState(refreshIntervalMs / 1000);

  // Обновление состояния при изменении props
  useEffect(() => {
    setQrCode(initialQrCode);
  }, [initialQrCode]);

  // Обновление cloudPasswordRequired при изменении props
  useEffect(() => {
    setNeedsCloudPassword(initialCloudPasswordRequired);
  }, [initialCloudPasswordRequired]);

  // Функция обновления статуса
  const refreshStatus = useCallback(async () => {
    if (!onRefreshStatus || isRefreshing) return;

    setIsRefreshing(true);
    setError(null);

    try {
      const result = await onRefreshStatus();
      
      if (result.status === 'LOGGED_IN') {
        setIsLoggedIn(true);
        setNeedsCloudPassword(false);
        // Автозакрытие через 2 секунды после успешного входа
        setTimeout(() => {
          onClose();
        }, 2000);
      } else {
        // Обновляем состояние cloudPasswordRequired
        if (result.cloudPasswordRequired !== undefined) {
          setNeedsCloudPassword(result.cloudPasswordRequired);
        }
        // Обновляем QR код если есть
        if (result.qrCode) {
          setQrCode(result.qrCode);
        }
      }
      
      setTimeUntilRefresh(refreshIntervalMs / 1000);
    } catch (err) {
      setError('Ошибка при обновлении статуса');
    } finally {
      setIsRefreshing(false);
    }
  }, [onRefreshStatus, isRefreshing, onClose, refreshIntervalMs]);

  // Автообновление статуса
  useEffect(() => {
    if (!open || !onRefreshStatus || isLoggedIn) return;

    const intervalId = setInterval(() => {
      refreshStatus();
    }, refreshIntervalMs);

    // Таймер обратного отсчёта
    const countdownId = setInterval(() => {
      setTimeUntilRefresh((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => {
      clearInterval(intervalId);
      clearInterval(countdownId);
    };
  }, [open, onRefreshStatus, refreshIntervalMs, refreshStatus, isLoggedIn]);

  // Сброс состояния при открытии
  useEffect(() => {
    if (open) {
      setIsLoggedIn(false);
      setTimeUntilRefresh(refreshIntervalMs / 1000);
      setQrCode(initialQrCode);
      setNeedsCloudPassword(initialCloudPasswordRequired);
      setCloudPassword('');
      setError(null);

      // Если QR код пустой и не требуется пароль - запросим статус сразу
      if (!initialQrCode && !initialCloudPasswordRequired && onRefreshStatus) {
        // Небольшая задержка чтобы диалог успел открыться
        setTimeout(() => {
          refreshStatus();
        }, 500);
      }
    }
  }, [open, refreshIntervalMs, initialQrCode, initialCloudPasswordRequired, onRefreshStatus, refreshStatus]);

  const handleSubmitPassword = async () => {
    if (!cloudPassword.trim()) {
      setError('Введите облачный пароль');
      return;
    }

    if (!onCloudPasswordSubmit) {
      return;
    }

    setError(null);
    setIsSubmitting(true);
    try {
      await onCloudPasswordSubmit(cloudPassword);
      setCloudPassword('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка при отправке пароля');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setCloudPassword('');
    setError(null);
    setIsLoggedIn(false);
    onClose();
  };

  if (!account) {
    return null;
  }

  // Определяем, что показывать: форму пароля или QR код
  const showPasswordForm = needsCloudPassword && !isLoggedIn;
  const showQRCode = !needsCloudPassword && !isLoggedIn;

  return (
    <Dialog open={open} onClose={handleClose} PaperProps={dialogPaperProps} maxWidth="sm" fullWidth>
      <Box sx={dialogTitleStyles}>
        <Typography variant="h6">
          {needsCloudPassword ? 'Облачный пароль' : 'Вход в'} {account.service.displayName}
        </Typography>
      </Box>

      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, py: 2 }}>
          {isLoggedIn ? (
            // Успешный вход
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, py: 4 }}>
              <CheckCircleIcon sx={{ fontSize: 80, color: '#4caf50' }} />
              <Typography variant="h6" sx={{ color: '#4caf50', textAlign: 'center' }}>
                Вход выполнен успешно!
              </Typography>
              <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)', textAlign: 'center' }}>
                Диалог закроется автоматически...
              </Typography>
            </Box>
          ) : showPasswordForm ? (
            // Форма облачного пароля (Telegram 2FA)
            <Box sx={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
              <Box sx={{ 
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'center', 
                gap: 2,
                p: 3,
                backgroundColor: 'rgba(255, 152, 0, 0.1)',
                borderRadius: 2,
                border: '1px solid rgba(255, 152, 0, 0.3)',
              }}>
                <LockIcon sx={{ fontSize: 60, color: '#ff9800' }} />
                <Typography variant="h6" sx={{ color: '#ff9800', textAlign: 'center' }}>
                  Требуется облачный пароль
                </Typography>
                <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)', textAlign: 'center' }}>
                  У вашего аккаунта Telegram включена двухфакторная аутентификация.
                  Введите облачный пароль для завершения входа.
                </Typography>
              </Box>

              <StyledTextField
                fullWidth
                type="password"
                label="Облачный пароль"
                value={cloudPassword}
                onChange={(e) => setCloudPassword(e.target.value)}
                disabled={isSubmitting}
                autoFocus
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleSubmitPassword();
                  }
                }}
              />

              <Button
                variant="contained"
                onClick={handleSubmitPassword}
                disabled={!cloudPassword.trim() || isSubmitting}
                fullWidth
                sx={{
                  backgroundColor: '#ff9800',
                  color: '#ffffff',
                  py: 1.5,
                  '&:hover': {
                    backgroundColor: '#f57c00',
                  },
                  '&:disabled': {
                    backgroundColor: 'rgba(255, 255, 255, 0.1)',
                    color: 'rgba(255, 255, 255, 0.3)',
                  },
                }}
              >
                {isSubmitting ? (
                  <>
                    <CircularProgress size={20} sx={{ color: '#ffffff', mr: 1 }} />
                    Проверка...
                  </>
                ) : (
                  'Войти'
                )}
              </Button>

              {/* Кнопка обновления статуса */}
              {onRefreshStatus && (
                <Button
                  size="small"
                  onClick={refreshStatus}
                  disabled={isRefreshing}
                  startIcon={isRefreshing ? <CircularProgress size={16} /> : <RefreshIcon />}
                  sx={{
                    color: 'rgba(255, 255, 255, 0.5)',
                    '&:hover': { color: '#ffffff' },
                  }}
                >
                  Обновить статус
                </Button>
              )}
            </Box>
          ) : showQRCode ? (
            // QR код для сканирования
            <>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="body1" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                  Отсканируйте QR код в приложении {account.service.displayName} для входа
                </Typography>
                {onRefreshStatus && (
                  <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.5)', display: 'block', mt: 0.5 }}>
                    Статус проверяется автоматически. После сканирования окно закроется.
                  </Typography>
                )}
              </Box>

              <Box
                sx={{
                  width: '100%',
                  maxWidth: 300,
                  height: 300,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: '#ffffff',
                  borderRadius: 2,
                  padding: 2,
                  position: 'relative',
                }}
              >
                {isRefreshing && (
                  <Box
                    sx={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: 'rgba(255, 255, 255, 0.8)',
                      borderRadius: 2,
                      zIndex: 1,
                    }}
                  >
                    <CircularProgress size={40} />
                  </Box>
                )}
                {qrCode ? (
                  <img
                    src={qrCode.startsWith('data:') ? qrCode : `data:image/png;base64,${qrCode}`}
                    alt="QR код для входа"
                    style={{
                      maxWidth: '100%',
                      maxHeight: '100%',
                      objectFit: 'contain',
                    }}
                  />
                ) : (
                  <Box sx={{ textAlign: 'center' }}>
                    <CircularProgress size={40} sx={{ mb: 2 }} />
                    <Typography variant="body2" color="text.secondary">
                      Загрузка QR кода...
                    </Typography>
                  </Box>
                )}
              </Box>

              {/* Информация об автообновлении и кнопка ручного обновления */}
              {onRefreshStatus && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%', justifyContent: 'center' }}>
                  <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.5)' }}>
                    Автообновление через {timeUntilRefresh} сек
                  </Typography>
                  <Button
                    size="small"
                    onClick={refreshStatus}
                    disabled={isRefreshing}
                    startIcon={isRefreshing ? <CircularProgress size={16} /> : <RefreshIcon />}
                    sx={{
                      color: 'rgba(255, 255, 255, 0.7)',
                      '&:hover': { color: '#ffffff' },
                    }}
                  >
                    Обновить
                  </Button>
                </Box>
              )}
            </>
          ) : null}
        </Box>
      </DialogContent>

      <DialogActions sx={dialogActionsStyles}>
        <StyledButton onClick={handleClose} variant="outlined">
          Закрыть
        </StyledButton>
      </DialogActions>
    </Dialog>
  );
}


