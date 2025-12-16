import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  CardActions,
  Typography,
  Stack,
  IconButton,
  Tooltip,
  Alert,
  CircularProgress,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import SaveIcon from '@mui/icons-material/Save';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import type { TemplateItem } from '@/types/template';
import { RichTextInput } from '@/components/common';
import { FileUploader } from '@/components/common/FileUploader';
import { TemplateItemDragHandle } from './TemplateItemDragHandle';
import { useUpdateTemplateItem, useDeleteTemplateItem, useUploadTemplateFile, useDeleteTemplateFile } from '@/hooks/useTemplates';

interface TemplateItemEditorProps {
  templateId: string;
  item: TemplateItem;
  index: number;
  total: number;
  onMoveUp: () => void;
  onMoveDown: () => void;
  hideMoveButtons?: boolean;
}

export function TemplateItemEditor({ templateId, item, index, total, onMoveUp, onMoveDown, hideMoveButtons = false }: TemplateItemEditorProps) {
  const isText = item.type === 'TEXT';
  const [content, setContent] = useState(item.content || '');
  const [localError, setLocalError] = useState<string | null>(null);

  const updateItem = useUpdateTemplateItem();
  const deleteItem = useDeleteTemplateItem();
  const uploadFile = useUploadTemplateFile();
  const deleteFile = useDeleteTemplateFile();

  // Синхронизация состояния с обновленными данными элемента
  useEffect(() => {
    if (item.id && item.content !== undefined) {
      setContent(item.content || '');
    }
  }, [item.id, item.content]);

  const handleSave = async () => {
    setLocalError(null);
    try {
      await updateItem.mutateAsync({
        templateId,
        itemId: item.id,
        data: { content },
      });
    } catch (error) {
      setLocalError((error as Error)?.message || 'Не удалось сохранить элемент');
    }
  };

  const handleDelete = async () => {
    setLocalError(null);
    try {
      await deleteItem.mutateAsync({ templateId, itemId: item.id });
    } catch (error) {
      setLocalError((error as Error)?.message || 'Не удалось удалить элемент');
    }
  };

  const handleUpload = async (file: File) => {
    setLocalError(null);
    try {
      await uploadFile.mutateAsync({ templateId, itemId: item.id, file });
    } catch (error) {
      setLocalError((error as Error)?.message || 'Не удалось загрузить файл');
    }
  };

  const handleDeleteFile = async () => {
    setLocalError(null);
    try {
      await deleteFile.mutateAsync({ templateId, itemId: item.id });
    } catch (error) {
      setLocalError((error as Error)?.message || 'Не удалось удалить файл');
    }
  };

  return (
    <Card
      variant="outlined"
      sx={{
        backgroundColor: 'rgba(255, 255, 255, 0.04)',
        border: 'none',
        borderRadius: '12px',
        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        '&:hover': {
          backgroundColor: 'rgba(255, 255, 255, 0.06)',
        },
      }}
    >
      <CardContent sx={{ p: 2.5 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2} sx={{ mb: 2 }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
            }}
          >
            <Box
              sx={{
                width: 24,
                height: 24,
                borderRadius: '6px',
                backgroundColor: 'rgba(99, 102, 241, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#818cf8',
                fontSize: '0.75rem',
                fontWeight: 600,
              }}
            >
              {index + 1}
            </Box>
            <Typography variant="subtitle2" sx={{ color: '#f5f5f5', fontWeight: 500 }}>
              {isText ? 'Текст' : 'Файл'}
            </Typography>
          </Box>
          <Stack direction="row" spacing={0.5} alignItems="center">
            {!hideMoveButtons && total > 1 && (
              <TemplateItemDragHandle
                onMoveUp={onMoveUp}
                onMoveDown={onMoveDown}
                disableUp={index === 0}
                disableDown={index === total - 1}
              />
            )}
            <Tooltip title="Удалить элемент">
              <IconButton 
                size="small" 
                onClick={handleDelete} 
                disabled={deleteItem.isPending}
                sx={{
                  color: 'rgba(255, 255, 255, 0.6)',
                  '&:hover': {
                    color: '#f44336',
                    backgroundColor: 'rgba(244, 67, 54, 0.1)',
                  },
                }}
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
        </Stack>

        {isText ? (
          <RichTextInput
            value={content}
            onChange={setContent}
            rows={4}
            showVariables
            helperText="Можно использовать переменные {{firstName}}, {{lastName}}, {{phone}} и др."
          />
        ) : (
          <FileUploader
            label="Файл для отправки"
            description="Поддерживаются изображения, видео и документы"
            accept=".jpg,.jpeg,.png,.gif,.webp,.mp4,.pdf,.doc,.docx,.xls,.xlsx"
            multiple={false}
            existingFiles={
              item.fileUrl
                ? [
                    {
                      id: item.id,
                      name: item.fileName || 'Файл',
                      url: item.fileUrl,
                      mimeType: item.mimeType || undefined,
                      fileType: item.fileType || undefined,
                      size: item.fileSize || undefined,
                    },
                  ]
                : []
            }
            onUpload={handleUpload}
            onRemoveExisting={handleDeleteFile}
            disabled={uploadFile.isPending || deleteFile.isPending}
          />
        )}

        {localError && (
          <Alert 
            severity="error" 
            sx={{ 
              mt: 1,
              borderRadius: '12px',
              backgroundColor: 'rgba(244, 67, 54, 0.1)',
              color: '#ffffff',
              border: 'none',
            }}
          >
            {localError}
          </Alert>
        )}
      </CardContent>

      {isText && (
        <CardActions sx={{ justifyContent: 'flex-end', px: 2.5, pb: 2.5, pt: 0 }}>
          <Tooltip title="Сохранить текст">
            <span>
              <IconButton 
                onClick={handleSave} 
                disabled={updateItem.isPending}
                sx={{
                  color: 'rgba(255, 255, 255, 0.7)',
                  '&:hover': {
                    color: '#4caf50',
                    backgroundColor: 'rgba(76, 175, 80, 0.1)',
                  },
                }}
              >
                {updateItem.isPending ? (
                  <CircularProgress size={18} color="inherit" />
                ) : (
                  <SaveIcon fontSize="small" />
                )}
              </IconButton>
            </span>
          </Tooltip>
        </CardActions>
      )}
    </Card>
  );
}

export default TemplateItemEditor;


