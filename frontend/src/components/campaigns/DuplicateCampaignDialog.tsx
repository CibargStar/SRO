/**
 * DuplicateCampaignDialog.tsx
 * 
 * Диалог дублирования кампании
 */

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  Alert,
  Box,
  Divider,
} from '@mui/material';
import { useDuplicateCampaign } from '@/hooks/useCampaigns';
import { dialogPaperProps, dialogTitleStyles, dialogContentStyles, dialogActionsStyles, CancelButton, StyledButton, StyledTextField, LOADING_ICON_SIZE } from '@/components/common';
import type { Campaign } from '@/types/campaign';

interface DuplicateCampaignDialogProps {
  open: boolean;
  onClose: () => void;
  campaign: Campaign | null;
  onSuccess?: (newCampaign: Campaign) => void;
}

export function DuplicateCampaignDialog({
  open,
  onClose,
  campaign,
  onSuccess,
}: DuplicateCampaignDialogProps) {
  const [name, setName] = useState('');
  const duplicateMutation = useDuplicateCampaign();

  // Инициализация имени при открытии
  useEffect(() => {
    if (open && campaign) {
      setName(`${campaign.name} (копия)`);
    }
  }, [open, campaign]);

  const handleDuplicate = () => {
    if (!campaign) return;

    duplicateMutation.mutate(
      { campaignId: campaign.id, input: { name: name.trim() || undefined } },
      {
        onSuccess: (newCampaign) => {
          onClose();
          onSuccess?.(newCampaign);
        },
      }
    );
  };

  const handleClose = () => {
    setName('');
    duplicateMutation.reset();
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth PaperProps={dialogPaperProps}>
      <Box sx={{ ...dialogTitleStyles, borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
        <DialogTitle sx={{ color: '#f5f5f5', p: 0, fontWeight: 500 }}>Дублировать кампанию</DialogTitle>
      </Box>
      <DialogContent sx={dialogContentStyles}>
        <Box sx={{ mt: 1 }}>
          <StyledTextField
            autoFocus
            label="Название новой кампании"
            fullWidth
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={campaign?.name ? `${campaign.name} (копия)` : ''}
            helperText="Оставьте пустым для автоматического названия"
          />
        </Box>
        {duplicateMutation.error && (
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
            {(duplicateMutation.error as Error).message}
          </Alert>
        )}
      </DialogContent>
      <Divider sx={{ borderColor: 'rgba(255, 255, 255, 0.08)' }} />
      <DialogActions sx={dialogActionsStyles}>
        <CancelButton onClick={handleClose} disabled={duplicateMutation.isPending}>
          Отмена
        </CancelButton>
        <StyledButton
          onClick={handleDuplicate}
          disabled={duplicateMutation.isPending}
        >
          {duplicateMutation.isPending ? <CircularProgress size={LOADING_ICON_SIZE} color="inherit" /> : 'Дублировать'}
        </StyledButton>
      </DialogActions>
    </Dialog>
  );
}



