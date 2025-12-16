import React from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  Box,
  Paper,
  Typography,
  Stack,
  MenuItem,
  CircularProgress,
  Alert,
  FormControl,
  InputLabel,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { createTemplateSchema, type CreateTemplateFormData } from '@/schemas/template.schema';
import { useCreateTemplate, useTemplateCategories } from '@/hooks/useTemplates';
import { messengerTargetEnum, templateTypeEnum } from '@/schemas/template.schema';
import { StyledTextField, StyledButton, StyledSelect, MenuProps, selectInputLabelStyles } from '@/components/common';

export function CreateTemplatePage() {
  const navigate = useNavigate();
  const createTemplate = useCreateTemplate();
  const { data: categories } = useTemplateCategories();

  const {
    control,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
  } = useForm<CreateTemplateFormData>({
    resolver: zodResolver(createTemplateSchema),
    defaultValues: {
      name: '',
      description: '',
      messengerTarget: 'UNIVERSAL',
      type: 'SINGLE',
      categoryId: '',
    },
  });

  // Устанавливаем первую категорию после загрузки
  React.useEffect(() => {
    if (categories && categories.length > 0) {
      setValue('categoryId', categories[0].id);
    }
  }, [categories, setValue]);

  // Проверка наличия категорий
  const hasCategories = categories && categories.length > 0;

  const onSubmit = async (data: CreateTemplateFormData) => {
    const tpl = await createTemplate.mutateAsync(data);
    reset();
    navigate(`/templates/${tpl.id}/edit`);
  };

  return (
    <Box
      sx={{
        width: '100%',
        overflowY: 'auto',
        '&::-webkit-scrollbar': {
          display: 'none',
          width: 0,
          height: 0,
        },
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
        '& *': {
          '&::-webkit-scrollbar': {
            display: 'none',
            width: 0,
            height: 0,
          },
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        },
      }}
    >
      <Box sx={{ maxWidth: 900, mx: 'auto' }}>
        <Typography variant="h4" component="h1" sx={{ color: '#f5f5f5', mb: 4, fontWeight: 500 }}>
          Создать шаблон
        </Typography>
        <Paper sx={{ p: 3, backgroundColor: 'rgba(24,24,27,0.9)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
        <form onSubmit={handleSubmit(onSubmit)}>
          <Stack spacing={2}>
            {createTemplate.isError && (
              <Alert 
                severity="error"
                sx={{
                  borderRadius: '12px',
                  backgroundColor: 'rgba(244, 67, 54, 0.1)',
                  color: '#ffffff',
                  border: 'none',
                }}
              >
                {(createTemplate.error as Error)?.message || 'Не удалось создать шаблон'}
              </Alert>
            )}

            <Controller
              name="name"
              control={control}
              render={({ field }) => (
                <StyledTextField
                  label="Название"
                  {...field}
                  error={!!errors.name}
                  helperText={errors.name?.message}
                  fullWidth
                />
              )}
            />

            <Controller
              name="description"
              control={control}
              render={({ field }) => (
                <StyledTextField
                  label="Описание"
                  {...field}
                  error={!!errors.description}
                  helperText={errors.description?.message}
                  fullWidth
                  multiline
                  rows={3}
                />
              )}
            />

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
              <FormControl fullWidth>
                <InputLabel sx={selectInputLabelStyles}>Тип</InputLabel>
                <Controller
                  name="type"
                  control={control}
                  render={({ field }) => (
                    <StyledSelect
                      {...field}
                      label="Тип"
                      error={!!errors.type}
                      MenuProps={MenuProps}
                    >
                      {templateTypeEnum.options.map((opt) => (
                        <MenuItem key={opt} value={opt}>
                          {opt === 'SINGLE' ? 'Одиночный' : 'Составной'}
                        </MenuItem>
                      ))}
                    </StyledSelect>
                  )}
                />
                {errors.type && (
                  <Typography sx={{ color: '#f44336', mt: 0.5, fontSize: '0.75rem' }}>
                    {errors.type.message}
                  </Typography>
                )}
              </FormControl>

              <FormControl fullWidth>
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
                      {messengerTargetEnum.options.map((opt) => (
                        <MenuItem key={opt} value={opt}>
                          {opt === 'UNIVERSAL' ? 'Универсальный' : opt === 'WHATSAPP_ONLY' ? 'WhatsApp' : 'Telegram'}
                        </MenuItem>
                      ))}
                    </StyledSelect>
                  )}
                />
                {errors.messengerTarget && (
                  <Typography sx={{ color: '#f44336', mt: 0.5, fontSize: '0.75rem' }}>
                    {errors.messengerTarget.message}
                  </Typography>
                )}
              </FormControl>
            </Stack>

            <FormControl fullWidth required>
              <InputLabel sx={selectInputLabelStyles}>Категория</InputLabel>
              <Controller
                name="categoryId"
                control={control}
                render={({ field }) => (
                  <StyledSelect
                    value={field.value || ''}
                    onChange={(e) => field.onChange(e.target.value)}
                    label="Категория"
                    error={!!errors.categoryId}
                    disabled={!hasCategories}
                    MenuProps={MenuProps}
                  >
                    {hasCategories ? (
                      categories!.map((cat) => (
                        <MenuItem key={cat.id} value={cat.id}>
                          {cat.name}
                        </MenuItem>
                      ))
                    ) : (
                      <MenuItem value="" disabled>
                        <em>Сначала создайте категорию</em>
                      </MenuItem>
                    )}
                  </StyledSelect>
                )}
              />
              {errors.categoryId && (
                <Typography sx={{ color: '#f44336', mt: 0.5, fontSize: '0.75rem' }}>
                  {errors.categoryId.message}
                </Typography>
              )}
              {!hasCategories && (
                <Typography sx={{ color: 'rgba(255, 255, 255, 0.6)', mt: 0.5, fontSize: '0.75rem' }}>
                  Для создания шаблона необходимо сначала создать категорию
                </Typography>
              )}
            </FormControl>

            <StyledButton type="submit" disabled={createTemplate.isPending || !hasCategories} sx={{ alignSelf: 'flex-start' }}>
              {createTemplate.isPending ? <CircularProgress size={18} color="inherit" /> : 'Создать и перейти к редактированию'}
            </StyledButton>
          </Stack>
        </form>
      </Paper>
      </Box>
    </Box>
  );
}

export default CreateTemplatePage;




