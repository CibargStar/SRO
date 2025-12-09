import React from 'react';
import { IconButton, Tooltip } from '@mui/material';
import DragHandleIcon from '@mui/icons-material/DragHandle';

interface TemplateItemDragHandleProps {
  onMoveUp: () => void;
  onMoveDown: () => void;
  disableUp?: boolean;
  disableDown?: boolean;
}

export function TemplateItemDragHandle({
  onMoveUp,
  onMoveDown,
  disableUp,
  disableDown,
}: TemplateItemDragHandleProps) {
  return (
    <>
      <Tooltip title="Вверх">
        <span>
          <IconButton size="small" onClick={onMoveUp} disabled={disableUp}>
            <DragHandleIcon sx={{ transform: 'rotate(90deg)', color: 'rgba(255,255,255,0.6)' }} />
          </IconButton>
        </span>
      </Tooltip>
      <Tooltip title="Вниз">
        <span>
          <IconButton size="small" onClick={onMoveDown} disabled={disableDown}>
            <DragHandleIcon sx={{ transform: 'rotate(-90deg)', color: 'rgba(255,255,255,0.6)' }} />
          </IconButton>
        </span>
      </Tooltip>
    </>
  );
}

export default TemplateItemDragHandle;



