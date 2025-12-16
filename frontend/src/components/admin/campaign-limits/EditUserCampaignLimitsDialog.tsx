import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControlLabel,
  Switch,
  CircularProgress,
  Box,
  Typography,
  Divider,
  Stack,
} from '@mui/material';
import { StyledTextField, StyledButton, CancelButton, dialogPaperProps, dialogTitleStyles, dialogContentStyles, dialogActionsStyles, LOADING_ICON_SIZE } from '@/components/common';
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
  const userEmail = limits ? ((limits as any).user?.email ?? limits.userId) : '';

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="sm" 
      fullWidth
      PaperProps={dialogPaperProps}
    >
      <DialogTitle sx={dialogTitleStyles}>
        <Typography variant="h6" sx={{ color: '#f5f5f5', fontWeight: 500 }}>
          Редактирование лимитов
        </Typography>
        {userEmail && (
          <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.6)', mt: 0.5 }}>
            {userEmail}
          </Typography>
        )}
      </DialogTitle>
      <Divider sx={{ borderColor: 'rgba(255, 255, 255, 0.08)' }} />
      <DialogContent sx={dialogContentStyles}>
        <Stack spacing={3}>
          <Box>
            <Typography variant="subtitle2" sx={{ color: '#f5f5f5', fontWeight: 500, mb: 2 }}>
              Лимиты
            </Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 2 }}>
              <StyledTextField
                label="Макс. активных кампаний"
                type="number"
                value={draft.maxActiveCampaigns ?? ''}
                onChange={onChangeNumber('maxActiveCampaigns')}
                fullWidth
              />
              <StyledTextField
                label="Макс. шаблонов"
                type="number"
                value={draft.maxTemplates ?? ''}
                onChange={onChangeNumber('maxTemplates')}
                fullWidth
              />
              <StyledTextField
                label="Макс. категорий"
                type="number"
                value={draft.maxTemplateCategories ?? ''}
                onChange={onChangeNumber('maxTemplateCategories')}
                fullWidth
              />
              <StyledTextField
                label="Макс. размер файла (MB)"
                type="number"
                value={draft.maxFileSizeMb ?? ''}
                onChange={onChangeNumber('maxFileSizeMb')}
                fullWidth
              />
              <StyledTextField
                label="Макс. хранилище (MB)"
                type="number"
                value={draft.maxTotalStorageMb ?? ''}
                onChange={onChangeNumber('maxTotalStorageMb')}
                fullWidth
              />
            </Box>
          </Box>

          <Divider sx={{ borderColor: 'rgba(255, 255, 255, 0.08)' }} />

          <Box>
            <Typography variant="subtitle2" sx={{ color: '#f5f5f5', fontWeight: 500, mb: 2 }}>
              Разрешения
            </Typography>
            <Stack spacing={1.5}>
              <FormControlLabel
                control={
                  <Switch
                    checked={draft.allowScheduledCampaigns ?? false}
                    onChange={onChangeSwitch('allowScheduledCampaigns')}
                    sx={{
                      '& .MuiSwitch-switchBase.Mui-checked': {
                        color: '#6366f1',
                      },
                      '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                        backgroundColor: '#6366f1',
                      },
                    }}
                  />
                }
                label={
                  <Typography sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                    Разрешить scheduled кампании
                  </Typography>
                }
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={draft.allowUniversalCampaigns ?? false}
                    onChange={onChangeSwitch('allowUniversalCampaigns')}
                    sx={{
                      '& .MuiSwitch-switchBase.Mui-checked': {
                        color: '#6366f1',
                      },
                      '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                        backgroundColor: '#6366f1',
                      },
                    }}
                  />
                }
                label={
                  <Typography sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                    Разрешить universal кампании
                  </Typography>
                }
              />
            </Stack>
          </Box>
        </Stack>
      </DialogContent>
      <Divider sx={{ borderColor: 'rgba(255, 255, 255, 0.08)' }} />
      <DialogActions sx={dialogActionsStyles}>
        <CancelButton onClick={onClose} disabled={saving}>
          Отмена
        </CancelButton>
        <StyledButton
          onClick={onSave}
          disabled={saving}
        >
          {saving ? <CircularProgress size={LOADING_ICON_SIZE} color="inherit" /> : 'Сохранить'}
        </StyledButton>
      </DialogActions>
    </Dialog>
  );
}

export default EditUserCampaignLimitsDialog;



