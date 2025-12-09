import React, { useState } from 'react';
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
}

export function TemplateItemEditor({ templateId, item, index, total, onMoveUp, onMoveDown }: TemplateItemEditorProps) {
  const isText = item.type === 'TEXT';
  const [content, setContent] = useState(item.content || '');
  const [localError, setLocalError] = useState<string | null>(null);

  const updateItem = useUpdateTemplateItem();
  const deleteItem = useDeleteTemplateItem();
  const uploadFile = useUploadTemplateFile();
  const deleteFile = useDeleteTemplateFile();

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
        backgroundColor: 'rgba(255, 255, 255, 0.02)',
        borderColor: 'rgba(255, 255, 255, 0.08)',
      }}
    >
      <CardContent>
        <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2} sx={{ mb: 1 }}>
          <Typography variant="subtitle2" sx={{ color: '#fff' }}>
            Элемент #{index + 1} — {isText ? 'Текст' : 'Файл'}
          </Typography>
          <Stack direction="row" spacing={1} alignItems="center">
            <TemplateItemDragHandle
              onMoveUp={onMoveUp}
              onMoveDown={onMoveDown}
              disableUp={index === 0}
              disableDown={index === total - 1}
            />
            <Tooltip title="Удалить элемент">
              <IconButton size="small" onClick={handleDelete} disabled={deleteItem.isPending}>
                <DeleteIcon sx={{ color: '#f44336' }} fontSize="small" />
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
          <Alert severity="error" sx={{ mt: 1 }}>
            {localError}
          </Alert>
        )}
      </CardContent>

      {isText && (
        <CardActions sx={{ justifyContent: 'flex-end', px: 2, pb: 2 }}>
          <Tooltip title="Сохранить текст">
            <span>
              <IconButton onClick={handleSave} disabled={updateItem.isPending}>
                {updateItem.isPending ? (
                  <CircularProgress size={18} />
                ) : (
                  <SaveIcon sx={{ color: '#4caf50' }} />
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


