import React from 'react';
import { Grid, TextField, ToggleButtonGroup, ToggleButton, Typography, FormHelperText } from '@mui/material';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import TelegramIcon from '@mui/icons-material/Telegram';
import PublicIcon from '@mui/icons-material/Public';
import { Controller, useFormContext } from 'react-hook-form';
import { CAMPAIGN_TYPE_LABELS, MESSENGER_TARGET_LABELS, UNIVERSAL_TARGET_LABELS } from '@/types/campaign';
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
            <TextField
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
            <TextField
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
        <Typography variant="subtitle2" gutterBottom>
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
              color="primary"
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
        <FormHelperText>
          {watchedValues.campaignType === 'ONE_TIME' 
            ? 'Запуск вручную, выполняется один раз'
            : 'Запуск по расписанию, можно настроить повтор'}
        </FormHelperText>
      </Grid>

      <Grid item xs={12} md={6}>
        <Typography variant="subtitle2" gutterBottom>
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
              color="primary"
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
          <Typography variant="subtitle2" gutterBottom>
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



