import React, { useMemo, useState } from 'react';
import { Box, Checkbox, CircularProgress, FormControlLabel, Stack, Typography } from '@mui/material';
import { useProfiles } from '@/hooks/useProfiles';
import { StyledTextField } from '@/components/common';
import type { ListProfilesQuery } from '@/types';
import { ProfileAvailabilityIndicator } from './ProfileAvailabilityIndicator';

interface ProfileSelectorProps {
  value: string[];
  onChange: (ids: string[]) => void;
}

export function ProfileSelector({ value, onChange }: ProfileSelectorProps) {
  const [search, setSearch] = useState('');
  const query: ListProfilesQuery = useMemo(() => ({ search, limit: 50 }), [search]);
  const { data, isLoading } = useProfiles(query);

  const toggle = (id: string) => {
    if (value.includes(id)) {
      onChange(value.filter((v) => v !== id));
    } else {
      onChange([...value, id]);
    }
  };

  return (
    <Box>
      <StyledTextField
        size="small"
        label="Поиск профилей"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        fullWidth
        sx={{ mb: 1.5 }}
      />

      {isLoading ? (
        <Stack direction="row" alignItems="center" spacing={1} sx={{ py: 1 }}>
          <CircularProgress size={18} />
          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)' }}>
            Загрузка профилей...
          </Typography>
        </Stack>
      ) : (
        <Box
          sx={{
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            borderRadius: '12px',
            p: 1.5,
            maxHeight: 220,
            overflowY: 'auto',
            '&::-webkit-scrollbar': {
              display: 'none',
              width: 0,
              height: 0,
            },
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
          }}
        >
          <Stack spacing={0.5}>
            {data?.data && data.data.length > 0 ? (
              data.data.map((p) => {
                // Вычисляем isAvailable на основе статуса профиля
                // Профиль доступен если он RUNNING и не используется в других кампаниях
                const isAvailable = p.status === 'RUNNING' && !p.isInCampaign;
                
                return (
                  <FormControlLabel
                    key={p.id}
                    control={
                      <Checkbox
                        checked={value.includes(p.id)}
                        onChange={() => toggle(p.id)}
                        sx={{
                          color: '#6366f1',
                          '&.Mui-checked': {
                            color: '#6366f1',
                          },
                        }}
                      />
                    }
                    label={
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>{p.name}</Typography>
                        <ProfileAvailabilityIndicator status={p.status} isAvailable={isAvailable} />
                      </Stack>
                    }
                  sx={{
                    borderRadius: '8px',
                    px: 1,
                    py: 0.5,
                    '&:hover': {
                      backgroundColor: 'rgba(255, 255, 255, 0.05)',
                    },
                  }}
                />
                );
              })
            ) : (
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.6)', textAlign: 'center', py: 2 }}>
                Профили не найдены
              </Typography>
            )}
          </Stack>
        </Box>
      )}
    </Box>
  );
}

export default ProfileSelector;




