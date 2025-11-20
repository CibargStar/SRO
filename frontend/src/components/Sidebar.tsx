/**
 * Модульный компонент Sidebar
 * 
 * Единый компонент сайдбара, содержимое которого зависит от роли пользователя.
 * Использует конфигурацию навигации для определения видимых элементов.
 * 
 * ОСОБЕННОСТИ:
 * - Модульная архитектура - легко добавлять новые элементы
 * - Ролевая видимость - элементы отображаются в зависимости от роли
 * - Минималистичный дизайн
 * - Масштабируемость - просто добавьте элемент в navigationConfig
 * 
 * АРХИТЕКТУРА:
 * 1. Конфигурация навигации (navigationConfig) определяет все элементы
 * 2. Фильтрация по видимости (filterVisibleItems) скрывает недоступные элементы
 * 3. SidebarItem отображает каждый элемент с анимациями
 * 4. Интеграция с React Router для активного состояния
 * 
 * @example
 * ```typescript
 * <Sidebar onLogout={handleLogout} />
 * ```
 */

import React, { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { Box } from '@mui/material';
import { styled } from '@mui/material/styles';
import { useAuthStore } from '@/store';
import { useLogout } from '@/hooks/useAuth';
import { navigationConfig, filterVisibleItems } from '@/config/navigation';
import { SidebarItem } from './SidebarItem';

/**
 * Стилизованный контейнер сайдбара
 * 
 * Обеспечивает:
 * - Фиксированное позиционирование слева
 * - Темный минималистичный дизайн
 * - Адаптивность (можно расширить для мобильных устройств)
 */
const SidebarContainer = styled(Box)(({ theme }) => ({
  position: 'fixed',
  left: 0,
  top: 0,
  height: '100vh',
  width: 200, // Уменьшенная ширина сайдбара
  backgroundColor: '#1a1a1a', // Темный фон
  padding: theme.spacing(2),
  overflowY: 'auto',
  overflowX: 'hidden',
  display: 'flex',
  flexDirection: 'column',
  
  // Кастомный скроллбар для темной темы
  '&::-webkit-scrollbar': {
    width: 6,
  },
  '&::-webkit-scrollbar-track': {
    background: 'transparent',
  },
  '&::-webkit-scrollbar-thumb': {
    background: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 3,
    '&:hover': {
      background: 'rgba(255, 255, 255, 0.3)',
    },
  },
  
  // Z-index для отображения поверх контента
  zIndex: theme.zIndex.drawer,
}));

/**
 * Контейнер для элементов навигации
 * 
 * Группирует элементы навигации с отступами и центрированием.
 */
const NavigationContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center', // Центрирование кнопок
  gap: theme.spacing(1),
  marginTop: theme.spacing(2),
}));

/**
 * Контейнер для элементов действий (logout и т.д.)
 * 
 * Размещается внизу сайдбара с автоматическим отступом сверху.
 */
const ActionsContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center', // Центрирование кнопок
  gap: theme.spacing(1),
  marginTop: 'auto', // Автоматический отступ сверху (прижимает к низу)
  paddingTop: theme.spacing(2),
}));


/**
 * Props для компонента Sidebar
 */
interface SidebarProps {
  /** Дополнительный класс для стилизации (опционально) */
  className?: string;
}

/**
 * Компонент Sidebar
 * 
 * Отображает модульный сайдбар с элементами навигации в зависимости от роли пользователя.
 * 
 * ЛОГИКА:
 * 1. Получает данные пользователя из Zustand store
 * 2. Фильтрует элементы навигации по видимости
 * 3. Разделяет элементы на группы (основные и действия)
 * 4. Отображает каждый элемент через SidebarItem
 * 
 * МАСШТАБИРОВАНИЕ:
 * Для добавления нового элемента просто добавьте его в navigationConfig.
 * Для изменения порядка - переставьте элементы в массиве.
 * Для изменения видимости - измените visibility в конфигурации.
 * 
 * @param className - Дополнительный класс для стилизации
 * 
 * @returns JSX элемент сайдбара
 */
export function Sidebar({ className }: SidebarProps) {
  const location = useLocation();
  const user = useAuthStore((state) => state.user);
  const logoutMutation = useLogout();

  /**
   * Фильтрация элементов навигации по видимости
   * 
   * Использует useMemo для оптимизации - пересчитывается только при изменении пользователя.
   */
  const visibleItems = useMemo(() => {
    if (!user) {
      return []; // Если пользователь не авторизован, ничего не показываем
    }
    
    return filterVisibleItems(navigationConfig, user);
  }, [user]);

  /**
   * Разделение элементов на группы
   * 
   * Разделяет элементы на:
   * - Основные элементы навигации (все кроме logout)
   * - Действия (logout и другие действия)
   * 
   * Это позволяет визуально разделить навигацию и действия.
   */
  const { navigationItems, actionItems } = useMemo(() => {
    const navItems = visibleItems.filter((item) => item.id !== 'logout');
    const actItems = visibleItems.filter((item) => item.id === 'logout');
    
    return {
      navigationItems: navItems,
      actionItems: actItems,
    };
  }, [visibleItems]);

  /**
   * Обработчик выхода из системы
   * 
   * Выполняет logout через React Query mutation.
   * После успешного выхода происходит автоматический редирект на /login
   * (через логику в useLogout и ProtectedRoute).
   */
  const handleLogout = () => {
    logoutMutation.mutate();
  };

  // Если пользователь не авторизован, не показываем сайдбар
  if (!user) {
    return null;
  }

  return (
    <SidebarContainer className={className}>
      {/* Основные элементы навигации */}
      {navigationItems.length > 0 && (
        <NavigationContainer>
          {navigationItems.map((item) => (
            <SidebarItem
              key={item.id}
              item={item}
              isActive={location.pathname === item.path}
            />
          ))}
        </NavigationContainer>
      )}

      {/* Элементы действий (logout и т.д.) - размещены внизу */}
      {actionItems.length > 0 && (
        <ActionsContainer>
          {actionItems.map((item) => (
            <SidebarItem
              key={item.id}
              item={item}
              isActive={false} // Действия не имеют активного состояния
              isLogout={item.id === 'logout'} // Специальный стиль для кнопки выхода
              onClick={item.id === 'logout' ? handleLogout : undefined}
            />
          ))}
        </ActionsContainer>
      )}
    </SidebarContainer>
  );
}

