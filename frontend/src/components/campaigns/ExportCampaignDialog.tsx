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
  Button,
  CircularProgress,
  Alert,
  Box,
  Typography,
  FormGroup,
  FormControlLabel,
  Checkbox,
} from '@mui/material';
import { Download as DownloadIcon } from '@mui/icons-material';
import { useExportCampaign } from '@/hooks/useCampaigns';
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
    
    // В будущем можно передавать опции фильтрации
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
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Экспорт результатов</DialogTitle>
      <DialogContent>
        {!isFinished ? (
          <Alert severity="info" sx={{ mb: 2 }}>
            Экспорт доступен только для завершённых кампаний.
            Текущий статус: {campaign?.status}
          </Alert>
        ) : (
          <>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Экспорт результатов кампании "{campaign?.name}" в формате CSV.
            </Typography>

            <Box sx={{ bgcolor: 'action.hover', p: 2, borderRadius: 1, mb: 2 }}>
              <Typography variant="body2" gutterBottom>
                <strong>Всего контактов:</strong> {campaign?.totalContacts}
              </Typography>
              <Typography variant="body2" color="success.main">
                Успешно: {campaign?.successfulContacts}
              </Typography>
              <Typography variant="body2" color="error.main">
                Ошибки: {campaign?.failedContacts}
              </Typography>
              <Typography variant="body2" color="warning.main">
                Пропущено: {campaign?.skippedContacts}
              </Typography>
            </Box>

            <Typography variant="subtitle2" gutterBottom>
              Включить в экспорт:
            </Typography>
            <FormGroup>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={includeSuccessful}
                    onChange={(e) => setIncludeSuccessful(e.target.checked)}
                    color="success"
                  />
                }
                label={`Успешные сообщения (${campaign?.successfulContacts || 0})`}
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={includeFailed}
                    onChange={(e) => setIncludeFailed(e.target.checked)}
                    color="error"
                  />
                }
                label={`Ошибки (${campaign?.failedContacts || 0})`}
              />
              <FormControlLabel
                control={
                  <Checkbox
                    checked={includeSkipped}
                    onChange={(e) => setIncludeSkipped(e.target.checked)}
                    color="warning"
                  />
                }
                label={`Пропущенные (${campaign?.skippedContacts || 0})`}
              />
            </FormGroup>
          </>
        )}

        {exportMutation.error && (
          <Alert severity="error" sx={{ mt: 2 }}>
            {(exportMutation.error as Error).message}
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={exportMutation.isPending}>
          Отмена
        </Button>
        <Button
          onClick={handleExport}
          color="primary"
          variant="contained"
          disabled={!isFinished || exportMutation.isPending || (!includeSuccessful && !includeFailed && !includeSkipped)}
          startIcon={exportMutation.isPending ? <CircularProgress size={16} /> : <DownloadIcon />}
        >
          {exportMutation.isPending ? 'Экспорт...' : 'Скачать CSV'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}


