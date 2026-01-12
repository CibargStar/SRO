import { Grid } from '@mui/material';
import { StyledTextField } from '@/components/common';
import type { UpdateGlobalSettingsInput } from '@/types/campaign';

type OnChange = <K extends keyof UpdateGlobalSettingsInput>(key: K, value: UpdateGlobalSettingsInput[K]) => void;

interface Props {
  form: UpdateGlobalSettingsInput;
  onChange: OnChange;
}

export function TimingsForm({ form, onChange }: Props) {
  return (
    <Grid container spacing={2}>
      <Grid size={{ xs: 12, md: 6 }}>
        <StyledTextField
          label="Задержка между контактами (мс)"
          type="number"
          fullWidth
          value={form.delayBetweenContactsMs ?? ''}
          onChange={(e) => onChange('delayBetweenContactsMs', e.target.value === '' ? undefined : Number(e.target.value))}
        />
      </Grid>
      <Grid size={{ xs: 12, md: 6 }}>
        <StyledTextField
          label="Задержка между сообщениями (мс)"
          type="number"
          fullWidth
          value={form.delayBetweenMessagesMs ?? ''}
          onChange={(e) => onChange('delayBetweenMessagesMs', e.target.value === '' ? undefined : Number(e.target.value))}
        />
      </Grid>
    </Grid>
  );
}

export default TimingsForm;



