import React, { useMemo } from 'react';
import {
  Box,
  Paper,
  Typography,
  Stack,
  TextField,
  MenuItem,
  Button,
  CircularProgress,
  Alert,
} from '@mui/material';
import { useParams } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTemplate, useTemplateCategories, useUpdateTemplate } from '@/hooks/useTemplates';
import { updateTemplateSchema, type UpdateTemplateFormData } from '@/schemas/template.schema';
import { TemplateEditor } from '@/components/templates';

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
      categoryId: null,
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
    await updateTemplate.mutateAsync({
      templateId: template.id,
      data,
    });
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
      <Alert severity="error">Не удалось загрузить шаблон</Alert>
    );
  }

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto', display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Typography variant="h4" sx={{ color: '#fff', fontWeight: 600 }}>
        Редактирование шаблона
      </Typography>

      <Paper sx={{ p: 3, backgroundColor: 'rgba(24,24,27,0.9)', borderRadius: 2, border: '1px solid rgba(255,255,255,0.05)' }}>
        <Typography variant="h6" sx={{ color: '#fff', mb: 2 }}>
          Основная информация
        </Typography>
        <form onSubmit={handleSubmit(onSubmit)}>
          <Stack spacing={2}>
            {updateTemplate.isError && (
              <Alert severity="error">
                {(updateTemplate.error as Error)?.message || 'Не удалось обновить шаблон'}
              </Alert>
            )}

            <Controller
              name="name"
              control={control}
              render={({ field }) => (
                <TextField
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
                <TextField
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
              <Controller
                name="messengerTarget"
                control={control}
                render={({ field }) => (
                  <TextField
                    select
                    label="Мессенджер"
                    {...field}
                    error={!!errors.messengerTarget}
                    helperText={errors.messengerTarget?.message}
                    fullWidth
                  >
                    <MenuItem value="UNIVERSAL">Универсальный</MenuItem>
                    <MenuItem value="WHATSAPP_ONLY">WhatsApp</MenuItem>
                    <MenuItem value="TELEGRAM_ONLY">Telegram</MenuItem>
                  </TextField>
                )}
              />

              <Controller
                name="categoryId"
                control={control}
                render={({ field }) => (
                  <TextField
                    select
                    label="Категория"
                    value={field.value || ''}
                    onChange={(e) => field.onChange(e.target.value || null)}
                    fullWidth
                  >
                    <MenuItem value="">
                      <em>Без категории</em>
                    </MenuItem>
                    {categories?.map((cat) => (
                      <MenuItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </MenuItem>
                    ))}
                  </TextField>
                )}
              />
            </Stack>

            <Button type="submit" variant="contained" disabled={updateTemplate.isPending} sx={{ alignSelf: 'flex-start' }}>
              {updateTemplate.isPending ? <CircularProgress size={18} color="inherit" /> : 'Сохранить'}
            </Button>
          </Stack>
        </form>
      </Paper>

      <Paper sx={{ p: 3, backgroundColor: 'rgba(24,24,27,0.9)', borderRadius: 2, border: '1px solid rgba(255,255,255,0.05)' }}>
        <TemplateEditor template={template} />
      </Paper>
    </Box>
  );
}

export default EditTemplatePage;



