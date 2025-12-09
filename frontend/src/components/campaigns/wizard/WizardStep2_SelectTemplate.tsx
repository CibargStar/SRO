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
        <Alert severity="warning">
          Нет доступных шаблонов для выбранного типа мессенджера.
        </Alert>
      ) : (
        <Grid container spacing={2}>
          {filteredTemplates.map((template) => (
            <Grid item xs={12} sm={6} md={4} key={template.id}>
              <Card
                variant={selectedTemplate?.id === template.id ? 'elevation' : 'outlined'}
                sx={{
                  border: selectedTemplate?.id === template.id ? 2 : 1,
                  borderColor: selectedTemplate?.id === template.id ? 'primary.main' : 'divider',
                  transition: 'all 0.2s',
                }}
              >
                <CardActionArea onClick={() => onSelectTemplate(template)}>
                  <CardContent>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="subtitle1" fontWeight={500}>
                        {template.name}
                      </Typography>
                      {selectedTemplate?.id === template.id && (
                        <CheckIcon color="primary" />
                      )}
                    </Box>
                    
                    <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
                      <TemplateTypeBadge type={template.type} size="small" />
                      <TemplateMessengerBadge target={template.messengerTarget} size="small" />
                    </Stack>
                    
                    {template.description && (
                      <Typography variant="body2" color="text.secondary" noWrap>
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
      {(errors as any)?.templateId && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {(errors as any)?.templateId?.message}
        </Alert>
      )}
    </Box>
  );
}

export default WizardStep2_SelectTemplate;



