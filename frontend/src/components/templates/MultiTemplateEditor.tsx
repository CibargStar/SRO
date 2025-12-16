import React, { useMemo, useState } from 'react';
import { Box, Stack, Alert, Typography, Divider } from '@mui/material';
import type { Template } from '@/types/template';
import { TemplateItemEditor } from './TemplateItemEditor';
import { AddItemButton } from './AddItemButton';
import { useAddTemplateItem, useReorderTemplateItems } from '@/hooks/useTemplates';

interface MultiTemplateEditorProps {
  template: Template;
}

export function MultiTemplateEditor({ template }: MultiTemplateEditorProps) {
  const addItem = useAddTemplateItem();
  const reorderItems = useReorderTemplateItems();
  const [error, setError] = useState<string | null>(null);

  const items = useMemo(
    () => (template.items || []).slice().sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0)),
    [template.items]
  );

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

  const move = async (from: number, to: number) => {
    // Валидация индексов
    if (from < 0 || from >= items.length || to < 0 || to >= items.length || from === to) {
      return;
    }
    setError(null);
    try {
      const reordered = [...items];
      const [removed] = reordered.splice(from, 1);
      reordered.splice(to, 0, removed);
      await reorderItems.mutateAsync({
        templateId: template.id,
        data: {
          items: reordered.map((item, idx) => ({ id: item.id, orderIndex: idx })),
        },
      });
    } catch (err) {
      setError((err as Error)?.message || 'Не удалось изменить порядок элементов');
    }
  };

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
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
        <Box
          sx={{
            px: 1.5,
            py: 0.5,
            borderRadius: '8px',
            backgroundColor: 'rgba(255, 255, 255, 0.06)',
          }}
        >
          <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '0.85rem' }}>
            Элементов: <Box component="span" sx={{ fontWeight: 600, color: '#f5f5f5' }}>{items.length}</Box>/50
          </Typography>
        </Box>
        <AddItemButton
          onAddText={() => handleAdd('TEXT')}
          onAddFile={() => handleAdd('FILE')}
          disabled={addItem.isPending || items.length >= 50}
        />
      </Stack>

      {items.length === 0 && (
        <Alert 
          severity="info" 
          sx={{ 
            borderRadius: '12px',
            border: 'none',
            backgroundColor: 'rgba(99, 102, 241, 0.12)',
            color: 'rgba(255, 255, 255, 0.9)',
          }}
        >
          Добавьте один или несколько элементов. Составной шаблон может содержать до 50 элементов.
        </Alert>
      )}

      {items.map((item, idx) => (
        <TemplateItemEditor
          key={item.id}
          templateId={template.id}
          item={item}
          index={idx}
          total={items.length}
          onMoveUp={() => move(idx, idx - 1)}
          onMoveDown={() => move(idx, idx + 1)}
        />
      ))}
    </Box>
  );
}

export default MultiTemplateEditor;




