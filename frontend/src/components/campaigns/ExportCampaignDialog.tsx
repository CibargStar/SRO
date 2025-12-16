/**
 * ExportCampaignDialog.tsx
 * 
 * Диалог экспорта результатов кампании
 */

import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  Alert,
  Box,
  Typography,
  FormGroup,
  FormControlLabel,
  Checkbox,
  Divider,
} from '@mui/material';
import { Download as DownloadIcon } from '@mui/icons-material';
import { useExportCampaign } from '@/hooks/useCampaigns';
import { dialogPaperProps, dialogTitleStyles, dialogContentStyles, dialogActionsStyles, CancelButton, StyledButton, LOADING_ICON_SIZE } from '@/components/common';
import type { Campaign } from '@/types/campaign';

interface ExportCampaignDialogProps {
  open: boolean;
  onClose: () => void;
  campaign: Campaign | null;
}

export function ExportCampaignDialog({
  open,
  onClose,
  campaign,
}: ExportCampaignDialogProps) {
  const [includeSuccessful, setIncludeSuccessful] = useState(true);
  const [includeFailed, setIncludeFailed] = useState(true);
  const [includeSkipped, setIncludeSkipped] = useState(true);

  const exportMutation = useExportCampaign();

  const handleExport = () => {
    if (!campaign) return;
    
    // TODO: В будущем можно передавать опции фильтрации (includeSuccessful, includeFailed, includeSkipped)
    // Сейчас эти опции не используются, но можно добавить в API
    exportMutation.mutate(campaign.id, {
      onSuccess: () => {
        onClose();
      },
    });
  };

  const isFinished = campaign?.status === 'COMPLETED' || 
                     campaign?.status === 'CANCELLED' || 
                     campaign?.status === 'ERROR';

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth PaperProps={dialogPaperProps}>
      <Box sx={{ ...dialogTitleStyles, borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
        <DialogTitle sx={{ color: '#f5f5f5', p: 0, fontWeight: 500 }}>Экспорт результатов</DialogTitle>
      </Box>
      <DialogContent sx={dialogContentStyles}>
        {!isFinished ? (
          <Alert 
            severity="info" 
            sx={{ 
              mb: 2,
              borderRadius: '12px',
              backgroundColor: 'rgba(33, 150, 243, 0.1)',
              color: '#2196f3',
              border: '1px solid rgba(33, 150, 243, 0.2)',
            }}
          >
            Экспорт доступен только для завершённых кампаний.
            Текущий статус: {campaign?.status}
          </Alert>
        ) : (
          <>
            <Typography variant="body2" sx={{ mb: 2, color: 'rgba(255, 255, 255, 0.7)' }}>
              Экспорт результатов кампании "{campaign?.name}" в формате CSV.
            </Typography>

            <Box sx={{ backgroundColor: 'rgba(255, 255, 255, 0.05)', p: 2, borderRadius: '12px', mb: 2 }}>
              <Typography variant="body2" gutterBottom sx={{ color: '#f5f5f5', fontWeight: 500 }}>
                Всего контактов: {campaign?.totalContacts}
              </Typography>
              <Typography variant="body2" sx={{ color: '#4caf50' }}>
                Успешно: {campaign?.successfulContacts}
              </Typography>
              <Typography variant="body2" sx={{ color: '#f44336' }}>
                Ошибки: {campaign?.failedContacts}
              </Typography>
              <Typography variant="body2" sx={{ color: '#ff9800' }}>
                Пропущено: {campaign?.skippedContacts}
              </Typography>
            </Box>

            <Typography variant="subtitle2" gutterBottom sx={{ color: '#f5f5f5', fontWeight: 500, mb: 1 }}>
              Включить в экспорт:
            </Typography>
            <FormGroup>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={includeSuccessful}
                    onChange={(e) => setIncludeSuccessful(e.target.checked)}
                    sx={{
                      color: '#4caf50',
                      '&.Mui-checked': {
                        color: '#4caf50',
                      },
                    }}
                  />
                }
                label={<Typography sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>Успешные сообщения ({campaign?.successfulContacts || 0})</Typography>}
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={includeFailed}
                    onChange={(e) => setIncludeFailed(e.target.checked)}
                    sx={{
                      color: '#f44336',
                      '&.Mui-checked': {
                        color: '#f44336',
                      },
                    }}
                  />
                }
                label={<Typography sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>Ошибки ({campaign?.failedContacts || 0})</Typography>}
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={includeSkipped}
                    onChange={(e) => setIncludeSkipped(e.target.checked)}
                    sx={{
                      color: '#ff9800',
                      '&.Mui-checked': {
                        color: '#ff9800',
                      },
                    }}
                  />
                }
                label={<Typography sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>Пропущенные ({campaign?.skippedContacts || 0})</Typography>}
              />
            </FormGroup>
          </>
        )}

        {exportMutation.error && (
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
            {(exportMutation.error as Error).message}
          </Alert>
        )}
      </DialogContent>
      <Divider sx={{ borderColor: 'rgba(255, 255, 255, 0.08)' }} />
      <DialogActions sx={dialogActionsStyles}>
        <CancelButton onClick={onClose} disabled={exportMutation.isPending}>
          Отмена
        </CancelButton>
        <StyledButton
          onClick={handleExport}
          disabled={!isFinished || exportMutation.isPending || (!includeSuccessful && !includeFailed && !includeSkipped)}
          startIcon={exportMutation.isPending ? <CircularProgress size={LOADING_ICON_SIZE} color="inherit" /> : <DownloadIcon />}
        >
          {exportMutation.isPending ? 'Экспорт...' : 'Скачать CSV'}
        </StyledButton>
      </DialogActions>
    </Dialog>
  );
}



