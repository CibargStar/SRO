/**
 * Компонент элемента навигации в сайдбаре
 * 
 * Отображает отдельную кнопку навигации с плавными анимациями.
 * Поддерживает активное состояние (когда путь совпадает с текущим).
 * 
 * ОСОБЕННОСТИ:
 * - Плавная анимация при наведении
 * - Подсветка активного элемента
 * - Плавный переход цвета и фона
 * - Минималистичный дизайн
 * 
 * @example
 * ```typescript
 * <SidebarItem
 *   item={navigationItem}
 *   isActive={currentPath === item.path}
 *   onClick={handleNavigation}
 * />
 * ```
 */

import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Box, Button, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import type { SidebarNavigationItem } from '@/types/sidebar';

/**
 * Стилизованный контейнер для элемента навигации
 * 
 * Обеспечивает:
 * - Плавные переходы для всех интерактивных состояний
 * - Минималистичный дизайн
 * - Современные анимации
 * - Центрирование элементов
 */
const NavigationItemContainer = styled(Box)(({ theme }) => ({
  width: '100%',
  display: 'flex',
  justifyContent: 'center', // Центрирование кнопки
  marginBottom: theme.spacing(0.5),
  
  // Плавные переходы для всех свойств
  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)', // ease-in-out кривая
}));

/**
 * Стилизованная кнопка навигации
 * 
 * Минималистичный дизайн с плавными анимациями для темной темы.
 * Для кнопки выхода (isLogout) при наведении меняется только цвет текста.
 */
const NavigationButton = styled(Button, {
  shouldForwardProp: (prop) => prop !== 'isActive' && prop !== 'isLogout',
})<{ isActive?: boolean; isLogout?: boolean }>(({ theme, isActive, isLogout }) => ({
  width: '100%',
  maxWidth: 160, // Ограничение ширины для центрирования
  justifyContent: 'center', // Центрирование содержимого
  padding: theme.spacing(1.5, 2),
  textTransform: 'none', // Без автоматического uppercase
  borderRadius: theme.spacing(1.5),
  
  // Базовые стили для темной темы
  backgroundColor: 'transparent',
  color: 'rgba(255, 255, 255, 0.7)', // Полупрозрачный белый текст
  border: 'none',
  
  // Плавные переходы
  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  
  // Стили для активного состояния
  ...(isActive && {
    backgroundColor: 'rgba(255, 255, 255, 0.15)', // Полупрозрачный белый фон
    color: '#ffffff', // Полностью белый текст
    fontWeight: 600,
    
    // Легкая тень для активного элемента
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
  }),
  
  // Стили при наведении (разные для обычных кнопок и кнопки выхода)
  '&:hover': {
    // Для кнопки выхода - только изменение цвета текста на более яркий белый
    ...(isLogout
      ? {
          backgroundColor: 'transparent', // Фон остается прозрачным
          color: '#ffffff', // Яркий белый текст
        }
      : {
          // Для обычных кнопок - стандартное поведение
          backgroundColor: 'rgba(255, 255, 255, 0.1)', // Легкий белый фон при наведении
          color: '#ffffff', // Полностью белый текст
          boxShadow: '0 2px 12px rgba(0, 0, 0, 0.2)', // Легкая тень при наведении
        }),
    transform: 'none', // Отменяем transform из родителя для плавности
  },
  
  // Стили при фокусе (для доступности)
  '&:focus-visible': {
    outline: '2px solid rgba(255, 255, 255, 0.5)',
    outlineOffset: 2,
  },
  
  // Отключаем стандартные стили MUI для disabled
  '&:disabled': {
    opacity: 0.5,
  },
}));

/**
 * Props для компонента SidebarItem
 */
interface SidebarItemProps {
  /** Элемент навигации для отображения */
  item: SidebarNavigationItem;
  /** Флаг активного состояния (когда путь совпадает с текущим) */
  isActive?: boolean;
  /** Дополнительный обработчик клика (выполняется после навигации) */
  onClick?: () => void;
  /** Флаг кнопки выхода (для особого стиля при наведении) */
  isLogout?: boolean;
}

/**
 * Компонент элемента навигации в сайдбаре
 * 
 * Отображает кнопку навигации с плавными анимациями и поддержкой активного состояния.
 * Для кнопки выхода при наведении меняется только цвет текста на более яркий белый.
 * 
 * @param item - Элемент навигации для отображения
 * @param isActive - Флаг активного состояния
 * @param onClick - Дополнительный обработчик клика
 * @param isLogout - Флаг кнопки выхода (для особого стиля при наведении)
 * 
 * @returns JSX элемент кнопки навигации
 */
export function SidebarItem({ item, isActive = false, onClick, isLogout = false }: SidebarItemProps) {
  const navigate = useNavigate();

  /**
   * Обработчик клика по элементу навигации
   * 
   * Выполняет:
   * 1. Навигацию на указанный путь
   * 2. Дополнительный обработчик (если указан)
   */
  const handleClick = () => {
    navigate(item.path);
    
    // Выполняем дополнительный обработчик (если указан)
    // Например, для logout это очистка состояния
    if (onClick) {
      onClick();
    }
    
    // Выполняем обработчик из конфигурации (если указан)
    if (item.onClick) {
      item.onClick();
    }
  };

  return (
    <NavigationItemContainer>
      <NavigationButton
        onClick={handleClick}
        isActive={isActive}
        isLogout={isLogout}
        fullWidth
        disableRipple // Отключаем стандартный ripple эффект MUI для кастомной анимации
      >
        {/* Иконка (если указана в конфигурации) */}
        {item.icon && (
          <Box
            component={item.icon}
            sx={{
              marginRight: item.label ? 1 : 0, // Отступ только если есть текст
              fontSize: '1.25rem',
              transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              // Легкая анимация иконки при наведении
              '&:hover': {
                transform: 'scale(1.1)',
              },
            }}
          />
        )}
        
        {/* Текст кнопки */}
        <Typography
          variant="body1"
          component="span"
          sx={{
            fontWeight: isActive ? 600 : 400,
            transition: 'font-weight 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        >
          {item.label}
        </Typography>
      </NavigationButton>
    </NavigationItemContainer>
  );
}

