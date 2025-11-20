/**
 * Список телефонов клиента
 * 
 * Отображает список телефонов клиента с возможностью редактирования и удаления.
 */

import React, { useState } from 'react';
import { Box, Typography, IconButton, Chip, CircularProgress } from '@mui/material';
import { styled } from '@mui/material/styles';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import PhoneIcon from '@mui/icons-material/Phone';
import { useClientPhones, useDeleteClientPhone } from '@/hooks/useClientPhones';
import type { ClientPhone } from '@/types';
import { AddPhoneDialog } from './AddPhoneDialog';
import { EditPhoneDialog } from './EditPhoneDialog';

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

interface ClientPhonesListProps {
  clientId: string;
}

export function ClientPhonesList({ clientId }: ClientPhonesListProps) {
  const { data: phones = [], isLoading } = useClientPhones(clientId);
  const deleteMutation = useDeleteClientPhone();
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedPhone, setSelectedPhone] = useState<ClientPhone | null>(null);

  const handleEdit = (phone: ClientPhone) => {
    setSelectedPhone(phone);
    setEditDialogOpen(true);
  };

  const handleDelete = (phone: ClientPhone) => {
    if (window.confirm('Удалить этот телефон?')) {
      deleteMutation.mutate({ clientId, phoneId: phone.id });
    }
  };

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight={100}>
        <CircularProgress size={24} sx={{ color: '#f5f5f5' }} />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="subtitle2" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>
          Телефоны ({phones.length})
        </Typography>
        <StyledIconButton size="small" onClick={() => setAddDialogOpen(true)}>
          <PhoneIcon fontSize="small" />
        </StyledIconButton>
      </Box>

      {phones.length === 0 ? (
        <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.5)', textAlign: 'center', py: 2 }}>
          Нет телефонов
        </Typography>
      ) : (
        phones.map((phone) => (
          <PhoneItem key={phone.id}>
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
              <StyledIconButton size="small" onClick={() => handleEdit(phone)}>
                <EditIcon fontSize="small" />
              </StyledIconButton>
              <StyledIconButton size="small" onClick={() => handleDelete(phone)}>
                <DeleteIcon fontSize="small" />
              </StyledIconButton>
            </Box>
          </PhoneItem>
        ))
      )}

      <AddPhoneDialog open={addDialogOpen} clientId={clientId} onClose={() => setAddDialogOpen(false)} />
      <EditPhoneDialog
        open={editDialogOpen}
        clientId={clientId}
        phone={selectedPhone}
        onClose={() => {
          setEditDialogOpen(false);
          setSelectedPhone(null);
        }}
      />
    </Box>
  );
}

