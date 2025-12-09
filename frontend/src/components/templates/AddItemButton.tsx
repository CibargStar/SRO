import React from 'react';
import { Stack, Button } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import TextFieldsIcon from '@mui/icons-material/TextFields';
import AttachFileIcon from '@mui/icons-material/AttachFile';

interface AddItemButtonProps {
  onAddText: () => void;
  onAddFile: () => void;
  disabled?: boolean;
}

export function AddItemButton({ onAddText, onAddFile, disabled }: AddItemButtonProps) {
  return (
    <Stack direction="row" spacing={1}>
      <Button
        variant="outlined"
        startIcon={<TextFieldsIcon />}
        onClick={onAddText}
        disabled={disabled}
      >
        Текст
      </Button>
      <Button
        variant="outlined"
        startIcon={<AttachFileIcon />}
        onClick={onAddFile}
        disabled={disabled}
      >
        Файл
      </Button>
    </Stack>
  );
}

export default AddItemButton;



