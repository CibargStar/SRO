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
  CircularProgress,
  Alert,
  Box,
  Divider,
} from '@mui/material';
import { useArchiveCampaign } from '@/hooks/useCampaigns';
import { dialogPaperProps, dialogTitleStyles, dialogContentStyles, dialogActionsStyles, CancelButton, StyledButton, LOADING_ICON_SIZE } from '@/components/common';
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
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth PaperProps={dialogPaperProps}>
      <Box sx={{ ...dialogTitleStyles, borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
        <DialogTitle sx={{ color: '#f5f5f5', p: 0, fontWeight: 500 }}>Архивировать кампанию?</DialogTitle>
      </Box>
      <DialogContent sx={dialogContentStyles}>
        {!canArchive ? (
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
            Можно архивировать только завершённые, отменённые или ошибочные кампании.
          </Alert>
        ) : (
          <DialogContentText sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
            Вы уверены, что хотите архивировать кампанию "{campaign?.name}"?
            Архивированные кампании скрыты из основного списка, но их можно просмотреть
            включив фильтр "Показать архивные".
          </DialogContentText>
        )}
        {archiveMutation.error && (
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
            {(archiveMutation.error as Error).message}
          </Alert>
        )}
      </DialogContent>
      <Divider sx={{ borderColor: 'rgba(255, 255, 255, 0.08)' }} />
      <DialogActions sx={dialogActionsStyles}>
        <CancelButton onClick={onClose} disabled={archiveMutation.isPending}>
          Отмена
        </CancelButton>
        <StyledButton
          onClick={handleArchive}
          disabled={!canArchive || archiveMutation.isPending}
        >
          {archiveMutation.isPending ? <CircularProgress size={LOADING_ICON_SIZE} color="inherit" /> : 'Архивировать'}
        </StyledButton>
      </DialogActions>
    </Dialog>
  );
}



