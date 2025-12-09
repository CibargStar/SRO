import React, { useMemo } from 'react';
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

  const items = useMemo(
    () => (template.items || []).slice().sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0)),
    [template.items]
  );

  const handleAdd = async (type: 'TEXT' | 'FILE') => {
    await addItem.mutateAsync({
      templateId: template.id,
      data: { type, orderIndex: items.length },
    });
  };

  const move = async (from: number, to: number) => {
    if (to < 0 || to >= items.length) return;
    const reordered = [...items];
    const [removed] = reordered.splice(from, 1);
    reordered.splice(to, 0, removed);
    await reorderItems.mutateAsync({
      templateId: template.id,
      data: {
        items: reordered.map((item, idx) => ({ id: item.id, orderIndex: idx })),
      },
    });
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)' }}>
          Элементов: {items.length}/50
        </Typography>
        <AddItemButton
          onAddText={() => handleAdd('TEXT')}
          onAddFile={() => handleAdd('FILE')}
          disabled={addItem.isPending || items.length >= 50}
        />
      </Stack>

      {items.length === 0 && (
        <Alert severity="info" sx={{ borderColor: 'rgba(99,102,241,0.4)', backgroundColor: 'rgba(99,102,241,0.08)', color: '#cdd2ff' }}>
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



