import React from 'react';
import { Box, Grid, Alert, CircularProgress, Typography, Stack, Card, CardContent, CardActionArea, Chip } from '@mui/material';
import CheckIcon from '@mui/icons-material/Check';
import ShuffleIcon from '@mui/icons-material/Shuffle';
import { useFormContext } from 'react-hook-form';
import type { Template } from '@/types/template';
import { TemplateTypeBadge, MessengerTargetBadge as TemplateMessengerBadge } from '@/components/templates';

interface Props {
  templatesLoading: boolean;
  filteredTemplates: Template[];
  selectedTemplates: Template[];
  onSelectTemplate: (template: Template) => void;
}

export function WizardStep2_SelectTemplate({ templatesLoading, filteredTemplates, selectedTemplates, onSelectTemplate }: Props) {
  const { formState: { errors } } = useFormContext();

  // Проверяем, выбран ли шаблон
  const isSelected = (templateId: string) => selectedTemplates.some(t => t.id === templateId);
  
  // Получаем индекс шаблона в порядке ротации
  const getSelectionIndex = (templateId: string) => selectedTemplates.findIndex(t => t.id === templateId);

  return (
    <Box>
      {/* Подсказка о множественном выборе */}
      {selectedTemplates.length > 0 && (
        <Alert 
          severity="info"
          icon={<ShuffleIcon />}
          sx={{
            mb: 2,
            borderRadius: '12px',
            backgroundColor: 'rgba(99, 102, 241, 0.1)',
            color: 'rgba(255, 255, 255, 0.87)',
            border: '1px solid rgba(99, 102, 241, 0.3)',
            '& .MuiAlert-icon': {
              color: '#6366f1',
            },
          }}
        >
          <Typography variant="body2">
            <strong>Выбрано шаблонов: {selectedTemplates.length}</strong>
            {selectedTemplates.length > 1 && (
              <> — при рассылке шаблоны будут чередоваться (round-robin)</>
            )}
          </Typography>
          {selectedTemplates.length > 1 && (
            <Stack direction="row" spacing={1} sx={{ mt: 1, flexWrap: 'wrap', gap: 0.5 }}>
              {selectedTemplates.map((t, idx) => (
                <Chip
                  key={t.id}
                  label={`${idx + 1}. ${t.name}`}
                  size="small"
                  sx={{
                    backgroundColor: 'rgba(99, 102, 241, 0.2)',
                    color: '#fff',
                    fontSize: '0.75rem',
                  }}
                />
              ))}
            </Stack>
          )}
        </Alert>
      )}

      {templatesLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      ) : filteredTemplates.length === 0 ? (
        <Alert 
          severity="warning"
          sx={{
            borderRadius: '12px',
            backgroundColor: 'rgba(255, 152, 0, 0.1)',
            color: '#ff9800',
            border: '1px solid rgba(255, 152, 0, 0.2)',
          }}
        >
          Нет доступных шаблонов для выбранного типа мессенджера.
        </Alert>
      ) : (
        <Grid container spacing={2}>
          {filteredTemplates.map((template) => {
            const selected = isSelected(template.id);
            const selectionIndex = getSelectionIndex(template.id);
            
            return (
              <Grid item xs={12} sm={6} md={4} key={template.id}>
                <Card
                  sx={{
                    backgroundColor: selected 
                      ? 'rgba(99, 102, 241, 0.15)' 
                      : 'rgba(255, 255, 255, 0.08)',
                    border: selected 
                      ? '2px solid rgba(99, 102, 241, 0.4)' 
                      : 'none',
                    borderRadius: '16px',
                    transition: 'all 0.2s',
                    position: 'relative',
                    '&:hover': {
                      backgroundColor: selected 
                        ? 'rgba(99, 102, 241, 0.2)' 
                        : 'rgba(255, 255, 255, 0.1)',
                      transform: 'translateY(-2px)',
                      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)',
                    },
                  }}
                >
                  <CardActionArea onClick={() => onSelectTemplate(template)}>
                    <CardContent>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                        <Typography variant="subtitle1" fontWeight={500} sx={{ color: '#f5f5f5' }}>
                          {template.name}
                        </Typography>
                        {selected && (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            {selectedTemplates.length > 1 && (
                              <Typography 
                                variant="caption" 
                                sx={{ 
                                  color: '#6366f1',
                                  fontWeight: 600,
                                  backgroundColor: 'rgba(99, 102, 241, 0.2)',
                                  borderRadius: '50%',
                                  width: 20,
                                  height: 20,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                }}
                              >
                                {selectionIndex + 1}
                              </Typography>
                            )}
                            <CheckIcon sx={{ color: '#6366f1' }} />
                          </Box>
                        )}
                      </Box>
                      
                      <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
                        <TemplateTypeBadge type={template.type} size="small" />
                        <TemplateMessengerBadge target={template.messengerTarget} size="small" />
                      </Stack>
                      
                      {template.description && (
                        <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.6)' }} noWrap>
                          {template.description}
                        </Typography>
                      )}
                    </CardContent>
                  </CardActionArea>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      )}
      {errors.templateIds && (
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
          {(errors.templateIds as { message?: string })?.message || 'Выберите хотя бы один шаблон'}
        </Alert>
      )}
    </Box>
  );
}

export default WizardStep2_SelectTemplate;
