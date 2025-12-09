import React from 'react';
import { Box, Typography, Grid, Paper, Stack, Chip, Alert } from '@mui/material';
import { useFormContext } from 'react-hook-form';
import type { Template } from '@/types/template';
import { TemplateTypeBadge, MessengerTargetBadge as TemplateMessengerBadge } from '@/components/templates';
import { CAMPAIGN_TYPE_LABELS, MESSENGER_TARGET_LABELS } from '@/types/campaign';
import type { ClientGroup } from '@/types';

interface Props {
  selectedTemplate: Template | null;
  clientGroupsData?: ClientGroup[];
}

export function WizardStep7_Review({ selectedTemplate, clientGroupsData }: Props) {
  const { watch } = useFormContext();
  const watchedValues = watch();

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Проверьте данные кампании
      </Typography>

      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Основная информация
            </Typography>
            <Typography variant="body1" fontWeight={500}>
              {watchedValues.name || '(Без названия)'}
            </Typography>
            {watchedValues.description && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                {watchedValues.description}
              </Typography>
            )}
            <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
              <Chip label={CAMPAIGN_TYPE_LABELS[watchedValues.campaignType]} size="small" />
              <Chip label={MESSENGER_TARGET_LABELS[watchedValues.messengerType]} size="small" />
            </Stack>
          </Paper>
        </Grid>

        <Grid item xs={12} md={6}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Шаблон
            </Typography>
            {selectedTemplate ? (
              <>
                <Typography variant="body1" fontWeight={500}>
                  {selectedTemplate.name}
                </Typography>
                <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                  <TemplateTypeBadge type={selectedTemplate.type} size="small" />
                  <TemplateMessengerBadge target={selectedTemplate.messengerTarget} size="small" />
                </Stack>
              </>
            ) : (
              <Typography color="error">Шаблон не выбран</Typography>
            )}
          </Paper>
        </Grid>

        <Grid item xs={12} md={6}>
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              База и профили
            </Typography>
            <Stack spacing={1} sx={{ color: '#fff' }}>
              <Typography variant="body2">
                Группа: {clientGroupsData?.find((g) => g.id === watchedValues.clientGroupId)?.name || 'не выбрана'}
              </Typography>
              <Typography variant="body2">
                Профили: {watchedValues.profileIds?.length > 0 ? watchedValues.profileIds.length : 'не выбраны'}
              </Typography>
            </Stack>
          </Paper>
        </Grid>

        <Grid item xs={12}>
          <Alert severity="warning">
            После создания кампания будет в статусе "Черновик".
            Вы сможете отредактировать её и запустить позже.
          </Alert>
        </Grid>
      </Grid>
    </Box>
  );
}

export default WizardStep7_Review;



