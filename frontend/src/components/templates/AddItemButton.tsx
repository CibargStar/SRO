import React from 'react';
import { Stack, Button, styled } from '@mui/material';
import TextFieldsIcon from '@mui/icons-material/TextFields';
import AttachFileIcon from '@mui/icons-material/AttachFile';

interface AddItemButtonProps {
  onAddText: () => void;
  onAddFile: () => void;
  disabled?: boolean;
}

const StyledAddButton = styled(Button)(({ theme }) => ({
  borderRadius: '10px',
  backgroundColor: 'rgba(255, 255, 255, 0.08)',
  color: 'rgba(255, 255, 255, 0.9)',
  border: 'none',
  textTransform: 'none',
  fontWeight: 500,
  padding: theme.spacing(1, 2),
  transition: 'all 0.2s ease',
  '&:hover': {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    transform: 'translateY(-1px)',
  },
  '&:disabled': {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    color: 'rgba(255, 255, 255, 0.4)',
  },
}));

export function AddItemButton({ onAddText, onAddFile, disabled }: AddItemButtonProps) {
  return (
    <Stack direction="row" spacing={1.5}>
      <StyledAddButton
        startIcon={<TextFieldsIcon />}
        onClick={onAddText}
        disabled={disabled}
      >
        Текст
      </StyledAddButton>
      <StyledAddButton
        startIcon={<AttachFileIcon />}
        onClick={onAddFile}
        disabled={disabled}
      >
        Файл
      </StyledAddButton>
    </Stack>
  );
}

export default AddItemButton;




