import React from 'react';
import { Box, Divider, Stack, Typography } from '@mui/material';
import type { Template } from '@/types/template';
import { SingleTemplateEditor } from './SingleTemplateEditor';
import { MultiTemplateEditor } from './MultiTemplateEditor';

interface TemplateEditorProps {
  template: Template;
}

/**
 * Обертка для редакторов шаблонов.
 * В зависимости от типа шаблона выбирает корректный UI.
 */
export function TemplateEditor({ template }: TemplateEditorProps) {
  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h5" sx={{ color: '#fff', fontWeight: 600 }}>
          Редактор шаблона
        </Typography>
        <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.6)' }}>
          Тип: {template.type === 'SINGLE' ? 'Одиночный' : 'Составной'}
        </Typography>
      </Stack>
      <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)', mb: 2 }} />
      {template.type === 'SINGLE' ? (
        <SingleTemplateEditor template={template} />
      ) : (
        <MultiTemplateEditor template={template} />
      )}
    </Box>
  );
}

export default TemplateEditor;



