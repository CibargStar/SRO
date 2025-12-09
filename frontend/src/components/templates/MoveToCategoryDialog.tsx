import React, { useState, useEffect } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, MenuItem, TextField, CircularProgress, Alert } from '@mui/material';
import { CancelButton } from '@/components/common';
import { useTemplateCategories, useMoveTemplate } from '@/hooks/useTemplates';

interface MoveToCategoryDialogProps {
  open: boolean;
  templateId: string | null;
  currentCategoryId: string | null | undefined;
  onClose: () => void;
}

export function MoveToCategoryDialog({ open, templateId, currentCategoryId, onClose }: MoveToCategoryDialogProps) {
  const { data: categories } = useTemplateCategories();
  const moveTemplate = useMoveTemplate();
  const [categoryId, setCategoryId] = useState<string | ''>(currentCategoryId || '');

  useEffect(() => {
    if (categories?.length) {
      const nextCategory = currentCategoryId && categories.some((c) => c.id === currentCategoryId)
        ? currentCategoryId
        : categories[0].id;
      setCategoryId(nextCategory);
    } else {
      setCategoryId('');
    }
  }, [categories, currentCategoryId, open]);

  const handleMove = async () => {
    if (!templateId || !categoryId) return;
    await moveTemplate.mutateAsync({
      templateId,
      data: { categoryId },
    });
    onClose();
  };

  const handleClose = () => {
    moveTemplate.reset();
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} PaperProps={{ sx: { backgroundColor: 'rgba(24,24,27,0.95)', borderRadius: 2, minWidth: 360 } }}>
      <DialogTitle sx={{ color: '#fff' }}>Переместить в категорию</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {moveTemplate.isError && (
          <Alert severity="error">
            {(moveTemplate.error as Error)?.message || 'Не удалось переместить шаблон'}
          </Alert>
        )}
        <TextField
          select
          label="Категория"
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          fullWidth
        >
          {categories?.map((cat) => (
            <MenuItem key={cat.id} value={cat.id}>
              {cat.name}
            </MenuItem>
          ))}
        </TextField>
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <CancelButton onClick={handleClose}>Отмена</CancelButton>
        <Button variant="contained" onClick={handleMove} disabled={moveTemplate.isPending || !categoryId}>
          {moveTemplate.isPending ? <CircularProgress size={18} color="inherit" /> : 'Переместить'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default MoveToCategoryDialog;



