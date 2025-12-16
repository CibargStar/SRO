import React from 'react';
import { Box, Stack } from '@mui/material';
import { StyledTextField } from '@/components/common/FormStyles';

export interface PreviewClientData {
  firstName?: string;
  lastName?: string;
  phone?: string;
}

interface PreviewClientSelectorProps {
  value: PreviewClientData;
  onChange: (data: PreviewClientData) => void;
}

export function PreviewClientSelector({ value, onChange }: PreviewClientSelectorProps) {
  const handleChange = (field: keyof PreviewClientData) => (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({ ...value, [field]: e.target.value });
  };

  return (
    <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
      <StyledTextField
        size="small"
        label="Имя"
        value={value.firstName || ''}
        onChange={handleChange('firstName')}
        sx={{ flex: '1 1 200px', minWidth: 150 }}
      />
      <StyledTextField
        size="small"
        label="Фамилия"
        value={value.lastName || ''}
        onChange={handleChange('lastName')}
        sx={{ flex: '1 1 200px', minWidth: 150 }}
      />
      <StyledTextField
        size="small"
        label="Телефон"
        value={value.phone || ''}
        onChange={handleChange('phone')}
        sx={{ flex: '1 1 200px', minWidth: 150 }}
      />
    </Stack>
  );
}

export default PreviewClientSelector;




