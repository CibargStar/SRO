import React from 'react';
import { Grid, ToggleButtonGroup, ToggleButton, Typography, FormHelperText } from '@mui/material';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import TelegramIcon from '@mui/icons-material/Telegram';
import PublicIcon from '@mui/icons-material/Public';
import { Controller, useFormContext } from 'react-hook-form';
import { CAMPAIGN_TYPE_LABELS, MESSENGER_TARGET_LABELS, UNIVERSAL_TARGET_LABELS } from '@/types/campaign';
import { StyledTextField } from '@/components/common';
import type { CampaignType, MessengerTarget, UniversalTarget } from '@/types/campaign';
import { UniversalTargetSelector } from '../UniversalTargetSelector';

export interface WizardBasicInfoValues {
  name: string;
  description: string;
  campaignType: CampaignType;
  messengerType: MessengerTarget;
  universalTarget: UniversalTarget | null;
}

export function WizardStep1_BasicInfo() {
  const { control, watch, formState: { errors } } = useFormContext<WizardBasicInfoValues>();
  const watchedValues = watch();

  return (
    <Grid container spacing={3}>
      <Grid item xs={12}>
        <Controller
          name="name"
          control={control}
          render={({ field }) => (
            <StyledTextField
              {...field}
              label="Название кампании"
              fullWidth
              required
              error={!!errors.name}
              helperText={errors.name?.message}
              placeholder="Например: Акция декабрь 2025"
            />
          )}
        />
      </Grid>
      
      <Grid item xs={12}>
        <Controller
          name="description"
          control={control}
          render={({ field }) => (
            <StyledTextField
              {...field}
              label="Описание"
              fullWidth
              multiline
              rows={3}
              placeholder="Опциональное описание кампании"
            />
          )}
        />
      </Grid>

      <Grid item xs={12} md={6}>
        <Typography variant="subtitle2" gutterBottom sx={{ color: '#f5f5f5', fontWeight: 500 }}>
          Тип кампании
        </Typography>
        <Controller
          name="campaignType"
          control={control}
          render={({ field }) => (
            <ToggleButtonGroup
              {...field}
              exclusive
              fullWidth
              sx={{
                '& .MuiToggleButton-root': {
                  color: 'rgba(255, 255, 255, 0.7)',
                  borderColor: 'rgba(255, 255, 255, 0.12)',
                  '&.Mui-selected': {
                    backgroundColor: 'rgba(99, 102, 241, 0.2)',
                    color: '#818cf8',
                    borderColor: 'rgba(99, 102, 241, 0.4)',
                    '&:hover': {
                      backgroundColor: 'rgba(99, 102, 241, 0.3)',
                    },
                  },
                  '&:hover': {
                    backgroundColor: 'rgba(255, 255, 255, 0.08)',
                  },
                },
              }}
            >
              <ToggleButton value="ONE_TIME">
                {CAMPAIGN_TYPE_LABELS.ONE_TIME}
              </ToggleButton>
              <ToggleButton value="SCHEDULED">
                {CAMPAIGN_TYPE_LABELS.SCHEDULED}
              </ToggleButton>
            </ToggleButtonGroup>
          )}
        />
        <FormHelperText sx={{ color: 'rgba(255, 255, 255, 0.5)' }}>
          {watchedValues.campaignType === 'ONE_TIME' 
            ? 'Запуск вручную, выполняется один раз'
            : 'Запуск по расписанию, можно настроить повтор'}
        </FormHelperText>
      </Grid>

      <Grid item xs={12} md={6}>
        <Typography variant="subtitle2" gutterBottom sx={{ color: '#f5f5f5', fontWeight: 500 }}>
          Целевой мессенджер
        </Typography>
        <Controller
          name="messengerType"
          control={control}
          render={({ field }) => (
            <ToggleButtonGroup
              {...field}
              exclusive
              fullWidth
              sx={{
                '& .MuiToggleButton-root': {
                  color: 'rgba(255, 255, 255, 0.7)',
                  borderColor: 'rgba(255, 255, 255, 0.12)',
                  '&.Mui-selected': {
                    backgroundColor: 'rgba(99, 102, 241, 0.2)',
                    color: '#818cf8',
                    borderColor: 'rgba(99, 102, 241, 0.4)',
                    '&:hover': {
                      backgroundColor: 'rgba(99, 102, 241, 0.3)',
                    },
                  },
                  '&:hover': {
                    backgroundColor: 'rgba(255, 255, 255, 0.08)',
                  },
                },
              }}
            >
              <ToggleButton value="WHATSAPP_ONLY">
                <WhatsAppIcon sx={{ mr: 1, color: '#25D366' }} />
                WhatsApp
              </ToggleButton>
              <ToggleButton value="TELEGRAM_ONLY">
                <TelegramIcon sx={{ mr: 1, color: '#0088cc' }} />
                Telegram
              </ToggleButton>
              <ToggleButton value="UNIVERSAL">
                <PublicIcon sx={{ mr: 1 }} />
                Универсальная
              </ToggleButton>
            </ToggleButtonGroup>
          )}
        />
      </Grid>

      {watchedValues.messengerType === 'UNIVERSAL' && (
        <Grid item xs={12}>
          <Typography variant="subtitle2" gutterBottom sx={{ color: '#f5f5f5', fontWeight: 500 }}>
            Порядок отправки
          </Typography>
          <Controller
            name="universalTarget"
            control={control}
            render={({ field }) => (
              <UniversalTargetSelector
                value={(field.value as any) || 'WHATSAPP_FIRST'}
                onChange={(val) => field.onChange(val)}
              />
            )}
          />
        </Grid>
      )}
    </Grid>
  );
}

export default WizardStep1_BasicInfo;




