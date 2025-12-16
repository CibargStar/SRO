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
        maxWidth: '85%',
        alignSelf: 'flex-start',
        backgroundColor: isText ? 'rgba(99, 102, 241, 0.15)' : 'rgba(255, 255, 255, 0.06)',
        borderRadius: '12px',
        p: 2,
        color: '#f5f5f5',
        transition: 'all 0.2s ease',
        '&:hover': {
          backgroundColor: isText ? 'rgba(99, 102, 241, 0.2)' : 'rgba(255, 255, 255, 0.08)',
        },
      }}
    >
      {isText ? (
        <Typography 
          variant="body2" 
          sx={{ 
            whiteSpace: 'pre-wrap',
            color: '#f5f5f5',
            lineHeight: 1.6,
            fontSize: '0.875rem',
          }}
        >
          {content || (
            <Box component="span" sx={{ color: 'rgba(255, 255, 255, 0.5)', fontStyle: 'italic' }}>
              Пустое сообщение
            </Box>
          )}
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
        <Typography 
          variant="body2" 
          sx={{ 
            color: 'rgba(255, 255, 255, 0.6)',
            fontStyle: 'italic',
          }}
        >
          Файл не загружен
        </Typography>
      )}
    </Box>
  );
}

export default MessageBubble;




