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
  CircularProgress,
  Alert,
  Box,
  Typography,
  Divider,
} from '@mui/material';
import { useCancelCampaign } from '@/hooks/useCampaigns';
import { dialogPaperProps, dialogTitleStyles, dialogContentStyles, dialogActionsStyles, CancelButton, StyledButton, LOADING_ICON_SIZE } from '@/components/common';
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
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth PaperProps={dialogPaperProps}>
      <Box sx={{ ...dialogTitleStyles, borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
        <DialogTitle sx={{ color: '#f44336', p: 0, fontWeight: 500 }}>Отменить кампанию?</DialogTitle>
      </Box>
      <DialogContent sx={dialogContentStyles}>
        {!canCancel ? (
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
            Невозможно отменить кампанию в статусе "{campaign?.status}".
          </Alert>
        ) : (
          <>
            <DialogContentText sx={{ mb: 2, color: 'rgba(255, 255, 255, 0.7)' }}>
              Вы уверены, что хотите отменить кампанию "{campaign?.name}"?
            </DialogContentText>
            
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
              <Typography variant="body2" fontWeight={500} sx={{ color: '#ff9800' }}>
                Это действие нельзя отменить!
              </Typography>
              <Typography variant="body2" sx={{ color: '#ff9800' }}>
                Все необработанные сообщения будут пропущены.
              </Typography>
            </Alert>

            {remainingContacts > 0 && (
              <Box sx={{ backgroundColor: 'rgba(255, 255, 255, 0.05)', p: 2, borderRadius: '12px' }}>
                <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)', mb: 0.5 }}>
                  Прогресс: {campaign?.processedContacts} / {campaign?.totalContacts}
                </Typography>
                <Typography variant="body2" sx={{ color: '#ff9800', fontWeight: 500 }}>
                  Будет пропущено: {remainingContacts} контактов
                </Typography>
              </Box>
            )}
          </>
        )}
        {cancelMutation.error && (
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
            {(cancelMutation.error as Error).message}
          </Alert>
        )}
      </DialogContent>
      <Divider sx={{ borderColor: 'rgba(255, 255, 255, 0.08)' }} />
      <DialogActions sx={dialogActionsStyles}>
        <CancelButton onClick={onClose} disabled={cancelMutation.isPending}>
          Нет, продолжить
        </CancelButton>
        <StyledButton
          onClick={handleCancel}
          disabled={!canCancel || cancelMutation.isPending}
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
          {cancelMutation.isPending ? <CircularProgress size={LOADING_ICON_SIZE} color="inherit" /> : 'Да, отменить'}
        </StyledButton>
      </DialogActions>
    </Dialog>
  );
}



