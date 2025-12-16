import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogActions, MenuItem, CircularProgress, Alert, Box, Typography, FormControl, InputLabel } from '@mui/material';
import { CancelButton, StyledButton } from '@/components/common';
import { StyledSelect, MenuProps, selectInputLabelStyles } from '@/components/common/SelectStyles';
import { dialogPaperProps, dialogTitleStyles, dialogContentStyles, dialogActionsStyles } from '@/components/common/DialogStyles';
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
    if (open && categories?.length) {
      const nextCategory = currentCategoryId && categories.some((c) => c.id === currentCategoryId)
        ? currentCategoryId
        : categories[0].id;
      setCategoryId(nextCategory);
    } else if (open && !categories?.length) {
      // Если нет категорий, закрываем диалог
      onClose();
    }
  }, [categories, currentCategoryId, open, onClose]);

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
    <Dialog open={open} onClose={handleClose} PaperProps={dialogPaperProps}>
      <Box sx={dialogTitleStyles}>
        <Typography sx={{ color: '#fff', fontSize: '1.25rem', fontWeight: 500 }}>
          Переместить в категорию
        </Typography>
      </Box>
      <DialogContent sx={dialogContentStyles}>
        {moveTemplate.isError && (
          <Alert 
            severity="error" 
            sx={{ 
              mb: 2,
              borderRadius: '12px',
              backgroundColor: 'rgba(244, 67, 54, 0.1)',
              color: '#ffffff',
              border: 'none',
            }}
          >
            {(moveTemplate.error as Error)?.message || 'Не удалось переместить шаблон'}
          </Alert>
        )}
        <FormControl fullWidth>
          <InputLabel sx={selectInputLabelStyles}>Категория</InputLabel>
          <StyledSelect
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            label="Категория"
            MenuProps={MenuProps}
          >
            {categories?.map((cat) => (
              <MenuItem key={cat.id} value={cat.id}>
                {cat.name}
              </MenuItem>
            ))}
          </StyledSelect>
        </FormControl>
      </DialogContent>
      <DialogActions sx={dialogActionsStyles}>
        <CancelButton onClick={handleClose} disabled={moveTemplate.isPending}>Отмена</CancelButton>
        <StyledButton onClick={handleMove} disabled={moveTemplate.isPending || !categoryId}>
          {moveTemplate.isPending ? <CircularProgress size={18} color="inherit" /> : 'Переместить'}
        </StyledButton>
      </DialogActions>
    </Dialog>
  );
}

export default MoveToCategoryDialog;



