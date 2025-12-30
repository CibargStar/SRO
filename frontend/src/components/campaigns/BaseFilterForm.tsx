import React from 'react';
import { Box, FormControlLabel, Checkbox, Stack, Typography } from '@mui/material';
import { StyledTextField } from '@/components/common';
import { RegionMultiSelect } from '@/components/RegionMultiSelect';
import type { FilterConfig } from '@/types/campaign';

interface BaseFilterFormProps {
  value: FilterConfig;
  onChange: (value: FilterConfig) => void;
}

export function BaseFilterForm({ value, onChange }: BaseFilterFormProps) {
  const update = (patch: Partial<FilterConfig>) => onChange({ ...value, ...patch });

  return (
    <Stack spacing={2}>
      <Typography variant="subtitle2" sx={{ color: '#f5f5f5', fontWeight: 500 }}>
        Фильтры базы
      </Typography>

      <Box>
        <RegionMultiSelect
          value={value.regionIds || []}
          onChange={(regionIds) => update({ regionIds: regionIds.length > 0 ? regionIds : undefined })}
          label="Регионы"
          fullWidth
        />
        <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.5)', mt: 0.5, display: 'block' }}>
          Выберите "Все регионы" или конкретные регионы для фильтрации клиентов.
        </Typography>
      </Box>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
        <StyledTextField
          label="Лимит контактов"
          type="number"
          value={value.limitContacts ?? ''}
          onChange={(e) => update({ limitContacts: e.target.value ? Number(e.target.value) : undefined })}
          fullWidth
        />
        <StyledTextField
          label="Макс. кол-во кампаний (фильтр)"
          type="number"
          value={value.maxCampaignCount ?? ''}
          onChange={(e) => update({ maxCampaignCount: e.target.value ? Number(e.target.value) : undefined })}
          fullWidth
        />
      </Stack>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
        <StyledTextField
          label="Дата последней кампании до"
          type="date"
          InputLabelProps={{ shrink: true }}
          value={value.lastCampaignBefore ?? ''}
          onChange={(e) => update({ lastCampaignBefore: e.target.value || undefined })}
          fullWidth
        />
        <StyledTextField
          label="Дата последней кампании после"
          type="date"
          InputLabelProps={{ shrink: true }}
          value={value.lastCampaignAfter ?? ''}
          onChange={(e) => update({ lastCampaignAfter: e.target.value || undefined })}
          fullWidth
        />
      </Stack>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
        <StyledTextField
          label="Статусы клиентов (через запятую)"
          value={value.clientStatuses?.join(',') ?? ''}
          onChange={(e) => update({ clientStatuses: e.target.value ? e.target.value.split(',').map(s => s.trim()) : undefined })}
          fullWidth
        />
        <StyledTextField
          label="Статусы WhatsApp (через запятую)"
          value={value.whatsAppStatus?.join(',') ?? ''}
          onChange={(e) => update({ whatsAppStatus: e.target.value ? e.target.value.split(',').map(s => s.trim()) : undefined })}
          fullWidth
        />
        <StyledTextField
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
              sx={{
                color: '#6366f1',
                '&.Mui-checked': {
                  color: '#6366f1',
                },
              }}
            />
          }
          label={<Typography sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>Только клиенты без предыдущих кампаний</Typography>}
        />
        <FormControlLabel
          control={
            <Checkbox
              checked={value.randomOrder || false}
              onChange={(e) => update({ randomOrder: e.target.checked })}
              sx={{
                color: '#6366f1',
                '&.Mui-checked': {
                  color: '#6366f1',
                },
              }}
            />
          }
          label={<Typography sx={{ color: 'rgba(255, 255, 255, 0.7)' }}>Случайный порядок</Typography>}
        />
      </Box>
    </Stack>
  );
}

export default BaseFilterForm;




