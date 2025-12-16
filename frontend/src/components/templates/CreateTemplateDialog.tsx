/**
 * Диалог создания шаблона сообщений
 */

import React, { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Dialog,
  DialogContent,
  DialogActions,
  Box,
  Alert,
  CircularProgress,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormHelperText,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import { Article as SingleIcon, ViewList as MultiIcon } from '@mui/icons-material';
import { StyledTextField, StyledButton, CancelButton } from '../common/FormStyles';
import { StyledSelect, MenuProps, selectInputLabelStyles } from '../common/SelectStyles';
import { dialogPaperProps, dialogTitleStyles, dialogContentStyles, dialogActionsStyles } from '../common/DialogStyles';
import { LOADING_ICON_SIZE } from '../common/Constants';
import { createTemplateSchema, type CreateTemplateFormData } from '@/schemas/template.schema';
import { useCreateTemplate, useTemplateCategories } from '@/hooks/useTemplates';
import type { TemplateType, MessengerTarget } from '@/types/template';

interface CreateTemplateDialogProps {
  open: boolean;
  onClose: () => void;
  defaultCategoryId?: string | null;
  onSuccess?: (templateId: string) => void;
}

const StyledToggleButtonGroup = styled(ToggleButtonGroup)(({ theme }) => ({
  backgroundColor: 'rgba(0, 0, 0, 0.2)',
  borderRadius: 8,
  '& .MuiToggleButton-root': {
    border: 'none',
    color: 'rgba(255, 255, 255, 0.6)',
    padding: '8px 16px',
    '&.Mui-selected': {
      backgroundColor: 'rgba(99, 102, 241, 0.2)',
      color: '#6366f1',
      '&:hover': {
        backgroundColor: 'rgba(99, 102, 241, 0.3)',
      },
    },
    '&:hover': {
      backgroundColor: 'rgba(255, 255, 255, 0.05)',
    },
  },
}));


const messengerTargetOptions: { value: MessengerTarget; label: string }[] = [
  { value: 'UNIVERSAL', label: 'Универсальный (WA + TG)' },
  { value: 'WHATSAPP_ONLY', label: 'Только WhatsApp' },
  { value: 'TELEGRAM_ONLY', label: 'Только Telegram' },
];

export function CreateTemplateDialog({
  open,
  onClose,
  defaultCategoryId,
  onSuccess,
}: CreateTemplateDialogProps) {
  const createMutation = useCreateTemplate();
  const { data: categories } = useTemplateCategories();

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
    setValue,
  } = useForm<CreateTemplateFormData>({
    resolver: zodResolver(createTemplateSchema),
    defaultValues: {
      name: '',
      description: null,
      type: 'SINGLE',
      messengerTarget: 'UNIVERSAL',
      categoryId: defaultCategoryId || '',
    },
  });

  const categoryId = watch('categoryId');

  useEffect(() => {
    if (!categoryId && categories?.length) {
      const targetCategoryId = defaultCategoryId && categories.some((c) => c.id === defaultCategoryId)
        ? defaultCategoryId
        : categories[0].id;
      setValue('categoryId', targetCategoryId, { shouldValidate: true });
    }
  }, [categoryId, categories, defaultCategoryId, setValue]);

  const handleClose = () => {
    reset();
    createMutation.reset();
    onClose();
  };

  const onSubmit = async (data: CreateTemplateFormData) => {
    try {
      const template = await createMutation.mutateAsync(data);
      handleClose();
      onSuccess?.(template.id);
    } catch (error) {
      // Ошибка обрабатывается в mutation
    }
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
      PaperProps={dialogPaperProps}
    >
      <Box sx={dialogTitleStyles}>
        <Typography sx={{ color: '#fff', fontSize: '1.25rem', fontWeight: 500 }}>
          Создание шаблона
        </Typography>
      </Box>

      <form onSubmit={handleSubmit(onSubmit)}>
        <DialogContent sx={dialogContentStyles}>
          {createMutation.isError && (
            <Alert 
              severity="error" 
              sx={{ 
                mb: 2,
                borderRadius: '12px',
                backgroundColor: 'rgba(244, 67, 54, 0.1)',
                color: '#ffffff',
                border: 'none',
              }}
            >
              {(createMutation.error as Error)?.message || 'Ошибка при создании шаблона'}
            </Alert>
          )}

          <StyledTextField
            label="Название шаблона"
            {...register('name')}
            error={!!errors.name}
            helperText={errors.name?.message}
            fullWidth
            autoFocus
          />

          <StyledTextField
            label="Описание"
            {...register('description')}
            error={!!errors.description}
            helperText={errors.description?.message}
            fullWidth
            multiline
            rows={2}
          />

          <Box sx={{ mb: 2 }}>
            <Typography sx={{ color: 'rgba(255, 255, 255, 0.7)', mb: 1 }}>
              Тип шаблона
            </Typography>
            <Controller
              name="type"
              control={control}
              render={({ field }) => (
                <StyledToggleButtonGroup
                  value={field.value}
                  exclusive
                  onChange={(_, value) => value && field.onChange(value)}
                  fullWidth
                >
                  <ToggleButton value="SINGLE">
                    <SingleIcon sx={{ mr: 1 }} />
                    Одиночный
                  </ToggleButton>
                  <ToggleButton value="MULTI">
                    <MultiIcon sx={{ mr: 1 }} />
                    Составной
                  </ToggleButton>
                </StyledToggleButtonGroup>
              )}
            />
            <Typography variant="caption" sx={{ color: 'rgba(255, 255, 255, 0.5)', mt: 0.5, display: 'block' }}>
              Одиночный: 1 сообщение + 1 файл. Составной: до 50 сообщений/файлов.
            </Typography>
          </Box>

          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel sx={selectInputLabelStyles}>Мессенджер</InputLabel>
            <Controller
              name="messengerTarget"
              control={control}
              render={({ field }) => (
                <StyledSelect
                  {...field}
                  label="Мессенджер"
                  error={!!errors.messengerTarget}
                  MenuProps={MenuProps}
                >
                  {messengerTargetOptions.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </StyledSelect>
              )}
            />
            {errors.messengerTarget && (
              <FormHelperText sx={{ color: '#f44336', mt: 0.5 }}>
                {errors.messengerTarget.message}
              </FormHelperText>
            )}
          </FormControl>

          <FormControl fullWidth>
            <InputLabel sx={selectInputLabelStyles}>Категория</InputLabel>
            <Controller
              name="categoryId"
              control={control}
              render={({ field }) => (
                <StyledSelect
                  {...field}
                  value={field.value || ''}
                  label="Категория"
                  onChange={(e) => field.onChange(e.target.value)}
                  MenuProps={MenuProps}
                >
                  <MenuItem value="" disabled>
                    <em>Выберите категорию</em>
                  </MenuItem>
                  {categories?.map((category) => (
                    <MenuItem key={category.id} value={category.id}>
                      {category.name}
                    </MenuItem>
                  ))}
                </StyledSelect>
              )}
            />
            {errors.categoryId && (
              <FormHelperText sx={{ color: '#f44336', mt: 0.5 }}>
                {errors.categoryId.message}
              </FormHelperText>
            )}
          </FormControl>
        </DialogContent>

        <DialogActions sx={dialogActionsStyles}>
          <CancelButton onClick={handleClose}>
            Отмена
          </CancelButton>
          <StyledButton
            type="submit"
            disabled={createMutation.isPending || !categories?.length}
          >
            {createMutation.isPending ? (
              <CircularProgress size={LOADING_ICON_SIZE} color="inherit" />
            ) : (
              'Создать'
            )}
          </StyledButton>
        </DialogActions>
      </form>
    </Dialog>
  );
}

export default CreateTemplateDialog;


