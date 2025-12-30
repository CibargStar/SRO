/**
 * Drag&drop загрузчик файлов с предпросмотром и базовой валидацией.
 */

import React, { useMemo, useRef, useState } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  Stack,
  Typography,
  Alert,
  Tooltip,
  IconButton,
} from '@mui/material';
import {
  CloudUpload as UploadIcon,
  FileUpload as FileUploadIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { FileSizeWarning } from './FileSizeWarning';
import { FileThumbnail } from './FileThumbnail';
import { FILE_SIZE_WARNING_THRESHOLD, MAX_FILE_SIZE, type FileType } from '@/types/template';

interface ExistingFile {
  id?: string;
  name: string;
  url?: string | null;
  mimeType?: string | null;
  fileType?: FileType | null;
  size?: number | null;
}

interface FileUploaderProps {
  label?: string;
  description?: string;
  accept?: string;
  multiple?: boolean;
  maxSize?: number;
  warningThreshold?: number;
  onFilesSelected?: (files: File[]) => void;
  onUpload?: (file: File) => Promise<void>;
  existingFiles?: ExistingFile[];
  onRemoveExisting?: (fileId?: string) => Promise<void> | void;
  disabled?: boolean;
}

function matchesAccept(file: File, accept?: string) {
  if (!accept) return true;
  const rules = accept.split(',').map((r) => r.trim()).filter(Boolean);
  if (rules.length === 0) return true;

  return rules.some((rule) => {
    if (rule === '*/*') return true;
    if (rule.endsWith('/*')) {
      const prefix = rule.replace('/*', '');
      return file.type.startsWith(`${prefix}/`);
    }
    if (rule.startsWith('.')) {
      return file.name.toLowerCase().endsWith(rule.toLowerCase());
    }
    return file.type === rule;
  });
}

export function FileUploader({
  label = 'Загрузить файл',
  description = 'Перетащите файл сюда или выберите на диске',
  accept,
  multiple,
  maxSize = MAX_FILE_SIZE,
  warningThreshold = FILE_SIZE_WARNING_THRESHOLD,
  onFilesSelected,
  onUpload,
  existingFiles = [],
  onRemoveExisting,
  disabled,
}: FileUploaderProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadErrors, setUploadErrors] = useState<string | null>(null);

  const allWarnings = useMemo(
    () =>
      selectedFiles
        .filter((file) => file.size > warningThreshold)
        .map((file) => ({ name: file.name, size: file.size })),
    [selectedFiles, warningThreshold]
  );

  const validateFiles = (files: File[]) => {
    const nextErrors: string[] = [];
    const valid: File[] = [];

    files.forEach((file) => {
      if (file.size > maxSize) {
        nextErrors.push(`Файл ${file.name} превышает лимит ${Math.round(maxSize / (1024 * 1024))} МБ`);
        return;
      }
      if (!matchesAccept(file, accept)) {
        nextErrors.push(`Файл ${file.name} имеет неподдерживаемый тип`);
        return;
      }
      valid.push(file);
    });

    setErrors(nextErrors);
    return valid;
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files || disabled) return;
    const fileArray = Array.from(files);
    const validFiles = validateFiles(fileArray);
    if (validFiles.length === 0) return;

    setSelectedFiles(validFiles);
    onFilesSelected?.(validFiles);

    if (onUpload) {
      setUploading(true);
      setUploadErrors(null);
      for (const file of validFiles) {
        try {
          await onUpload(file);
          // Очищаем selectedFiles после успешной загрузки,
          // т.к. файл теперь придет через existingFiles
          setSelectedFiles([]);
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Не удалось загрузить файл';
          setUploadErrors(message);
        }
      }
      setUploading(false);
    }
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
    handleFiles(event.dataTransfer.files);
  };

  const removeExisting = async (file: ExistingFile) => {
    if (!onRemoveExisting) return;
    await onRemoveExisting(file.id);
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Box
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setIsDragging(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          setIsDragging(false);
        }}
        onDrop={handleDrop}
        sx={{
          border: `1px dashed ${isDragging ? '#6366f1' : 'rgba(255, 255, 255, 0.25)'}`,
          backgroundColor: isDragging ? 'rgba(99, 102, 241, 0.08)' : 'rgba(255, 255, 255, 0.02)',
          borderRadius: 2,
          p: 2.5,
          textAlign: 'center',
          transition: 'all 0.15s ease',
          cursor: disabled ? 'not-allowed' : 'pointer',
        }}
        onClick={() => inputRef.current?.click()}
      >
        <input
          type="file"
          ref={inputRef}
          accept={accept}
          multiple={multiple}
          style={{ display: 'none' }}
          onChange={(e) => handleFiles(e.target.files)}
          disabled={disabled}
        />
        <UploadIcon sx={{ fontSize: 42, color: '#cdd2ff', opacity: 0.8 }} />
        <Typography variant="subtitle1" sx={{ color: '#fff', mt: 1, fontWeight: 600 }}>
          {label}
        </Typography>
        <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)', mb: 1 }}>
          {description}
        </Typography>
        <Button
          variant="contained"
          startIcon={<FileUploadIcon />}
          onClick={(e) => {
            e.stopPropagation();
            inputRef.current?.click();
          }}
          disabled={disabled || uploading}
        >
          Выбрать файл
        </Button>
        {uploading && (
          <Stack direction="row" spacing={1} justifyContent="center" alignItems="center" sx={{ mt: 1 }}>
            <CircularProgress size={18} />
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)' }}>
              Загрузка...
            </Typography>
          </Stack>
        )}
      </Box>

      {errors.length > 0 && (
        <Stack spacing={1}>
          {errors.map((err, idx) => (
            <Alert key={idx} severity="error" variant="outlined" sx={{ color: '#ffb4b4', borderColor: 'rgba(244,67,54,0.35)' }}>
              {err}
            </Alert>
          ))}
        </Stack>
      )}

      {uploadErrors && (
        <Alert severity="error" variant="outlined" sx={{ color: '#ffb4b4', borderColor: 'rgba(244,67,54,0.35)' }}>
          {uploadErrors}
        </Alert>
      )}

      {(selectedFiles.length > 0 || existingFiles.length > 0) && (
        <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
          {selectedFiles.map((file) => (
            <Box key={file.name} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
              <FileThumbnail file={file} />
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                {(file.size / (1024 * 1024)).toFixed(1)} МБ
              </Typography>
            </Box>
          ))}

          {existingFiles.map((file) => (
            <Box key={file.id || file.url || file.name} sx={{ position: 'relative' }}>
              <FileThumbnail file={file} />
              {onRemoveExisting && (
                <Tooltip title="Удалить файл">
                  <IconButton
                    size="small"
                    onClick={() => removeExisting(file)}
                    sx={{
                      position: 'absolute',
                      top: 4,
                      right: 4,
                      backgroundColor: 'rgba(0,0,0,0.35)',
                      color: '#fff',
                      '&:hover': { backgroundColor: 'rgba(0,0,0,0.5)' },
                    }}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}
            </Box>
          ))}
        </Stack>
      )}

      {allWarnings.length > 0 && (
        <Stack spacing={1}>
          {allWarnings.map((w) => (
            <FileSizeWarning key={w.name} size={w.size} threshold={warningThreshold} />
          ))}
        </Stack>
      )}
    </Box>
  );
}

export default FileUploader;





