import React, { useMemo, useState } from 'react';
import {
  Box,
  Typography,
  IconButton,
  Button,
  CircularProgress,
  Alert,
} from '@mui/material';
import { Refresh as RefreshIcon } from '@mui/icons-material';
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
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return <Alert severity="error">Ошибка загрузки лимитов: {error.message}</Alert>;
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h4">Лимиты кампаний (ROOT)</Typography>
        <IconButton onClick={() => refetch()} disabled={isLoading}>
          <RefreshIcon />
        </IconButton>
      </Box>

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
  );
}

export default UserCampaignLimitsPage;

