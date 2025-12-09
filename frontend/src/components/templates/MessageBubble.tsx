import React from 'react';
import { Box, Typography } from '@mui/material';
import type { FileType, TemplateItemType } from '@/types/template';
import { FileThumbnail } from '@/components/common';

interface MessageBubbleProps {
  type: TemplateItemType;
  content: string | null;
  fileUrl?: string | null;
  fileName?: string | null;
  fileType?: FileType | null;
}

export function MessageBubble({ type, content, fileUrl, fileName, fileType }: MessageBubbleProps) {
  const isText = type === 'TEXT';

  return (
    <Box
      sx={{
        maxWidth: '80%',
        alignSelf: 'flex-start',
        backgroundColor: isText ? 'rgba(99, 102, 241, 0.12)' : 'rgba(255, 255, 255, 0.05)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: 2,
        p: 1.5,
        color: '#fff',
      }}
    >
      {isText ? (
        <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
          {content || 'Пустое сообщение'}
        </Typography>
      ) : fileUrl ? (
        <FileThumbnail
          file={{
            url: fileUrl,
            name: fileName || 'Файл',
            fileType: fileType || null,
          }}
          compact
        />
      ) : (
        <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)' }}>
          Файл не загружен
        </Typography>
      )}
    </Box>
  );
}

export default MessageBubble;



