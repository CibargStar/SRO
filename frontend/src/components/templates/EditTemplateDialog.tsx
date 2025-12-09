import React, { useEffect } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem, Button, CircularProgress, Alert } from '@mui/material';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { updateTemplateSchema, type UpdateTemplateFormData } from '@/schemas/template.schema';
import { useUpdateTemplate, useTemplateCategories } from '@/hooks/useTemplates';
import type { Template } from '@/types/template';
import { CancelButton } from '@/components/common';

interface EditTemplateDialogProps {
  open: boolean;
  template: Template | null;
  onClose: () => void;
}

export function EditTemplateDialog({ open, template, onClose }: EditTemplateDialogProps) {
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

  useEffect(() => {
    if (template && open) {
      reset({
        name: template.name,
        description: template.description || '',
        messengerTarget: template.messengerTarget,
        categoryId: template.categoryId,
      });
    }
  }, [template, open, reset]);

  const handleClose = () => {
    updateTemplate.reset();
    onClose();
  };

  const onSubmit = async (data: UpdateTemplateFormData) => {
    if (!template) return;
    await updateTemplate.mutateAsync({
      templateId: template.id,
      data,
    });
    handleClose();
  };

  if (!template) return null;

  return (
    <Dialog open={open} onClose={handleClose} PaperProps={{ sx: { backgroundColor: 'rgba(24,24,27,0.95)', borderRadius: 2, minWidth: 460 } }}>
      <DialogTitle sx={{ color: '#fff' }}>Редактировать шаблон</DialogTitle>
      <form onSubmit={handleSubmit(onSubmit)}>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
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
                rows={2}
              />
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
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <CancelButton onClick={handleClose}>Отмена</CancelButton>
          <Button type="submit" variant="contained" disabled={updateTemplate.isPending}>
            {updateTemplate.isPending ? <CircularProgress size={18} color="inherit" /> : 'Сохранить'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}

export default EditTemplateDialog;



