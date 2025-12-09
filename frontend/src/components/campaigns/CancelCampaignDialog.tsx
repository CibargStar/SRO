/**
 * CancelCampaignDialog.tsx
 * 
 * Диалог подтверждения отмены кампании
 */

import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
  CircularProgress,
  Alert,
  Box,
  Typography,
} from '@mui/material';
import { useCancelCampaign } from '@/hooks/useCampaigns';
import type { Campaign } from '@/types/campaign';

interface CancelCampaignDialogProps {
  open: boolean;
  onClose: () => void;
  campaign: Campaign | null;
  onSuccess?: () => void;
}

export function CancelCampaignDialog({
  open,
  onClose,
  campaign,
  onSuccess,
}: CancelCampaignDialogProps) {
  const cancelMutation = useCancelCampaign();

  const handleCancel = () => {
    if (!campaign) return;

    cancelMutation.mutate(campaign.id, {
      onSuccess: () => {
        onClose();
        onSuccess?.();
      },
    });
  };

  const canCancel = campaign?.status === 'RUNNING' || 
                    campaign?.status === 'PAUSED' || 
                    campaign?.status === 'QUEUED' ||
                    campaign?.status === 'SCHEDULED';

  const remainingContacts = campaign ? 
    campaign.totalContacts - campaign.processedContacts : 0;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle color="error">Отменить кампанию?</DialogTitle>
      <DialogContent>
        {!canCancel ? (
          <Alert severity="warning" sx={{ mb: 2 }}>
            Невозможно отменить кампанию в статусе "{campaign?.status}".
          </Alert>
        ) : (
          <>
            <DialogContentText sx={{ mb: 2 }}>
              Вы уверены, что хотите отменить кампанию "{campaign?.name}"?
            </DialogContentText>
            
            <Alert severity="warning" sx={{ mb: 2 }}>
              <Typography variant="body2" fontWeight={500}>
                Это действие нельзя отменить!
              </Typography>
              <Typography variant="body2">
                Все необработанные сообщения будут пропущены.
              </Typography>
            </Alert>

            {remainingContacts > 0 && (
              <Box sx={{ bgcolor: 'action.hover', p: 2, borderRadius: 1 }}>
                <Typography variant="body2" color="text.secondary">
                  Прогресс: {campaign?.processedContacts} / {campaign?.totalContacts}
                </Typography>
                <Typography variant="body2" color="warning.main" fontWeight={500}>
                  Будет пропущено: {remainingContacts} контактов
                </Typography>
              </Box>
            )}
          </>
        )}
        {cancelMutation.error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {(cancelMutation.error as Error).message}
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={cancelMutation.isPending}>
          Нет, продолжить
        </Button>
        <Button
          onClick={handleCancel}
          color="error"
          variant="contained"
          disabled={!canCancel || cancelMutation.isPending}
        >
          {cancelMutation.isPending ? <CircularProgress size={20} /> : 'Да, отменить'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}


