import { Box, Typography, Paper, Stack, Chip, Alert, Grid } from '@mui/material';
import ShuffleIcon from '@mui/icons-material/Shuffle';
import { useFormContext } from 'react-hook-form';
import type { Template } from '@/types/template';
import { TemplateTypeBadge, MessengerTargetBadge as TemplateMessengerBadge } from '@/components/templates';
import { CAMPAIGN_TYPE_LABELS, MESSENGER_TARGET_LABELS, type CampaignType, type MessengerTarget } from '@/types/campaign';
import type { ClientGroup } from '@/types';

interface Props {
  selectedTemplates: Template[];
  clientGroupsData?: ClientGroup[];
}

export function WizardStep7_Review({ selectedTemplates, clientGroupsData }: Props) {
  const { watch } = useFormContext();
  const watchedValues = watch();

  return (
    <Box>
      <Typography variant="h6" gutterBottom sx={{ color: '#f5f5f5', fontWeight: 500, mb: 3 }}>
        Проверьте данные кампании
      </Typography>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 6 }}>
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
                label={CAMPAIGN_TYPE_LABELS[watchedValues.campaignType as CampaignType]} 
                size="small"
                sx={{
                  backgroundColor: 'rgba(99, 102, 241, 0.2)',
                  color: '#818cf8',
                }}
              />
              <Chip 
                label={MESSENGER_TARGET_LABELS[watchedValues.messengerType as MessengerTarget]} 
                size="small"
                sx={{
                  backgroundColor: 'rgba(99, 102, 241, 0.2)',
                  color: '#818cf8',
                }}
              />
            </Stack>
          </Paper>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <Paper sx={{ p: 2.5, backgroundColor: 'rgba(255, 255, 255, 0.05)', borderRadius: '12px', border: 'none' }}>
            <Typography variant="subtitle2" sx={{ color: 'rgba(255, 255, 255, 0.6)', mb: 1, fontWeight: 500 }}>
              {selectedTemplates.length > 1 ? 'Шаблоны (ротация)' : 'Шаблон'}
            </Typography>
            {selectedTemplates.length > 0 ? (
              <Stack spacing={1.5}>
                {selectedTemplates.map((template, index) => (
                  <Box key={template.id}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {selectedTemplates.length > 1 && (
                        <Typography 
                          variant="caption" 
                          sx={{ 
                            color: '#6366f1',
                            fontWeight: 600,
                            backgroundColor: 'rgba(99, 102, 241, 0.2)',
                            borderRadius: '50%',
                            minWidth: 20,
                            height: 20,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          {index + 1}
                        </Typography>
                      )}
                      <Typography variant="body1" fontWeight={500} sx={{ color: '#f5f5f5' }}>
                        {template.name}
                      </Typography>
                    </Box>
                    <Stack direction="row" spacing={1} sx={{ mt: 0.5, ml: selectedTemplates.length > 1 ? 3.5 : 0 }}>
                      <TemplateTypeBadge type={template.type} size="small" />
                      <TemplateMessengerBadge target={template.messengerTarget} size="small" />
                    </Stack>
                  </Box>
                ))}
                {selectedTemplates.length > 1 && (
                  <Alert 
                    severity="info" 
                    icon={<ShuffleIcon fontSize="small" />}
                    sx={{ 
                      mt: 1,
                      py: 0.5,
                      borderRadius: '8px',
                      backgroundColor: 'rgba(99, 102, 241, 0.1)',
                      color: 'rgba(255, 255, 255, 0.87)',
                      border: '1px solid rgba(99, 102, 241, 0.2)',
                      '& .MuiAlert-icon': {
                        color: '#6366f1',
                      },
                    }}
                  >
                    <Typography variant="caption">
                      Шаблоны будут чередоваться по порядку
                    </Typography>
                  </Alert>
                )}
              </Stack>
            ) : (
              <Typography sx={{ color: '#f44336' }}>Шаблон не выбран</Typography>
            )}
          </Paper>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
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

        <Grid size={{ xs: 12 }}>
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
