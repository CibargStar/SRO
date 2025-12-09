import React from 'react';
import { Box, Alert } from '@mui/material';
import type { Template } from '@/types/template';
import { TemplateItemEditor } from './TemplateItemEditor';
import { AddItemButton } from './AddItemButton';
import { useAddTemplateItem } from '@/hooks/useTemplates';

interface SingleTemplateEditorProps {
  template: Template;
}

export function SingleTemplateEditor({ template }: SingleTemplateEditorProps) {
  const addItem = useAddTemplateItem();

  const handleAdd = async (type: 'TEXT' | 'FILE') => {
    await addItem.mutateAsync({
      templateId: template.id,
      data: { type, orderIndex: 0 },
    });
  };

  const items = template.items || [];

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {items.length === 0 && (
        <Alert severity="info" sx={{ borderColor: 'rgba(99,102,241,0.4)', backgroundColor: 'rgba(99,102,241,0.08)', color: '#cdd2ff' }}>
          Добавьте текст или файл для одиночного шаблона.
        </Alert>
      )}

      {items.map((item, idx) => (
        <TemplateItemEditor
          key={item.id}
          templateId={template.id}
          item={item}
          index={idx}
          total={items.length}
          onMoveUp={() => {}}
          onMoveDown={() => {}}
        />
      ))}

      {items.length === 0 && (
        <AddItemButton
          onAddText={() => handleAdd('TEXT')}
          onAddFile={() => handleAdd('FILE')}
          disabled={addItem.isPending}
        />
      )}
    </Box>
  );
}

export default SingleTemplateEditor;


