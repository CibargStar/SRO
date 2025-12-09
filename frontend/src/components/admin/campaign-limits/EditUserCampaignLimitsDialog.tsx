import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControlLabel,
  Switch,
  Button,
  CircularProgress,
  Box,
} from '@mui/material';
import type { UserCampaignLimits } from '@/types/campaign';

interface Props {
  open: boolean;
  limits: UserCampaignLimits | null;
  draft: Partial<UserCampaignLimits>;
  onClose: () => void;
  onChangeNumber: (key: keyof UserCampaignLimits) => (e: React.ChangeEvent<HTMLInputElement>) => void;
  onChangeSwitch: (key: keyof UserCampaignLimits) => (_: React.ChangeEvent<HTMLInputElement>, checked: boolean) => void;
  onSave: () => void;
  saving: boolean;
}

export function EditUserCampaignLimitsDialog({
  open,
  limits,
  draft,
  onClose,
  onChangeNumber,
  onChangeSwitch,
  onSave,
  saving,
}: Props) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Редактирование лимитов</DialogTitle>
      <DialogContent dividers>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 2, mt: 1 }}>
          <TextField
            label="Макс. активных кампаний"
            type="number"
            value={draft.maxActiveCampaigns ?? ''}
            onChange={onChangeNumber('maxActiveCampaigns')}
            fullWidth
          />
          <TextField
            label="Макс. шаблонов"
            type="number"
            value={draft.maxTemplates ?? ''}
            onChange={onChangeNumber('maxTemplates')}
            fullWidth
          />
          <TextField
            label="Макс. категорий"
            type="number"
            value={draft.maxTemplateCategories ?? ''}
            onChange={onChangeNumber('maxTemplateCategories')}
            fullWidth
          />
          <TextField
            label="Макс. размер файла (MB)"
            type="number"
            value={draft.maxFileSizeMb ?? ''}
            onChange={onChangeNumber('maxFileSizeMb')}
            fullWidth
          />
          <TextField
            label="Макс. хранилище (MB)"
            type="number"
            value={draft.maxTotalStorageMb ?? ''}
            onChange={onChangeNumber('maxTotalStorageMb')}
            fullWidth
          />
          <FormControlLabel
            control={
              <Switch
                checked={draft.allowScheduledCampaigns ?? false}
                onChange={onChangeSwitch('allowScheduledCampaigns')}
              />
            }
            label="Разрешить scheduled"
          />
          <FormControlLabel
            control={
              <Switch
                checked={draft.allowUniversalCampaigns ?? false}
                onChange={onChangeSwitch('allowUniversalCampaigns')}
              />
            }
            label="Разрешить universal"
          />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Отмена</Button>
        <Button
          variant="contained"
          onClick={onSave}
          disabled={saving}
        >
          {saving ? <CircularProgress size={20} /> : 'Сохранить'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default EditUserCampaignLimitsDialog;


