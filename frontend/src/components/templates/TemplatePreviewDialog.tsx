import React from 'react';
import { Dialog, DialogTitle, DialogContent, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import type { Template } from '@/types/template';
import { TemplatePreview } from './TemplatePreview';

interface TemplatePreviewDialogProps {
  open: boolean;
  template: Template | null;
  onClose: () => void;
}

export function TemplatePreviewDialog({ open, template, onClose }: TemplatePreviewDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md" PaperProps={{ sx: { backgroundColor: 'rgba(24,24,27,0.98)' } }}>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#fff' }}>
        Предпросмотр шаблона
        <IconButton onClick={onClose} size="small" sx={{ color: 'rgba(255,255,255,0.7)' }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        {template && <TemplatePreview template={template} />}
      </DialogContent>
    </Dialog>
  );
}

export default TemplatePreviewDialog;



