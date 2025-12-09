/**
 * Селектор переменных для вставки в текст шаблона.
 */

import React from 'react';
import { Box, Chip, Stack, Tooltip, Typography } from '@mui/material';
import { TEMPLATE_VARIABLES, type TemplateVariableInfo } from '@/types/template';

interface VariablesPickerProps {
  variables?: TemplateVariableInfo[];
  onSelect: (variable: string) => void;
  label?: string;
  compact?: boolean;
}

export function VariablesPicker({
  variables = TEMPLATE_VARIABLES,
  onSelect,
  label = 'Доступные переменные',
  compact,
}: VariablesPickerProps) {
  return (
    <Box>
      {!compact && (
        <Typography variant="subtitle2" sx={{ color: '#fff', mb: 0.5, opacity: 0.8 }}>
          {label}
        </Typography>
      )}
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        {variables.map((variable) => (
          <Tooltip
            key={variable.name}
            title={`${variable.description}${variable.example ? ` (пример: ${variable.example})` : ''}`}
          >
            <Chip
              label={`{{${variable.name}}}`}
              onClick={() => onSelect(`{{${variable.name}}}`)}
              size="small"
              sx={{
                backgroundColor: 'rgba(99, 102, 241, 0.12)',
                color: '#cdd2ff',
                border: '1px solid rgba(99, 102, 241, 0.35)',
                '&:hover': {
                  backgroundColor: 'rgba(99, 102, 241, 0.2)',
                },
              }}
            />
          </Tooltip>
        ))}
      </Stack>
    </Box>
  );
}

export default VariablesPicker;



