/**
 * Диалог управления аккаунтами мессенджеров профиля
 * 
 * Отдельный диалог для управления мессенджерами, вынесенный из ProfileDetailsDialog.
 * Включает автообновление QR кода и автозакрытие при успешном входе.
 */

import React, { useState, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogActions,
  Box,
  Typography,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import { dialogPaperProps, dialogTitleStyles, dialogActionsStyles } from './common/DialogStyles';
import { StyledButton } from './common/FormStyles';
import { MessengerAccountsTable } from './MessengerAccountsTable';
import { CreateMessengerAccountDialog } from './CreateMessengerAccountDialog';
import { MessengerQRCodeDialog } from './MessengerQRCodeDialog';
import { useMessengerAccounts, useCheckMessengerAccountStatus, useSubmitCloudPassword } from '@/hooks/useMessengers';
import type { ProfileMessengerAccount } from '@/types';

interface MessengerAccountsDialogProps {
  open: boolean;
  onClose: () => void;
  profileId: string | null;
  isProfileRunning?: boolean; // Запущен ли профиль
}

export function MessengerAccountsDialog({ open, onClose, profileId, isProfileRunning = false }: MessengerAccountsDialogProps) {
  const [createAccountDialogOpen, setCreateAccountDialogOpen] = useState(false);
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [qrAccount, setQrAccount] = useState<ProfileMessengerAccount | null>(null);
  const [qrCode, setQrCode] = useState<string>('');
  const [qrCloudPasswordRequired, setQrCloudPasswordRequired] = useState(false);

  const { data: messengerAccounts, isLoading: messengerAccountsLoading, refetch } = useMessengerAccounts(profileId || '', {
    enabled: !!profileId && open,
  });

  const checkStatusMutation = useCheckMessengerAccountStatus();
  const cloudPasswordMutation = useSubmitCloudPassword();

  const handleCreateAccount = () => {
    setCreateAccountDialogOpen(true);
  };

  const handleShowQRCode = (account: ProfileMessengerAccount, qrCodeData: string, cloudPasswordRequired?: boolean) => {
    setQrAccount(account);
    setQrCode(qrCodeData);
    setQrCloudPasswordRequired(cloudPasswordRequired || false);
    setQrDialogOpen(true);
  };

  // Функция для обновления статуса (вызывается из MessengerQRCodeDialog)
  const handleRefreshStatus = useCallback(async (): Promise<{ status: string; qrCode?: string; cloudPasswordRequired?: boolean }> => {
    if (!profileId || !qrAccount) {
      return { status: 'ERROR' };
    }

    try {
      const result = await checkStatusMutation.mutateAsync({
        profileId,
        accountId: qrAccount.id,
      });

      // Если пользователь вошёл - обновляем список аккаунтов
      if (result.status === 'LOGGED_IN') {
        refetch();
      }

      // Обновляем cloudPasswordRequired если изменилось
      if (result.cloudPasswordRequired !== undefined) {
        setQrCloudPasswordRequired(result.cloudPasswordRequired);
      }

      return {
        status: result.status,
        qrCode: result.qrCode,
        cloudPasswordRequired: result.cloudPasswordRequired,
      };
    } catch (error) {
      // Логирование ошибок всегда актуально
      console.error('Error refreshing status:', error);
      return { status: 'ERROR' };
    }
  }, [profileId, qrAccount, checkStatusMutation, refetch]);

  // Функция для ввода облачного пароля (2FA) для Telegram
  const handleCloudPasswordSubmit = useCallback(async (password: string): Promise<void> => {
    if (!profileId || !qrAccount) {
      throw new Error('No profile or account selected');
    }

    const result = await cloudPasswordMutation.mutateAsync({
      profileId,
      accountId: qrAccount.id,
      password,
    });

    if (!result.success) {
      throw new Error(result.error || 'Не удалось ввести пароль');
    }

    // Если успешно - обновляем статус
    if (result.status === 'LOGGED_IN') {
      refetch();
    }
  }, [profileId, qrAccount, cloudPasswordMutation, refetch]);

  // Закрытие QR диалога при успешном входе
  const handleCloseQRDialog = useCallback(() => {
    setQrDialogOpen(false);
    setQrAccount(null);
    setQrCode('');
    setQrCloudPasswordRequired(false);
    // Обновляем список аккаунтов при закрытии
    refetch();
  }, [refetch]);

  const existingServiceIds = messengerAccounts?.map((acc) => acc.serviceId) || [];

  if (!profileId) {
    return null;
  }

  return (
    <>
      <Dialog 
        open={open} 
        onClose={onClose} 
        PaperProps={{
          ...dialogPaperProps,
          sx: {
            ...dialogPaperProps.sx,
            borderRadius: '16px',
          },
        }} 
        maxWidth="lg" 
        fullWidth
      >
        <Box sx={{ ...dialogTitleStyles, borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
          <Typography variant="h6" sx={{ color: '#f5f5f5', fontWeight: 500 }}>
            Управление мессенджерами
          </Typography>
        </Box>

        <DialogContent>
          <MessengerAccountsTable
            profileId={profileId}
            accounts={messengerAccounts || []}
            isLoading={messengerAccountsLoading}
            isProfileRunning={isProfileRunning}
            onCreateAccount={handleCreateAccount}
            onShowQRCode={isProfileRunning ? handleShowQRCode : undefined}
          />
        </DialogContent>

        <DialogActions sx={dialogActionsStyles}>
          <StyledButton onClick={onClose}>Закрыть</StyledButton>
        </DialogActions>
      </Dialog>

      <CreateMessengerAccountDialog
        open={createAccountDialogOpen}
        onClose={() => setCreateAccountDialogOpen(false)}
        profileId={profileId}
        existingServiceIds={existingServiceIds}
      />

      <MessengerQRCodeDialog
        open={qrDialogOpen}
        onClose={handleCloseQRDialog}
        account={qrAccount}
        qrCode={qrCode}
        cloudPasswordRequired={qrCloudPasswordRequired}
        onCloudPasswordSubmit={handleCloudPasswordSubmit}
        onRefreshStatus={handleRefreshStatus}
        refreshIntervalMs={10000} // Обновление каждые 10 секунд
      />
    </>
  );
}

