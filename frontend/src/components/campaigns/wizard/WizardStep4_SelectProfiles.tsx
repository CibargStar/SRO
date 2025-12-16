import React from 'react';
import { Alert, Typography } from '@mui/material';
import { Controller, useFormContext } from 'react-hook-form';
import { ProfileSelector } from '../ProfileSelector';

export function WizardStep4_SelectProfiles() {
  const { control, formState: { errors } } = useFormContext();

  return (
    <>
      <Typography variant="body2" sx={{ mb: 1, color: 'rgba(255, 255, 255, 0.7)' }}>
        Выберите профили, которые будут использоваться для отправки сообщений.
        Контакты будут распределены между выбранными профилями равномерно.
      </Typography>

      <Controller
        name="profileIds"
        control={control}
        render={({ field }) => (
          <ProfileSelector
            value={field.value || []}
            onChange={field.onChange}
          />
        )}
      />

      {(errors as any)?.profileIds && (
        <Alert 
          severity="error" 
          sx={{ 
            mt: 2,
            borderRadius: '12px',
            backgroundColor: 'rgba(244, 67, 54, 0.1)',
            color: '#f44336',
            border: '1px solid rgba(244, 67, 54, 0.2)',
          }}
        >
          {(errors as any)?.profileIds?.message as string}
        </Alert>
      )}
    </>
  );
}

export default WizardStep4_SelectProfiles;




