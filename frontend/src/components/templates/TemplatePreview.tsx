import React, { useEffect, useState } from 'react';
import { Box, Stack, Button, CircularProgress, Alert, Typography } from '@mui/material';
import { usePreviewTemplateMutation } from '@/hooks/useTemplates';
import type { Template } from '@/types/template';
import { MessageBubble } from './MessageBubble';
import { PreviewClientSelector, type PreviewClientData } from './PreviewClientSelector';

interface TemplatePreviewProps {
  template: Template;
}

export function TemplatePreview({ template }: TemplatePreviewProps) {
  const [clientData, setClientData] = useState<PreviewClientData>({});
  const previewMutation = usePreviewTemplateMutation();

  const handlePreview = () => {
    previewMutation.mutate({
      templateId: template.id,
      data: { clientData },
    });
  };

  useEffect(() => {
    if (template.id) {
      handlePreview();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [template.id]);

  return (
    <Box sx={{ mt: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
      <PreviewClientSelector value={clientData} onChange={setClientData} />

      <Button
        variant="contained"
        onClick={handlePreview}
        disabled={previewMutation.isPending}
        sx={{ alignSelf: 'flex-start' }}
      >
        {previewMutation.isPending ? <CircularProgress size={18} color="inherit" /> : 'Обновить предпросмотр'}
      </Button>

      {previewMutation.isError && (
        <Alert severity="error">
          {(previewMutation.error as Error)?.message || 'Не удалось получить предпросмотр'}
        </Alert>
      )}

      {previewMutation.data?.items && (
        <Stack spacing={1.5} sx={{ backgroundColor: 'rgba(255,255,255,0.02)', p: 2, borderRadius: 2, border: '1px solid rgba(255,255,255,0.05)' }}>
          <Typography variant="subtitle2" sx={{ color: 'rgba(255,255,255,0.8)' }}>
            Сообщения:
          </Typography>
          {previewMutation.data.items.map((item, idx) => (
            <MessageBubble
              key={idx}
              type={item.type}
              content={item.content}
              fileUrl={item.fileUrl}
              fileName={item.fileName || undefined}
              fileType={item.fileType || undefined}
            />
          ))}
        </Stack>
      )}
    </Box>
  );
}

export default TemplatePreview;



