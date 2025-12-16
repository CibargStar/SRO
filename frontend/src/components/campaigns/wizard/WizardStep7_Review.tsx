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
      <Typography variant="h6" gutterBottom sx={{ color: '#f5f5f5', fontWeight: 500, mb: 3 }}>
        Проверьте данные кампании
      </Typography>

      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2.5, backgroundColor: 'rgba(255, 255, 255, 0.05)', borderRadius: '12px', border: 'none' }}>
            <Typography variant="subtitle2" sx={{ color: 'rgba(255, 255, 255, 0.6)', mb: 1, fontWeight: 500 }}>
              Основная информация
            </Typography>
            <Typography variant="body1" fontWeight={500} sx={{ color: '#f5f5f5' }}>
              {watchedValues.name || '(Без названия)'}
            </Typography>
            {watchedValues.description && (
              <Typography variant="body2" sx={{ mt: 1, color: 'rgba(255, 255, 255, 0.6)' }}>
                {watchedValues.description}
              </Typography>
            )}
            <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
              <Chip 
                label={CAMPAIGN_TYPE_LABELS[watchedValues.campaignType]} 
                size="small"
                sx={{
                  backgroundColor: 'rgba(99, 102, 241, 0.2)',
                  color: '#818cf8',
                }}
              />
              <Chip 
                label={MESSENGER_TARGET_LABELS[watchedValues.messengerType]} 
                size="small"
                sx={{
                  backgroundColor: 'rgba(99, 102, 241, 0.2)',
                  color: '#818cf8',
                }}
              />
            </Stack>
          </Paper>
        </Grid>

        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2.5, backgroundColor: 'rgba(255, 255, 255, 0.05)', borderRadius: '12px', border: 'none' }}>
            <Typography variant="subtitle2" sx={{ color: 'rgba(255, 255, 255, 0.6)', mb: 1, fontWeight: 500 }}>
              Шаблон
            </Typography>
            {selectedTemplate ? (
              <>
                <Typography variant="body1" fontWeight={500} sx={{ color: '#f5f5f5' }}>
                  {selectedTemplate.name}
                </Typography>
                <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
                  <TemplateTypeBadge type={selectedTemplate.type} size="small" />
                  <TemplateMessengerBadge target={selectedTemplate.messengerTarget} size="small" />
                </Stack>
              </>
            ) : (
              <Typography sx={{ color: '#f44336' }}>Шаблон не выбран</Typography>
            )}
          </Paper>
        </Grid>

        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2.5, backgroundColor: 'rgba(255, 255, 255, 0.05)', borderRadius: '12px', border: 'none' }}>
            <Typography variant="subtitle2" sx={{ color: 'rgba(255, 255, 255, 0.6)', mb: 1, fontWeight: 500 }}>
              База и профили
            </Typography>
            <Stack spacing={1}>
              <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                Группа: {clientGroupsData?.find((g) => g.id === watchedValues.clientGroupId)?.name || 'не выбрана'}
              </Typography>
              <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
                Профили: {watchedValues.profileIds?.length > 0 ? watchedValues.profileIds.length : 'не выбраны'}
              </Typography>
            </Stack>
          </Paper>
        </Grid>

        <Grid item xs={12}>
          <Alert 
            severity="warning"
            sx={{
              borderRadius: '12px',
              backgroundColor: 'rgba(255, 152, 0, 0.1)',
              color: '#ff9800',
              border: '1px solid rgba(255, 152, 0, 0.2)',
            }}
          >
            После создания кампания будет в статусе "Черновик".
            Вы сможете отредактировать её и запустить позже.
          </Alert>
        </Grid>
      </Grid>
    </Box>
  );
}

export default WizardStep7_Review;




