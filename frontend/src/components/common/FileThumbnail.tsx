/**
 * Универсальный превью-компонент для файлов (из File или сохранённых на сервере).
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Box, IconButton, Tooltip, Typography } from '@mui/material';
import {
  Close as CloseIcon,
  Image as ImageIcon,
  VideoFile as VideoIcon,
  PictureAsPdf as PdfIcon,
  InsertDriveFile as FileIcon,
} from '@mui/icons-material';
import type { FileType } from '@/types/template';

type FileLike = {
  url?: string | null;
  name?: string | null;
  mimeType?: string | null;
  fileType?: FileType | null;
  size?: number | null;
};

interface FileThumbnailProps {
  file: File | FileLike;
  onRemove?: () => void;
  compact?: boolean;
}

function detectType(file: File | FileLike) {
  const mime = 'type' in file ? file.type : file.mimeType || undefined;
  const name = ('name' in file ? file.name : file.name) || '';
  const ext = name.split('.').pop()?.toLowerCase();

  if (mime?.startsWith('image/') || ext && ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) {
    return 'image';
  }
  if (mime?.startsWith('video/') || ext === 'mp4') {
    return 'video';
  }
  if (mime === 'application/pdf' || ext === 'pdf') {
    return 'pdf';
  }
  return 'file';
}

export function FileThumbnail({ file, onRemove, compact }: FileThumbnailProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const type = useMemo(() => detectType(file), [file]);

  useEffect(() => {
    if (file instanceof File && type === 'image') {
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    }
    if (!previewUrl && !(file instanceof File)) {
      setPreviewUrl(file.url || null);
    }
    return () => {};
  }, [file, type, previewUrl]);

  const icon =
    type === 'image' ? (
      <ImageIcon sx={{ fontSize: 28, color: '#90caf9' }} />
    ) : type === 'video' ? (
      <VideoIcon sx={{ fontSize: 28, color: '#f48fb1' }} />
    ) : type === 'pdf' ? (
      <PdfIcon sx={{ fontSize: 28, color: '#f44336' }} />
    ) : (
      <FileIcon sx={{ fontSize: 28, color: '#cfd8dc' }} />
    );

  const displayName = 'name' in file ? file.name : file.name || 'Файл';

  return (
    <Box
      sx={{
        position: 'relative',
        width: compact ? 64 : 96,
        height: compact ? 64 : 96,
        borderRadius: 2,
        overflow: 'hidden',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        backgroundColor: 'rgba(255, 255, 255, 0.04)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {previewUrl && type === 'image' ? (
        <Box
          component="img"
          src={previewUrl}
          alt={displayName || 'preview'}
          sx={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
        />
      ) : (
        <>{icon}</>
      )}

      {onRemove && (
        <Tooltip title="Удалить">
          <IconButton
            size="small"
            onClick={onRemove}
            sx={{
              position: 'absolute',
              top: 4,
              right: 4,
              backgroundColor: 'rgba(0,0,0,0.35)',
              color: '#fff',
              '&:hover': { backgroundColor: 'rgba(0,0,0,0.5)' },
            }}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      )}

      {!compact && displayName && (
        <Box
          sx={{
            position: 'absolute',
            bottom: 0,
            width: '100%',
            background: 'linear-gradient(180deg, transparent, rgba(0,0,0,0.7))',
            color: '#fff',
            px: 1,
            py: 0.5,
          }}
        >
          <Tooltip title={displayName}>
            <Typography
              variant="caption"
              sx={{
                display: 'block',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {displayName}
            </Typography>
          </Tooltip>
        </Box>
      )}
    </Box>
  );
}

export default FileThumbnail;



