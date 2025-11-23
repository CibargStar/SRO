/**
 * Поле формы для управления телефонами клиента
 * 
 * Компонент для добавления, редактирования и удаления телефонов в форме создания/редактирования клиента.
 */

import React, { useState } from 'react';
import { Box, IconButton, Chip, Typography, FormControl, InputLabel, MenuItem } from '@mui/material';
import { styled } from '@mui/material/styles';
import { StyledTextField, StyledSelect } from './common/FormStyles';
import { MenuProps, selectInputLabelStyles } from './common/SelectStyles';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import PhoneIcon from '@mui/icons-material/Phone';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
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

import type { MessengerStatus } from '@/types';

interface PhoneItem {
  id: string;
  phone: string;
  whatsAppStatus?: MessengerStatus;
  telegramStatus?: MessengerStatus;
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
        whatsAppStatus: 'Unknown',
        telegramStatus: 'Unknown',
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

  const handleEditPhone = (id: string, newPhoneValue: string, whatsAppStatus?: MessengerStatus, telegramStatus?: MessengerStatus) => {
    try {
      const validated = createClientPhoneSchema.parse({ phone: newPhoneValue.trim() });
      
      onChange(
        phones.map((p) => (p.id === id ? { 
          ...p, 
          phone: validated.phone,
          whatsAppStatus: whatsAppStatus ?? p.whatsAppStatus ?? 'Unknown',
          telegramStatus: telegramStatus ?? p.telegramStatus ?? 'Unknown',
        } : p))
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

  const handleSaveEdit = (id: string) => {
    const phone = phones.find((p) => p.id === id);
    if (phone) {
      handleEditPhone(id, phone.phone, phone.whatsAppStatus, phone.telegramStatus);
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
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, flex: 1 }}>
              <StyledTextField
                size="small"
                value={phone.phone}
                onChange={(e) => {
                  const updated = phones.map((p) =>
                    p.id === phone.id ? { ...p, phone: e.target.value } : p
                  );
                  onChange(updated);
                }}
                onKeyPress={(e) => handleKeyPress(e, () => handleSaveEdit(phone.id))}
                autoFocus
                fullWidth
                error={!!error}
                helperText={error}
                placeholder="+7 (999) 123-45-67"
              />
              <Box sx={{ display: 'flex', gap: 1.5 }}>
                <FormControl fullWidth size="small">
                  <InputLabel id={`whatsapp-${phone.id}`} sx={selectInputLabelStyles}>
                    WhatsApp
                  </InputLabel>
                  <StyledSelect
                    labelId={`whatsapp-${phone.id}`}
                    label="WhatsApp"
                    value={phone.whatsAppStatus || 'Unknown'}
                    onChange={(e) => {
                      const updated = phones.map((p) =>
                        p.id === phone.id ? { ...p, whatsAppStatus: e.target.value as MessengerStatus } : p
                      );
                      onChange(updated);
                    }}
                    MenuProps={MenuProps}
                  >
                    <MenuItem value="Unknown">Неизвестно</MenuItem>
                    <MenuItem value="Valid">Валиден</MenuItem>
                    <MenuItem value="Invalid">Невалиден</MenuItem>
                  </StyledSelect>
                </FormControl>
                <FormControl fullWidth size="small">
                  <InputLabel id={`telegram-${phone.id}`} sx={selectInputLabelStyles}>
                    Telegram
                  </InputLabel>
                  <StyledSelect
                    labelId={`telegram-${phone.id}`}
                    label="Telegram"
                    value={phone.telegramStatus || 'Unknown'}
                    onChange={(e) => {
                      const updated = phones.map((p) =>
                        p.id === phone.id ? { ...p, telegramStatus: e.target.value as MessengerStatus } : p
                      );
                      onChange(updated);
                    }}
                    MenuProps={MenuProps}
                  >
                    <MenuItem value="Unknown">Неизвестно</MenuItem>
                    <MenuItem value="Valid">Валиден</MenuItem>
                    <MenuItem value="Invalid">Невалиден</MenuItem>
                  </StyledSelect>
                </FormControl>
              </Box>
              <Box sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end', mt: 0.5 }}>
                <StyledIconButton size="small" onClick={() => handleSaveEdit(phone.id)}>
                  <CheckIcon fontSize="small" />
                </StyledIconButton>
                <StyledIconButton size="small" onClick={() => setEditingId(null)}>
                  <CloseIcon fontSize="small" />
                </StyledIconButton>
              </Box>
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

