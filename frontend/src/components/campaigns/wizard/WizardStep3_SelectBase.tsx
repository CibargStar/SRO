import React from 'react';
import { Box, Typography, Divider } from '@mui/material';
import { Controller, useFormContext } from 'react-hook-form';
import type { ClientGroup } from '@/types';
import { BaseFilterForm } from '../BaseFilterForm';
import type { FilterConfig } from '@/types/campaign';
import { ClientGroupSelector } from '@/components/ClientGroupSelector';

interface Props {
  clientGroupsData?: ClientGroup[];
  groupsLoading?: boolean;
}

export function WizardStep3_SelectBase({ clientGroupsData, groupsLoading }: Props) {
  const { control, formState: { errors } } = useFormContext();

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="subtitle2" sx={{ color: '#f5f5f5', fontWeight: 500, mb: 1.5 }}>
          Группа клиентов
        </Typography>
            <Controller
          name="clientGroupId"
          control={control}
          render={({ field }) => (
            <ClientGroupSelector
              value={field.value}
              onChange={(val) => field.onChange(val)}
              label="Группа клиентов"
              required
              error={!!errors.clientGroupId}
              helperText={
                errors.clientGroupId?.message ||
                (!groupsLoading && (!clientGroupsData || clientGroupsData.length === 0)
                  ? 'Создайте группу клиентов в разделе Клиенты'
                  : undefined)
              }
              disabled={groupsLoading}
              allowAllOption
            />
          )}
        />
      </Box>

      <Divider sx={{ my: 3, borderColor: 'rgba(255, 255, 255, 0.08)' }} />

      <Box>
        <Controller
          name="filterConfig"
          control={control}
          render={({ field }) => (
            <BaseFilterForm
              value={(field.value as FilterConfig) || {}}
              onChange={field.onChange}
            />
          )}
        />
      </Box>
    </Box>
  );
}

export default WizardStep3_SelectBase;


