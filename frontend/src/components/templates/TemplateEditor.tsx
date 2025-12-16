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
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Typography variant="h6" sx={{ color: '#f5f5f5', fontWeight: 500, fontSize: '1.1rem' }}>
          Редактор шаблона
        </Typography>
        <Box
          sx={{
            px: 1.5,
            py: 0.5,
            borderRadius: '8px',
            backgroundColor: 'rgba(99, 102, 241, 0.15)',
            border: '1px solid rgba(99, 102, 241, 0.3)',
          }}
        >
          <Typography variant="body2" sx={{ color: '#818cf8', fontSize: '0.8rem', fontWeight: 500 }}>
            {template.type === 'SINGLE' ? 'Одиночный' : 'Составной'}
          </Typography>
        </Box>
      </Stack>
      <Divider sx={{ borderColor: 'rgba(255, 255, 255, 0.08)', mb: 3 }} />
      {template.type === 'SINGLE' ? (
        <SingleTemplateEditor template={template} />
      ) : (
        <MultiTemplateEditor template={template} />
      )}
    </Box>
  );
}

export default TemplateEditor;




