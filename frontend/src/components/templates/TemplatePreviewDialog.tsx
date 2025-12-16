import React from 'react';
import { Dialog, DialogContent, IconButton, Box, Typography } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import type { Template } from '@/types/template';
import { TemplatePreview } from './TemplatePreview';
import { dialogPaperProps, dialogTitleStyles, dialogContentStyles } from '@/components/common/DialogStyles';

interface TemplatePreviewDialogProps {
  open: boolean;
  template: Template | null;
  onClose: () => void;
}

export function TemplatePreviewDialog({ open, template, onClose }: TemplatePreviewDialogProps) {
  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      fullWidth 
      maxWidth="md" 
      PaperProps={{
        ...dialogPaperProps,
        sx: {
          ...dialogPaperProps.sx,
          borderRadius: '16px',
        },
      }}
    >
      <Box sx={{ ...dialogTitleStyles, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255, 255, 255, 0.08)' }}>
        <Typography sx={{ color: '#f5f5f5', fontSize: '1.25rem', fontWeight: 500 }}>
          Предпросмотр шаблона
        </Typography>
        <IconButton 
          onClick={onClose} 
          size="small" 
          sx={{ 
            color: 'rgba(255, 255, 255, 0.7)',
            '&:hover': {
              color: '#ffffff',
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
            },
          }}
        >
          <CloseIcon />
        </IconButton>
      </Box>
      <DialogContent sx={{ ...dialogContentStyles, pt: 3 }}>
        {template && <TemplatePreview template={template} />}
      </DialogContent>
    </Dialog>
  );
}

export default TemplatePreviewDialog;




