import React, { useMemo, useState } from 'react';
import { Box, Checkbox, CircularProgress, FormControlLabel, Stack, TextField, Typography } from '@mui/material';
import { useProfiles } from '@/hooks/useProfiles';
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
      <TextField
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
        <Stack spacing={0.5} sx={{ maxHeight: 220, overflowY: 'auto', pr: 1 }}>
          {data?.data?.map((p) => (
            <FormControlLabel
              key={p.id}
              control={
                <Checkbox
                  checked={value.includes(p.id)}
                  onChange={() => toggle(p.id)}
                />
              }
              label={
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography variant="body2">{p.name}</Typography>
                  <ProfileAvailabilityIndicator status={p.status} isAvailable={p.isAvailable} />
                </Stack>
              }
            />
          )) || (
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.6)' }}>
              Профили не найдены
            </Typography>
          )}
        </Stack>
      )}
    </Box>
  );
}

export default ProfileSelector;



