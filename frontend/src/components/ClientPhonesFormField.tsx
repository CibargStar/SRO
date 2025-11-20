/**
 * Поле формы для управления телефонами клиента
 * 
 * Компонент для добавления, редактирования и удаления телефонов в форме создания/редактирования клиента.
 */

import React, { useState } from 'react';
import { Box, TextField, IconButton, Chip, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import PhoneIcon from '@mui/icons-material/Phone';
import { createClientPhoneSchema } from '@/schemas/client-phone.schema';

const PhoneItem = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: theme.spacing(1.5, 2),
  borderRadius: '8px',
  backgroundColor: 'rgba(255, 255, 255, 0.05)',
  marginBottom: theme.spacing(1),
  transition: 'background-color 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  '&:hover': {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
}));

const StyledTextField = styled(TextField)({
  '& .MuiOutlinedInput-root': {
    borderRadius: '12px',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    color: '#ffffff',
    '& fieldset': { border: 'none' },
    '&:hover fieldset': { border: 'none' },
    '&.Mui-focused fieldset': { border: 'none' },
  },
  '& .MuiInputLabel-root': { color: 'rgba(255, 255, 255, 0.7)' },
  '& .MuiInputLabel-root.Mui-focused': { color: 'rgba(255, 255, 255, 0.9)' },
});

const StyledIconButton = styled(IconButton)({
  color: 'rgba(255, 255, 255, 0.7)',
  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  '&:hover': {
    color: '#ffffff',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
});

const AddPhoneBox = styled(Box)(({ theme }) => ({
  display: 'flex',
  gap: theme.spacing(1),
  alignItems: 'flex-start',
  marginTop: theme.spacing(1),
}));

interface PhoneItem {
  id: string;
  phone: string;
  isNew?: boolean; // Флаг для новых телефонов (еще не сохраненных)
}

interface ClientPhonesFormFieldProps {
  phones: PhoneItem[];
  onChange: (phones: PhoneItem[]) => void;
}

export function ClientPhonesFormField({ phones, onChange }: ClientPhonesFormFieldProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newPhone, setNewPhone] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleAddPhone = () => {
    if (!newPhone.trim()) {
      setError('Номер телефона не может быть пустым');
      return;
    }

    try {
      // Валидация через Zod схему
      const validated = createClientPhoneSchema.parse({ phone: newPhone.trim() });
      
      const phoneItem: PhoneItem = {
        id: `temp-${Date.now()}-${Math.random()}`,
        phone: validated.phone,
        isNew: true,
      };

      onChange([...phones, phoneItem]);
      setNewPhone('');
      setError(null);
    } catch (err) {
      if (err && typeof err === 'object' && 'errors' in err) {
        const zodError = err as { errors: Array<{ message: string }> };
        setError(zodError.errors[0]?.message || 'Неверный формат номера телефона');
      } else {
        setError('Неверный формат номера телефона');
      }
    }
  };

  const handleEditPhone = (id: string, newPhoneValue: string) => {
    try {
      const validated = createClientPhoneSchema.parse({ phone: newPhoneValue.trim() });
      
      onChange(
        phones.map((p) => (p.id === id ? { ...p, phone: validated.phone } : p))
      );
      setEditingId(null);
      setError(null);
    } catch (err) {
      if (err && typeof err === 'object' && 'errors' in err) {
        const zodError = err as { errors: Array<{ message: string }> };
        setError(zodError.errors[0]?.message || 'Неверный формат номера телефона');
      } else {
        setError('Неверный формат номера телефона');
      }
    }
  };

  const handleDeletePhone = (id: string) => {
    onChange(phones.filter((p) => p.id !== id));
  };

  const handleKeyPress = (e: React.KeyboardEvent, action: () => void) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      action();
    }
  };

  return (
    <Box>
      <Typography variant="subtitle2" sx={{ color: 'rgba(255, 255, 255, 0.7)', mb: 1 }}>
        Телефоны
      </Typography>

      {phones.map((phone) => (
        <PhoneItem key={phone.id}>
          {editingId === phone.id ? (
            <Box sx={{ display: 'flex', gap: 1, flex: 1, alignItems: 'center' }}>
              <StyledTextField
                size="small"
                value={phone.phone}
                onChange={(e) => {
                  const updated = phones.map((p) =>
                    p.id === phone.id ? { ...p, phone: e.target.value } : p
                  );
                  onChange(updated);
                }}
                onBlur={() => handleEditPhone(phone.id, phone.phone)}
                onKeyPress={(e) => handleKeyPress(e, () => handleEditPhone(phone.id, phone.phone))}
                autoFocus
                fullWidth
                error={!!error}
                helperText={error}
              />
            </Box>
          ) : (
            <>
              <Chip
                icon={<PhoneIcon />}
                label={phone.phone}
                sx={{
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                  color: '#ffffff',
                  border: 'none',
                }}
              />
              <Box>
                <StyledIconButton size="small" onClick={() => setEditingId(phone.id)}>
                  <EditIcon fontSize="small" />
                </StyledIconButton>
                <StyledIconButton size="small" onClick={() => handleDeletePhone(phone.id)}>
                  <DeleteIcon fontSize="small" />
                </StyledIconButton>
              </Box>
            </>
          )}
        </PhoneItem>
      ))}

      <AddPhoneBox>
        <StyledTextField
          size="small"
          placeholder="+7 (999) 123-45-67"
          value={newPhone}
          onChange={(e) => {
            setNewPhone(e.target.value);
            setError(null);
          }}
          onKeyPress={(e) => handleKeyPress(e, handleAddPhone)}
          error={!!error}
          helperText={error}
          fullWidth
        />
        <StyledIconButton onClick={handleAddPhone} sx={{ mt: 0.5 }}>
          <AddIcon />
        </StyledIconButton>
      </AddPhoneBox>
    </Box>
  );
}

