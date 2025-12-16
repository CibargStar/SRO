/**
 * Карточка шаблона для отображения в списке
 */

import React from 'react';
import {
  Card,
  CardContent,
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
  backgroundColor: 'rgba(255, 255, 255, 0.08)',
  border: 'none',
  borderRadius: '16px',
  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  '&:hover': {
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    transform: 'translateY(-4px)',
    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.15)',
  },
}));

const StyledCardContent = styled(CardContent)({
  padding: '20px',
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  '&:last-child': {
    paddingBottom: '20px',
  },
});

const ActionButton = styled(IconButton)(({ theme }) => ({
  color: 'rgba(255, 255, 255, 0.7)',
  padding: '8px',
  transition: 'all 0.2s ease',
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
  return (
    <StyledCard>
      <StyledCardContent>
        {/* Header with title and badge */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
          <Typography
            variant="h6"
            sx={{
              color: '#f5f5f5',
              fontWeight: 500,
              fontSize: '1.1rem',
              lineHeight: 1.3,
              flex: 1,
              pr: 1,
            }}
          >
            {template.name}
          </Typography>
          <TemplateTypeBadge type={template.type} />
        </Box>

        {/* Description */}
        {template.description && (
          <Typography
            variant="body2"
            sx={{
              color: 'rgba(255, 255, 255, 0.7)',
              mb: 2,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              lineHeight: 1.5,
              fontSize: '0.875rem',
            }}
          >
            {template.description}
          </Typography>
        )}

        {/* Footer with badges and actions */}
        <Box sx={{ mt: 'auto', pt: 2 }}>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" sx={{ mb: 1.5 }}>
            <MessengerTargetBadge target={template.messengerTarget} />
            {template.category && (
              <Typography
                variant="caption"
                sx={{
                  color: 'rgba(255, 255, 255, 0.6)',
                  fontSize: '0.75rem',
                }}
              >
                {template.category.name}
              </Typography>
            )}
          </Stack>

          {/* Actions row */}
          <Box
            sx={{
              display: 'flex',
              gap: 0.5,
              pt: 1.5,
              borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            }}
          >
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
            {onDelete && (
              <Tooltip title="Удалить">
                <ActionButton
                  size="small"
                  onClick={() => onDelete(template)}
                  sx={{
                    ml: 'auto',
                    '&:hover': {
                      color: '#f44336',
                      backgroundColor: 'rgba(244, 67, 54, 0.1)',
                    },
                  }}
                >
                  <DeleteIcon fontSize="small" />
                </ActionButton>
              </Tooltip>
            )}
          </Box>
        </Box>
      </StyledCardContent>
    </StyledCard>
  );
}

export default TemplateCard;



