/**
 * Карточка шаблона для отображения в списке
 */

import React from 'react';
import {
  Card,
  CardContent,
  CardActions,
  Typography,
  Box,
  IconButton,
  Tooltip,
  Stack,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  ContentCopy as DuplicateIcon,
  Visibility as PreviewIcon,
  DriveFileMove as MoveIcon,
  AttachFile as FileIcon,
} from '@mui/icons-material';
import { TemplateTypeBadge } from './TemplateTypeBadge';
import { MessengerTargetBadge } from './MessengerTargetBadge';
import type { Template } from '@/types/template';

interface TemplateCardProps {
  template: Template;
  onEdit?: (template: Template) => void;
  onDelete?: (template: Template) => void;
  onDuplicate?: (template: Template) => void;
  onPreview?: (template: Template) => void;
  onMove?: (template: Template) => void;
}

const StyledCard = styled(Card)(({ theme }) => ({
  backgroundColor: 'rgba(30, 30, 30, 0.9)',
  border: '1px solid rgba(255, 255, 255, 0.1)',
  borderRadius: 12,
  transition: 'all 0.2s ease-in-out',
  '&:hover': {
    borderColor: 'rgba(255, 255, 255, 0.2)',
    transform: 'translateY(-2px)',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
  },
}));

const StyledCardContent = styled(CardContent)({
  paddingBottom: 8,
});

const StyledCardActions = styled(CardActions)({
  padding: '8px 16px',
  borderTop: '1px solid rgba(255, 255, 255, 0.05)',
  justifyContent: 'space-between',
});

const ActionButton = styled(IconButton)(({ theme }) => ({
  color: 'rgba(255, 255, 255, 0.6)',
  '&:hover': {
    color: '#fff',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
}));

export function TemplateCard({
  template,
  onEdit,
  onDelete,
  onDuplicate,
  onPreview,
  onMove,
}: TemplateCardProps) {
  const itemsCount = template._count?.items ?? template.items?.length ?? 0;

  return (
    <StyledCard>
      <StyledCardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
          <Typography
            variant="h6"
            sx={{
              color: '#fff',
              fontWeight: 500,
              fontSize: '1rem',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              maxWidth: '70%',
            }}
          >
            {template.name}
          </Typography>
          <TemplateTypeBadge type={template.type} />
        </Box>

        {template.description && (
          <Typography
            variant="body2"
            sx={{
              color: 'rgba(255, 255, 255, 0.6)',
              mb: 1.5,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              minHeight: 40,
            }}
          >
            {template.description}
          </Typography>
        )}

        <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1.5 }}>
          <MessengerTargetBadge target={template.messengerTarget} />
          
          {itemsCount > 0 && (
            <Tooltip title={`${itemsCount} элемент${itemsCount === 1 ? '' : itemsCount < 5 ? 'а' : 'ов'}`}>
              <Box sx={{ display: 'flex', alignItems: 'center', color: 'rgba(255, 255, 255, 0.5)' }}>
                <FileIcon sx={{ fontSize: 16, mr: 0.5 }} />
                <Typography variant="caption">{itemsCount}</Typography>
              </Box>
            </Tooltip>
          )}

          {template.category && (
            <Typography
              variant="caption"
              sx={{
                color: 'rgba(255, 255, 255, 0.4)',
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                px: 1,
                py: 0.25,
                borderRadius: 1,
              }}
            >
              {template.category.name}
            </Typography>
          )}
        </Stack>
      </StyledCardContent>

      <StyledCardActions>
        <Box>
          {onPreview && (
            <Tooltip title="Предпросмотр">
              <ActionButton size="small" onClick={() => onPreview(template)}>
                <PreviewIcon fontSize="small" />
              </ActionButton>
            </Tooltip>
          )}
          {onEdit && (
            <Tooltip title="Редактировать">
              <ActionButton size="small" onClick={() => onEdit(template)}>
                <EditIcon fontSize="small" />
              </ActionButton>
            </Tooltip>
          )}
          {onDuplicate && (
            <Tooltip title="Дублировать">
              <ActionButton size="small" onClick={() => onDuplicate(template)}>
                <DuplicateIcon fontSize="small" />
              </ActionButton>
            </Tooltip>
          )}
          {onMove && (
            <Tooltip title="Переместить">
              <ActionButton size="small" onClick={() => onMove(template)}>
                <MoveIcon fontSize="small" />
              </ActionButton>
            </Tooltip>
          )}
        </Box>
        
        {onDelete && (
          <Tooltip title="Удалить">
            <ActionButton
              size="small"
              onClick={() => onDelete(template)}
              sx={{ '&:hover': { color: '#f44336' } }}
            >
              <DeleteIcon fontSize="small" />
            </ActionButton>
          </Tooltip>
        )}
      </StyledCardActions>
    </StyledCard>
  );
}

export default TemplateCard;


