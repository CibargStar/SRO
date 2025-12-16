import React from 'react';
import { Box, Grid, Alert, CircularProgress, Typography, Stack, Card, CardContent, CardActionArea } from '@mui/material';
import CheckIcon from '@mui/icons-material/Check';
import { useFormContext } from 'react-hook-form';
import type { Template } from '@/types/template';
import { TemplateTypeBadge, MessengerTargetBadge as TemplateMessengerBadge } from '@/components/templates';

interface Props {
  templatesLoading: boolean;
  filteredTemplates: Template[];
  selectedTemplate: Template | null;
  onSelectTemplate: (template: Template) => void;
}

export function WizardStep2_SelectTemplate({ templatesLoading, filteredTemplates, selectedTemplate, onSelectTemplate }: Props) {
  const { formState: { errors } } = useFormContext();

  return (
    <Box>
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
          {filteredTemplates.map((template) => (
            <Grid item xs={12} sm={6} md={4} key={template.id}>
              <Card
                sx={{
                  backgroundColor: selectedTemplate?.id === template.id 
                    ? 'rgba(99, 102, 241, 0.15)' 
                    : 'rgba(255, 255, 255, 0.08)',
                  border: selectedTemplate?.id === template.id 
                    ? '2px solid rgba(99, 102, 241, 0.4)' 
                    : 'none',
                  borderRadius: '16px',
                  transition: 'all 0.2s',
                  '&:hover': {
                    backgroundColor: selectedTemplate?.id === template.id 
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
                      {selectedTemplate?.id === template.id && (
                        <CheckIcon sx={{ color: '#6366f1' }} />
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
          ))}
        </Grid>
      )}
      {errors.templateId && (
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
          {errors.templateId.message}
        </Alert>
      )}
    </Box>
  );
}

export default WizardStep2_SelectTemplate;




