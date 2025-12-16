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
  CircularProgress,
  Alert,
  Box,
  Divider,
} from '@mui/material';
import { useDeleteCampaign } from '@/hooks/useCampaigns';
import { dialogPaperProps, dialogTitleStyles, dialogContentStyles, dialogActionsStyles, CancelButton, StyledButton, LOADING_ICON_SIZE } from '@/components/common';
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
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth PaperProps={dialogPaperProps}>
      <Box sx={{ ...dialogTitleStyles, borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
        <DialogTitle sx={{ color: '#f5f5f5', p: 0, fontWeight: 500 }}>Удалить кампанию?</DialogTitle>
      </Box>
      <DialogContent sx={dialogContentStyles}>
        {!canDelete ? (
          <Alert 
            severity="warning" 
            sx={{ 
              mb: 2,
              borderRadius: '12px',
              backgroundColor: 'rgba(255, 152, 0, 0.1)',
              color: '#ff9800',
              border: '1px solid rgba(255, 152, 0, 0.2)',
            }}
          >
            Невозможно удалить кампанию в статусе "{campaign?.status}". 
            Сначала отмените или дождитесь завершения кампании.
          </Alert>
        ) : (
          <DialogContentText sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
            Вы уверены, что хотите удалить кампанию "{campaign?.name}"?
            Это действие нельзя отменить. Все связанные данные (сообщения, логи, статистика) будут удалены.
          </DialogContentText>
        )}
        {deleteMutation.error && (
          <Alert 
            severity="error" 
            sx={{ 
              mt: 2,
              borderRadius: '12px',
              backgroundColor: 'rgba(244, 67, 54, 0.1)',
              color: '#f44336',
              border: '1px solid rgba(244, 67, 54, 0.2)',
            }}
          >
            {(deleteMutation.error as Error).message}
          </Alert>
        )}
      </DialogContent>
      <Divider sx={{ borderColor: 'rgba(255, 255, 255, 0.08)' }} />
      <DialogActions sx={dialogActionsStyles}>
        <CancelButton onClick={onClose} disabled={deleteMutation.isPending}>
          Отмена
        </CancelButton>
        <StyledButton
          onClick={handleDelete}
          disabled={!canDelete || deleteMutation.isPending}
          sx={{
            backgroundColor: '#f44336',
            color: '#fff',
            '&:hover': {
              backgroundColor: '#d32f2f',
            },
            '&:disabled': {
              backgroundColor: 'rgba(244, 67, 54, 0.3)',
            },
          }}
        >
          {deleteMutation.isPending ? <CircularProgress size={LOADING_ICON_SIZE} color="inherit" /> : 'Удалить'}
        </StyledButton>
      </DialogActions>
    </Dialog>
  );
}



