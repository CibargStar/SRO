import React, { useMemo, useState } from 'react';
import {
  Box,
  Typography,
  IconButton,
  CircularProgress,
  Alert,
  Paper,
  Tooltip,
} from '@mui/material';
import { Refresh as RefreshIcon } from '@mui/icons-material';
import { StyledButton, LOADING_ICON_SIZE } from '@/components/common';
import { useAllCampaignLimits, useSetUserCampaignLimits } from '@/hooks/useCampaignSettings';
import type { UserCampaignLimits } from '@/types/campaign';
import { UserCampaignLimitsTable } from '@/components/admin/campaign-limits/UserCampaignLimitsTable';
import { EditUserCampaignLimitsDialog } from '@/components/admin/campaign-limits/EditUserCampaignLimitsDialog';

interface EditState {
  open: boolean;
  limits: UserCampaignLimits | null;
}

export function UserCampaignLimitsPage() {
  const { data, isLoading, error, refetch } = useAllCampaignLimits();
  const setLimitsMutation = useSetUserCampaignLimits();

  const [editState, setEditState] = useState<EditState>({ open: false, limits: null });
  const [draft, setDraft] = useState<Partial<UserCampaignLimits>>({});

  const handleOpenEdit = (limits: UserCampaignLimits) => {
    setEditState({ open: true, limits });
    setDraft(limits);
  };

  const handleCloseEdit = () => {
    setEditState({ open: false, limits: null });
    setDraft({});
  };

  const handleNumberChange = (key: keyof UserCampaignLimits) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value === '' ? undefined : Number(e.target.value);
    setDraft((prev) => ({ ...prev, [key]: value as any }));
  };

  const handleSwitchChange = (key: keyof UserCampaignLimits) => (_: React.ChangeEvent<HTMLInputElement>, checked: boolean) => {
    setDraft((prev) => ({ ...prev, [key]: checked as any }));
  };

  const handleSave = async () => {
    if (!editState.limits) return;
    const { userId } = editState.limits;
    const input = {
      maxActiveCampaigns: draft.maxActiveCampaigns,
      maxTemplates: draft.maxTemplates,
      maxTemplateCategories: draft.maxTemplateCategories,
      maxFileSizeMb: draft.maxFileSizeMb,
      maxTotalStorageMb: draft.maxTotalStorageMb,
      allowScheduledCampaigns: draft.allowScheduledCampaigns,
      allowUniversalCampaigns: draft.allowUniversalCampaigns,
    };

    await setLimitsMutation.mutateAsync({ userId, input });
    handleCloseEdit();
  };

  const rows = useMemo(() => data ?? [], [data]);

  if (isLoading) {
    return (
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        minHeight: '50vh',
        maxWidth: 1600,
        mx: 'auto',
      }}>
        <CircularProgress sx={{ color: '#6366f1' }} />
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ maxWidth: 1600, mx: 'auto' }}>
        <Alert 
          severity="error"
          sx={{
            borderRadius: '12px',
            backgroundColor: 'rgba(244, 67, 54, 0.1)',
            color: '#f44336',
            border: '1px solid rgba(244, 67, 54, 0.2)',
          }}
        >
          Ошибка загрузки лимитов: {error.message}
        </Alert>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        width: '100%',
        overflowY: 'auto',
        '&::-webkit-scrollbar': {
          display: 'none',
          width: 0,
          height: 0,
        },
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
        '& *': {
          '&::-webkit-scrollbar': {
            display: 'none',
            width: 0,
            height: 0,
          },
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        },
      }}
    >
      <Box sx={{ maxWidth: 1600, mx: 'auto' }}>
        <Paper sx={{ p: 3, backgroundColor: 'rgba(255, 255, 255, 0.06)', borderRadius: '16px', border: 'none', mb: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h4" sx={{ color: '#f5f5f5', fontWeight: 500 }}>
              Лимиты кампаний
            </Typography>
            <Tooltip title="Обновить">
              <IconButton 
                onClick={() => refetch()} 
                disabled={isLoading}
                sx={{
                  color: 'rgba(255, 255, 255, 0.7)',
                  '&:hover': {
                    backgroundColor: 'rgba(255, 255, 255, 0.08)',
                    color: '#f5f5f5',
                  },
                }}
              >
                <RefreshIcon />
              </IconButton>
            </Tooltip>
          </Box>
        </Paper>

        <UserCampaignLimitsTable rows={rows} onEdit={handleOpenEdit} />

        <EditUserCampaignLimitsDialog
          open={editState.open}
          limits={editState.limits}
          draft={draft}
          onClose={handleCloseEdit}
          onChangeNumber={handleNumberChange}
          onChangeSwitch={handleSwitchChange}
          onSave={handleSave}
          saving={setLimitsMutation.isPending}
        />
      </Box>
    </Box>
  );
}

export default UserCampaignLimitsPage;

