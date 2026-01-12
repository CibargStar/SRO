import { Typography, Box } from '@mui/material';
import type { UpdateGlobalSettingsInput } from '@/types/campaign';

type OnChange = <K extends keyof UpdateGlobalSettingsInput>(key: K, value: UpdateGlobalSettingsInput[K]) => void;

interface Props {
  form: UpdateGlobalSettingsInput;
  onChange: OnChange;
}

/**
 * WorkHoursForm - Компонент для настройки рабочих часов
 * 
 * ПРИМЕЧАНИЕ: Глобальные настройки рабочих часов больше не используются.
 * Рабочие часы настраиваются индивидуально для каждой кампании.
 * Этот компонент оставлен для обратной совместимости интерфейса.
 */
export function WorkHoursForm({ form: _form, onChange: _onChange }: Props) {
  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.5)', fontStyle: 'italic' }}>
        Рабочие часы и дни теперь настраиваются индивидуально для каждой кампании при создании.
      </Typography>
    </Box>
  );
}

export default WorkHoursForm;
