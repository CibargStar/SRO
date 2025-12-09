import React from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
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
import { useNavigate } from 'react-router-dom';
import { createTemplateSchema, type CreateTemplateFormData } from '@/schemas/template.schema';
import { useCreateTemplate, useTemplateCategories } from '@/hooks/useTemplates';
import { messengerTargetEnum, templateTypeEnum } from '@/schemas/template.schema';

export function CreateTemplatePage() {
  const navigate = useNavigate();
  const createTemplate = useCreateTemplate();
  const { data: categories } = useTemplateCategories();

  const {
    control,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<CreateTemplateFormData>({
    resolver: zodResolver(createTemplateSchema),
    defaultValues: {
      name: '',
      description: '',
      messengerTarget: 'UNIVERSAL',
      type: 'SINGLE',
      categoryId: null,
    },
  });

  const onSubmit = async (data: CreateTemplateFormData) => {
    const tpl = await createTemplate.mutateAsync(data);
    reset();
    navigate(`/templates/${tpl.id}/edit`);
  };

  return (
    <Box sx={{ maxWidth: 900, mx: 'auto' }}>
      <Typography variant="h4" sx={{ color: '#fff', mb: 2, fontWeight: 600 }}>
        Создать шаблон
      </Typography>
      <Paper sx={{ p: 3, backgroundColor: 'rgba(24,24,27,0.9)', borderRadius: 2, border: '1px solid rgba(255,255,255,0.05)' }}>
        <form onSubmit={handleSubmit(onSubmit)}>
          <Stack spacing={2}>
            {createTemplate.isError && (
              <Alert severity="error">
                {(createTemplate.error as Error)?.message || 'Не удалось создать шаблон'}
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
                name="type"
                control={control}
                render={({ field }) => (
                  <TextField
                    select
                    label="Тип"
                    {...field}
                    error={!!errors.type}
                    helperText={errors.type?.message}
                    fullWidth
                  >
                    {templateTypeEnum.options.map((opt) => (
                      <MenuItem key={opt} value={opt}>
                        {opt === 'SINGLE' ? 'Одиночный' : 'Составной'}
                      </MenuItem>
                    ))}
                  </TextField>
                )}
              />

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
                    {messengerTargetEnum.options.map((opt) => (
                      <MenuItem key={opt} value={opt}>
                        {opt === 'UNIVERSAL' ? 'Универсальный' : opt === 'WHATSAPP_ONLY' ? 'WhatsApp' : 'Telegram'}
                      </MenuItem>
                    ))}
                  </TextField>
                )}
              />
            </Stack>

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

            <Button type="submit" variant="contained" disabled={createTemplate.isPending} sx={{ alignSelf: 'flex-start' }}>
              {createTemplate.isPending ? <CircularProgress size={18} color="inherit" /> : 'Создать и перейти к редактированию'}
            </Button>
          </Stack>
        </form>
      </Paper>
    </Box>
  );
}

export default CreateTemplatePage;



