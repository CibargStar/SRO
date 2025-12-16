/**
 * Текстовое поле с поддержкой вставки переменных и визуальными подсказками.
 */

import React, { useCallback, useRef } from 'react';
import { Box, Typography } from '@mui/material';
import { StyledTextField } from './FormStyles';
import { VariablesPicker } from './VariablesPicker';
import type { TemplateVariableInfo } from '@/types/template';

interface RichTextInputProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  placeholder?: string;
  rows?: number;
  helperText?: string;
  errorText?: string;
  disabled?: boolean;
  variables?: TemplateVariableInfo[];
  showVariables?: boolean;
}

export function RichTextInput({
  value,
  onChange,
  label = 'Текст сообщения',
  placeholder,
  rows = 4,
  helperText,
  errorText,
  disabled,
  variables,
  showVariables = true,
}: RichTextInputProps) {
  const inputRef = useRef<HTMLTextAreaElement | HTMLInputElement | null>(null);

  const insertAtCaret = useCallback(
    (text: string) => {
      const el = inputRef.current as HTMLTextAreaElement | HTMLInputElement | null;
      if (!el) {
        onChange(value + text);
        return;
      }

      const start = el.selectionStart ?? value.length;
      const end = el.selectionEnd ?? value.length;
      const newValue = value.slice(0, start) + text + value.slice(end);
      onChange(newValue);

      // Восстанавливаем каретку после вставки
      requestAnimationFrame(() => {
        const pos = start + text.length;
        el.setSelectionRange?.(pos, pos);
        el.focus();
      });
    },
    [onChange, value]
  );

  const handleVariableSelect = (variable: string) => {
    insertAtCaret(variable);
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <StyledTextField
        inputRef={inputRef}
        label={label}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        multiline
        rows={rows}
        disabled={disabled}
        error={!!errorText}
        helperText={errorText || helperText}
      />

      {showVariables && (
        <Box>
          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)' }}>
            Кликните по переменной, чтобы вставить в текст
          </Typography>
          <VariablesPicker variables={variables} onSelect={handleVariableSelect} compact />
        </Box>
      )}
    </Box>
  );
}

export default RichTextInput;





