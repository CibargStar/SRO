import React, { useMemo } from 'react';
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
import { useParams } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTemplate, useTemplateCategories, useUpdateTemplate } from '@/hooks/useTemplates';
import { updateTemplateSchema, type UpdateTemplateFormData } from '@/schemas/template.schema';
import { TemplateEditor } from '@/components/templates';
import { StyledTextField, StyledButton, StyledSelect, MenuProps, selectInputLabelStyles } from '@/components/common';

export function EditTemplatePage() {
  const { templateId = '' } = useParams<{ templateId: string }>();
  const { data: template, isLoading, isError } = useTemplate(templateId);
  const { data: categories } = useTemplateCategories();
  const updateTemplate = useUpdateTemplate();

  const { control, handleSubmit, reset, formState: { errors } } = useForm<UpdateTemplateFormData>({
    resolver: zodResolver(updateTemplateSchema),
    defaultValues: {
      name: '',
      description: '',
      messengerTarget: 'UNIVERSAL',
      categoryId: '',
    },
  });

  const metadataReady = useMemo(() => !!template, [template]);

  React.useEffect(() => {
    if (template) {
      reset({
        name: template.name,
        description: template.description || '',
        messengerTarget: template.messengerTarget,
        categoryId: template.categoryId,
      });
    }
  }, [template, reset]);

  const onSubmit = async (data: UpdateTemplateFormData) => {
    if (!template) return;
    try {
      await updateTemplate.mutateAsync({
        templateId: template.id,
        data,
      });
      // Успешное сохранение обрабатывается через React Query кэш
    } catch (error) {
      // Ошибка отображается через updateTemplate.isError
      // Логирование не требуется - React Query обрабатывает ошибки автоматически
    }
  };

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (isError || !template) {
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
        }}
      >
        <Box sx={{ maxWidth: 1200, mx: 'auto', py: 4 }}>
          <Alert 
            severity="error"
            sx={{
              borderRadius: '12px',
              backgroundColor: 'rgba(244, 67, 54, 0.1)',
              color: '#ffffff',
              border: 'none',
            }}
          >
            Не удалось загрузить шаблон
          </Alert>
        </Box>
      </Box>
    );
  }

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
      <Box sx={{ maxWidth: 1200, mx: 'auto', display: 'flex', flexDirection: 'column', gap: 3 }}>
        <Typography variant="h4" component="h1" sx={{ color: '#f5f5f5', fontWeight: 500 }}>
          Редактирование шаблона
        </Typography>

        <Paper sx={{ p: 3.5, backgroundColor: 'rgba(255, 255, 255, 0.06)', borderRadius: '16px', border: 'none' }}>
          <Typography variant="h6" sx={{ color: '#f5f5f5', mb: 3, fontWeight: 500, fontSize: '1.1rem' }}>
            Основная информация
          </Typography>
          <form onSubmit={handleSubmit(onSubmit)}>
            <Stack spacing={2}>
              {updateTemplate.isError && (
                <Alert 
                  severity="error"
                  sx={{
                    borderRadius: '12px',
                    backgroundColor: 'rgba(244, 67, 54, 0.1)',
                    color: '#ffffff',
                    border: 'none',
                  }}
                >
                  {(updateTemplate.error as Error)?.message || 'Не удалось обновить шаблон'}
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
                        <MenuItem value="UNIVERSAL">Универсальный</MenuItem>
                        <MenuItem value="WHATSAPP_ONLY">WhatsApp</MenuItem>
                        <MenuItem value="TELEGRAM_ONLY">Telegram</MenuItem>
                      </StyledSelect>
                    )}
                  />
                  {errors.messengerTarget && (
                    <Typography sx={{ color: '#f44336', mt: 0.5, fontSize: '0.75rem' }}>
                      {errors.messengerTarget.message}
                    </Typography>
                  )}
                </FormControl>

                <FormControl fullWidth>
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
                        MenuProps={MenuProps}
                      >
                        {categories && categories.length > 0 ? (
                          categories.map((cat) => (
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
                      {errors.categoryId && (
                        <Typography sx={{ color: '#f44336', mt: 0.5, fontSize: '0.75rem' }}>
                          {errors.categoryId.message}
                        </Typography>
                      )}
                    )}
                  />
                </FormControl>
              </Stack>

              <StyledButton type="submit" disabled={updateTemplate.isPending} sx={{ alignSelf: 'flex-start' }}>
                {updateTemplate.isPending ? <CircularProgress size={18} color="inherit" /> : 'Сохранить'}
              </StyledButton>
            </Stack>
          </form>
        </Paper>

        <Paper sx={{ p: 3.5, backgroundColor: 'rgba(255, 255, 255, 0.06)', borderRadius: '16px', border: 'none' }}>
          <TemplateEditor template={template} />
        </Paper>
      </Box>
    </Box>
  );
}

export default EditTemplatePage;




