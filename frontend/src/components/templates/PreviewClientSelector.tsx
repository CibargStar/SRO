import React from 'react';
import { Box, Stack, TextField, Typography } from '@mui/material';

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
    <Box>
      <Typography variant="subtitle2" sx={{ color: '#fff', mb: 1 }}>
        Данные клиента для подстановки переменных
      </Typography>
      <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
        <TextField
          size="small"
          label="Имя"
          value={value.firstName || ''}
          onChange={handleChange('firstName')}
        />
        <TextField
          size="small"
          label="Фамилия"
          value={value.lastName || ''}
          onChange={handleChange('lastName')}
        />
        <TextField
          size="small"
          label="Телефон"
          value={value.phone || ''}
          onChange={handleChange('phone')}
        />
      </Stack>
    </Box>
  );
}

export default PreviewClientSelector;



