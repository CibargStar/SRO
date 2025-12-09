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
  Button,
  TextField,
  CircularProgress,
  Alert,
  Box,
} from '@mui/material';
import { useDuplicateCampaign } from '@/hooks/useCampaigns';
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
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>Дублировать кампанию</DialogTitle>
      <DialogContent>
        <Box sx={{ mt: 1 }}>
          <TextField
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
          <Alert severity="error" sx={{ mt: 2 }}>
            {(duplicateMutation.error as Error).message}
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={duplicateMutation.isPending}>
          Отмена
        </Button>
        <Button
          onClick={handleDuplicate}
          color="primary"
          variant="contained"
          disabled={duplicateMutation.isPending}
        >
          {duplicateMutation.isPending ? <CircularProgress size={20} /> : 'Дублировать'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}


