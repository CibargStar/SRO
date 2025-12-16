import React, { useEffect } from 'react';
import { Dialog, DialogContent, DialogActions, MenuItem, CircularProgress, Alert, Box, Typography, FormControl, InputLabel } from '@mui/material';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { updateTemplateSchema, type UpdateTemplateFormData } from '@/schemas/template.schema';
import { useUpdateTemplate, useTemplateCategories } from '@/hooks/useTemplates';
import type { Template } from '@/types/template';
import { CancelButton, StyledButton, StyledTextField } from '@/components/common';
import { StyledSelect, MenuProps, selectInputLabelStyles } from '@/components/common/SelectStyles';
import { dialogPaperProps, dialogTitleStyles, dialogContentStyles, dialogActionsStyles } from '@/components/common/DialogStyles';

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
      categoryId: '',
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
    <Dialog open={open} onClose={handleClose} PaperProps={dialogPaperProps}>
      <Box sx={dialogTitleStyles}>
        <Typography sx={{ color: '#fff', fontSize: '1.25rem', fontWeight: 500 }}>
          Редактировать шаблон
        </Typography>
      </Box>
      <form onSubmit={handleSubmit(onSubmit)}>
        <DialogContent sx={dialogContentStyles}>
          {updateTemplate.isError && (
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
                sx={{ mb: 2 }}
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
                rows={2}
                sx={{ mb: 2 }}
              />
            )}
          />

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
        </DialogContent>
        <DialogActions sx={dialogActionsStyles}>
          <CancelButton onClick={handleClose} disabled={updateTemplate.isPending}>Отмена</CancelButton>
          <StyledButton type="submit" disabled={updateTemplate.isPending}>
            {updateTemplate.isPending ? <CircularProgress size={18} color="inherit" /> : 'Сохранить'}
          </StyledButton>
        </DialogActions>
      </form>
    </Dialog>
  );
}

export default EditTemplateDialog;




