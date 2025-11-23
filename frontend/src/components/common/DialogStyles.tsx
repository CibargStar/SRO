/**
 * Общие стили и константы для Dialog компонентов
 * 
 * Унифицированные настройки для всех диалогов в приложении.
 */

/**
 * PaperProps для Dialog компонентов
 * Обеспечивает единый стиль для всех модальных окон
 */
export const dialogPaperProps = {
  sx: {
    backgroundColor: '#212121',
    borderRadius: '12px',
    '& .MuiDialogContent-root': {
      '&::-webkit-scrollbar': {
        display: 'none',
      },
      scrollbarWidth: 'none',
      msOverflowStyle: 'none',
    },
  },
};

/**
 * Стили для заголовка Dialog
 * Используется в Box компоненте для заголовка модального окна
 */
export const dialogTitleStyles = {
  px: 3,
  pt: 3,
  pb: 2,
  borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
};

/**
 * Стили для DialogContent
 */
export const dialogContentStyles = {
  px: 3,
  pt: 3,
};

/**
 * Стили для DialogActions
 */
export const dialogActionsStyles = {
  px: 3,
  pb: 3,
  pt: 2,
};

