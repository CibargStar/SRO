import React, { useState } from 'react';
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
  const [error, setError] = useState<string | null>(null);

  const handleAdd = async (type: 'TEXT' | 'FILE') => {
    setError(null);
    try {
      await addItem.mutateAsync({
        templateId: template.id,
        data: { type },
      });
    } catch (err) {
      setError((err as Error)?.message || 'Не удалось добавить элемент');
    }
  };

  const items = template.items || [];

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
      {error && (
        <Alert 
          severity="error" 
          sx={{ 
            borderRadius: '12px',
            backgroundColor: 'rgba(244, 67, 54, 0.1)',
            color: '#ffffff',
            border: 'none',
          }}
          onClose={() => setError(null)}
        >
          {error}
        </Alert>
      )}
      {items.length === 0 && (
        <>
          <Alert 
            severity="info" 
            sx={{ 
              borderRadius: '12px',
              border: 'none',
              backgroundColor: 'rgba(99, 102, 241, 0.12)',
              color: 'rgba(255, 255, 255, 0.9)',
            }}
          >
            Добавьте текст или файл для одиночного шаблона.
          </Alert>
          <Box sx={{ display: 'flex', justifyContent: 'center', pt: 1 }}>
            <AddItemButton
              onAddText={() => handleAdd('TEXT')}
              onAddFile={() => handleAdd('FILE')}
              disabled={addItem.isPending}
            />
          </Box>
        </>
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
          hideMoveButtons={true}
        />
      ))}
    </Box>
  );
}

export default SingleTemplateEditor;


