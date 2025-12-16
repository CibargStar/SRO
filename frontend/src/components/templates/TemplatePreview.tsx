import React, { useEffect, useState } from 'react';
import { Box, Stack, CircularProgress, Alert, Typography, Divider } from '@mui/material';
import { usePreviewTemplateMutation } from '@/hooks/useTemplates';
import { StyledButton } from '@/components/common/FormStyles';
import { LOADING_ICON_SIZE } from '@/components/common/Constants';
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

  // Автоматический предпросмотр при загрузке шаблона
  useEffect(() => {
    if (template.id) {
      previewMutation.mutate({
        templateId: template.id,
        data: { clientData },
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [template.id]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {/* Client Data Section */}
      <Box>
        <Typography 
          variant="subtitle2" 
          sx={{ 
            color: '#f5f5f5', 
            mb: 2, 
            fontWeight: 500,
            fontSize: '0.95rem',
          }}
        >
          Данные клиента для подстановки переменных
        </Typography>
        <PreviewClientSelector value={clientData} onChange={setClientData} />
        <Box sx={{ mt: 2 }}>
          <StyledButton
            onClick={handlePreview}
            disabled={previewMutation.isPending}
            size="small"
            sx={{ minWidth: 160 }}
          >
            {previewMutation.isPending ? (
              <CircularProgress size={LOADING_ICON_SIZE} color="inherit" />
            ) : (
              'Обновить предпросмотр'
            )}
          </StyledButton>
        </Box>
      </Box>

      <Divider sx={{ borderColor: 'rgba(255, 255, 255, 0.08)' }} />

      {/* Messages Section */}
      {previewMutation.isError && (
        <Alert 
          severity="error"
          sx={{
            borderRadius: '12px',
            backgroundColor: 'rgba(244, 67, 54, 0.1)',
            color: '#f44336',
            border: '1px solid rgba(244, 67, 54, 0.2)',
          }}
        >
          {(previewMutation.error as Error)?.message || 'Не удалось получить предпросмотр'}
        </Alert>
      )}

      {previewMutation.data?.items && previewMutation.data.items.length > 0 ? (
        <Box>
          <Typography 
            variant="subtitle2" 
            sx={{ 
              color: '#f5f5f5', 
              mb: 2,
              fontWeight: 500,
              fontSize: '0.95rem',
            }}
          >
            Сообщения:
          </Typography>
          <Stack 
            spacing={2} 
            sx={{ 
              backgroundColor: 'rgba(255, 255, 255, 0.04)', 
              p: 2.5, 
              borderRadius: '12px',
            }}
          >
            {previewMutation.data?.items?.map((item, idx) => (
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
        </Box>
      ) : !previewMutation.isPending && !previewMutation.isError ? (
        <Box 
          sx={{ 
            textAlign: 'center', 
            py: 4,
            backgroundColor: 'rgba(255, 255, 255, 0.04)',
            borderRadius: '12px',
          }}
        >
          <Typography 
            variant="body2" 
            sx={{ 
              color: 'rgba(255, 255, 255, 0.6)',
            }}
          >
            Нет сообщений для отображения
          </Typography>
        </Box>
      ) : null}
    </Box>
  );
}

export default TemplatePreview;




