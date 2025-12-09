/**
 * DeleteCampaignDialog.tsx
 * 
 * Диалог подтверждения удаления кампании
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
} from '@mui/material';
import { useDeleteCampaign } from '@/hooks/useCampaigns';
import type { Campaign } from '@/types/campaign';

interface DeleteCampaignDialogProps {
  open: boolean;
  onClose: () => void;
  campaign: Campaign | null;
  onSuccess?: () => void;
}

export function DeleteCampaignDialog({
  open,
  onClose,
  campaign,
  onSuccess,
}: DeleteCampaignDialogProps) {
  const deleteMutation = useDeleteCampaign();

  const handleDelete = () => {
    if (!campaign) return;

    deleteMutation.mutate(campaign.id, {
      onSuccess: () => {
        onClose();
        onSuccess?.();
      },
    });
  };

  const canDelete = campaign?.status === 'DRAFT' || 
                    campaign?.status === 'COMPLETED' || 
                    campaign?.status === 'CANCELLED' || 
                    campaign?.status === 'ERROR';

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Удалить кампанию?</DialogTitle>
      <DialogContent>
        {!canDelete ? (
          <Alert severity="warning" sx={{ mb: 2 }}>
            Невозможно удалить кампанию в статусе "{campaign?.status}". 
            Сначала отмените или дождитесь завершения кампании.
          </Alert>
        ) : (
          <DialogContentText>
            Вы уверены, что хотите удалить кампанию "{campaign?.name}"?
            Это действие нельзя отменить. Все связанные данные (сообщения, логи, статистика) будут удалены.
          </DialogContentText>
        )}
        {deleteMutation.error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {(deleteMutation.error as Error).message}
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={deleteMutation.isPending}>
          Отмена
        </Button>
        <Button
          onClick={handleDelete}
          color="error"
          variant="contained"
          disabled={!canDelete || deleteMutation.isPending}
        >
          {deleteMutation.isPending ? <CircularProgress size={20} /> : 'Удалить'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}


