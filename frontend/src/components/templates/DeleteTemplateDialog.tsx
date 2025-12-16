import React from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Typography, CircularProgress, Alert } from '@mui/material';
import { CancelButton, StyledButton } from '@/components/common';
import { dialogPaperProps, dialogTitleStyles, dialogContentStyles, dialogActionsStyles } from '@/components/common/DialogStyles';

interface DeleteTemplateDialogProps {
  open: boolean;
  templateName?: string;
  onClose: () => void;
  onConfirm: () => void;
  isLoading?: boolean;
  error?: Error | null;
}

export function DeleteTemplateDialog({ open, templateName, onClose, onConfirm, isLoading, error }: DeleteTemplateDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} PaperProps={dialogPaperProps}>
      <DialogTitle sx={{ color: '#fff', ...dialogTitleStyles }}>Удаление шаблона</DialogTitle>
      <DialogContent sx={dialogContentStyles}>
        {error && (
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
            {error.message || 'Не удалось удалить шаблон'}
          </Alert>
        )}
        <Typography sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
          Вы уверены, что хотите удалить шаблон {templateName ? `"${templateName}"` : ''}? Это действие нельзя отменить.
        </Typography>
      </DialogContent>
      <DialogActions sx={dialogActionsStyles}>
        <CancelButton onClick={onClose} disabled={isLoading}>Отмена</CancelButton>
        <StyledButton
          onClick={onConfirm}
          disabled={isLoading}
          sx={{
            backgroundColor: '#f44336',
            color: '#ffffff',
            '&:hover': {
              backgroundColor: '#d32f2f',
            },
          }}
        >
          {isLoading ? <CircularProgress size={18} color="inherit" /> : 'Удалить'}
        </StyledButton>
      </DialogActions>
    </Dialog>
  );
}

export default DeleteTemplateDialog;




