import React from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Typography, Button, CircularProgress } from '@mui/material';
import { CancelButton } from '@/components/common';

interface DeleteTemplateDialogProps {
  open: boolean;
  templateName?: string;
  onClose: () => void;
  onConfirm: () => void;
  isLoading?: boolean;
}

export function DeleteTemplateDialog({ open, templateName, onClose, onConfirm, isLoading }: DeleteTemplateDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} PaperProps={{ sx: { backgroundColor: 'rgba(24,24,27,0.95)', borderRadius: 2 } }}>
      <DialogTitle sx={{ color: '#fff' }}>Удаление шаблона</DialogTitle>
      <DialogContent>
        <Typography sx={{ color: 'rgba(255,255,255,0.75)' }}>
          Вы уверены, что хотите удалить шаблон {templateName ? `“${templateName}”` : ''}? Это действие нельзя отменить.
        </Typography>
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <CancelButton onClick={onClose}>Отмена</CancelButton>
        <Button
          color="error"
          variant="contained"
          onClick={onConfirm}
          disabled={isLoading}
        >
          {isLoading ? <CircularProgress size={18} color="inherit" /> : 'Удалить'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default DeleteTemplateDialog;



