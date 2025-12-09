import React, { useState } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Typography, TextField, Button, CircularProgress, Alert } from '@mui/material';
import { CancelButton } from '@/components/common';
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
    <Dialog open={open} onClose={handleClose} PaperProps={{ sx: { backgroundColor: 'rgba(24,24,27,0.95)', borderRadius: 2 } }}>
      <DialogTitle sx={{ color: '#fff' }}>Дублировать шаблон</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Typography sx={{ color: 'rgba(255,255,255,0.7)' }}>
          Укажите имя для копии. Файлы и элементы будут перенесены.
        </Typography>
        {duplicate.isError && (
          <Alert severity="error">
            {(duplicate.error as Error)?.message || 'Не удалось создать копию'}
          </Alert>
        )}
        <TextField
          autoFocus
          label="Название"
          value={name}
          onChange={(e) => setName(e.target.value)}
          fullWidth
        />
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <CancelButton onClick={handleClose}>Отмена</CancelButton>
        <Button variant="contained" onClick={handleDuplicate} disabled={duplicate.isPending}>
          {duplicate.isPending ? <CircularProgress size={18} color="inherit" /> : 'Создать копию'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default DuplicateTemplateDialog;



