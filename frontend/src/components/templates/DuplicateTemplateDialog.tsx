import React, { useState } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Typography, CircularProgress, Alert, Box } from '@mui/material';
import { CancelButton, StyledButton, StyledTextField } from '@/components/common';
import { dialogPaperProps, dialogTitleStyles, dialogContentStyles, dialogActionsStyles } from '@/components/common/DialogStyles';
import { useDuplicateTemplate } from '@/hooks/useTemplates';

interface DuplicateTemplateDialogProps {
  open: boolean;
  templateId: string | null;
  defaultName?: string;
  onClose: () => void;
  onSuccess?: (newId: string) => void;
}

export function DuplicateTemplateDialog({ open, templateId, defaultName, onClose, onSuccess }: DuplicateTemplateDialogProps) {
  const [name, setName] = useState(defaultName || '');
  const duplicate = useDuplicateTemplate();

  const handleClose = () => {
    setName(defaultName || '');
    duplicate.reset();
    onClose();
  };

  const handleDuplicate = async () => {
    if (!templateId) return;
    try {
      const tpl = await duplicate.mutateAsync({ templateId, name });
      onSuccess?.(tpl.id);
      handleClose();
    } catch (error) {
      // handled in mutation
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} PaperProps={dialogPaperProps}>
      <Box sx={dialogTitleStyles}>
        <Typography sx={{ color: '#fff', fontSize: '1.25rem', fontWeight: 500 }}>
          Дублировать шаблон
        </Typography>
      </Box>
      <DialogContent sx={dialogContentStyles}>
        <Typography sx={{ color: 'rgba(255, 255, 255, 0.7)', mb: 2 }}>
          Укажите имя для копии. Файлы и элементы будут перенесены.
        </Typography>
        {duplicate.isError && (
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
            {(duplicate.error as Error)?.message || 'Не удалось создать копию'}
          </Alert>
        )}
        <StyledTextField
          autoFocus
          label="Название"
          value={name}
          onChange={(e) => setName(e.target.value)}
          fullWidth
        />
      </DialogContent>
      <DialogActions sx={dialogActionsStyles}>
        <CancelButton onClick={handleClose} disabled={duplicate.isPending}>Отмена</CancelButton>
        <StyledButton onClick={handleDuplicate} disabled={duplicate.isPending}>
          {duplicate.isPending ? <CircularProgress size={18} color="inherit" /> : 'Создать копию'}
        </StyledButton>
      </DialogActions>
    </Dialog>
  );
}

export default DuplicateTemplateDialog;




