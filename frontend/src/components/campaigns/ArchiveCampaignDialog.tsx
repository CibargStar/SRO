/**
 * ArchiveCampaignDialog.tsx
 * 
 * Диалог подтверждения архивации кампании
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
import { useArchiveCampaign } from '@/hooks/useCampaigns';
import type { Campaign } from '@/types/campaign';

interface ArchiveCampaignDialogProps {
  open: boolean;
  onClose: () => void;
  campaign: Campaign | null;
  onSuccess?: () => void;
}

export function ArchiveCampaignDialog({
  open,
  onClose,
  campaign,
  onSuccess,
}: ArchiveCampaignDialogProps) {
  const archiveMutation = useArchiveCampaign();

  const handleArchive = () => {
    if (!campaign) return;

    archiveMutation.mutate(campaign.id, {
      onSuccess: () => {
        onClose();
        onSuccess?.();
      },
    });
  };

  const canArchive = campaign?.status === 'COMPLETED' || 
                     campaign?.status === 'CANCELLED' || 
                     campaign?.status === 'ERROR';

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Архивировать кампанию?</DialogTitle>
      <DialogContent>
        {!canArchive ? (
          <Alert severity="warning" sx={{ mb: 2 }}>
            Можно архивировать только завершённые, отменённые или ошибочные кампании.
          </Alert>
        ) : (
          <DialogContentText>
            Вы уверены, что хотите архивировать кампанию "{campaign?.name}"?
            Архивированные кампании скрыты из основного списка, но их можно просмотреть
            включив фильтр "Показать архивные".
          </DialogContentText>
        )}
        {archiveMutation.error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {(archiveMutation.error as Error).message}
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={archiveMutation.isPending}>
          Отмена
        </Button>
        <Button
          onClick={handleArchive}
          color="primary"
          variant="contained"
          disabled={!canArchive || archiveMutation.isPending}
        >
          {archiveMutation.isPending ? <CircularProgress size={20} /> : 'Архивировать'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}


