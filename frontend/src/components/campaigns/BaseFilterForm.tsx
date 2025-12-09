import React from 'react';
import { Box, FormControlLabel, Checkbox, TextField, Stack, Typography } from '@mui/material';
import type { FilterConfig } from '@/types/campaign';

interface BaseFilterFormProps {
  value: FilterConfig;
  onChange: (value: FilterConfig) => void;
}

export function BaseFilterForm({ value, onChange }: BaseFilterFormProps) {
  const update = (patch: Partial<FilterConfig>) => onChange({ ...value, ...patch });

  return (
    <Stack spacing={2}>
      <Typography variant="subtitle2" sx={{ color: '#fff' }}>
        Фильтры базы
      </Typography>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
        <TextField
          label="Лимит контактов"
          type="number"
          value={value.limitContacts ?? ''}
          onChange={(e) => update({ limitContacts: e.target.value ? Number(e.target.value) : undefined })}
          fullWidth
        />
        <TextField
          label="Макс. кол-во кампаний (фильтр)"
          type="number"
          value={value.maxCampaignCount ?? ''}
          onChange={(e) => update({ maxCampaignCount: e.target.value ? Number(e.target.value) : undefined })}
          fullWidth
        />
      </Stack>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
        <TextField
          label="Дата последней кампании до"
          type="date"
          InputLabelProps={{ shrink: true }}
          value={value.lastCampaignBefore ?? ''}
          onChange={(e) => update({ lastCampaignBefore: e.target.value || undefined })}
          fullWidth
        />
        <TextField
          label="Дата последней кампании после"
          type="date"
          InputLabelProps={{ shrink: true }}
          value={value.lastCampaignAfter ?? ''}
          onChange={(e) => update({ lastCampaignAfter: e.target.value || undefined })}
          fullWidth
        />
      </Stack>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
        <TextField
          label="Статусы клиентов (через запятую)"
          value={value.clientStatuses?.join(',') ?? ''}
          onChange={(e) => update({ clientStatuses: e.target.value ? e.target.value.split(',').map(s => s.trim()) : undefined })}
          fullWidth
        />
        <TextField
          label="Статусы WhatsApp (через запятую)"
          value={value.whatsAppStatus?.join(',') ?? ''}
          onChange={(e) => update({ whatsAppStatus: e.target.value ? e.target.value.split(',').map(s => s.trim()) : undefined })}
          fullWidth
        />
        <TextField
          label="Статусы Telegram (через запятую)"
          value={value.telegramStatus?.join(',') ?? ''}
          onChange={(e) => update({ telegramStatus: e.target.value ? e.target.value.split(',').map(s => s.trim()) : undefined })}
          fullWidth
        />
      </Stack>

      <Box>
        <FormControlLabel
          control={
            <Checkbox
              checked={value.neverCampaigned || false}
              onChange={(e) => update({ neverCampaigned: e.target.checked })}
            />
          }
          label="Только клиенты без предыдущих кампаний"
        />
        <FormControlLabel
          control={
            <Checkbox
              checked={value.randomOrder || false}
              onChange={(e) => update({ randomOrder: e.target.checked })}
            />
          }
          label="Случайный порядок"
        />
      </Box>
    </Stack>
  );
}

export default BaseFilterForm;



