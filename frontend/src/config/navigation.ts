/**
 * Конфигурация навигации для Sidebar
 * 
 * Централизованное место для управления элементами навигации.
 * Легко масштабируется - просто добавьте новый элемент в массив.
 * 
 * ПРИМЕЧАНИЕ: Порядок элементов в массиве определяет порядок отображения в сайдбаре.
 * 
 * @example
 * ```typescript
 * // Добавление нового элемента навигации:
 * {
 *   id: 'dashboard',
 *   label: 'Главная',
 *   path: '/',
 *   visibility: {
 *     roles: ['ROOT', 'USER'], // Доступно всем авторизованным
 *   },
 * }
 * ```
 */

import type { SidebarNavigationItem } from '@/types/sidebar';

/**
 * Конфигурация элементов навигации
 * 
 * Каждый элемент определяет:
 * - id: уникальный идентификатор
 * - label: текст кнопки
 * - path: путь для React Router
 * - visibility: условия отображения (роли, кастомные проверки)
 * 
 * МАСШТАБИРОВАНИЕ:
 * Для добавления нового элемента просто добавьте объект в массив.
 * Для изменения порядка - переставьте элементы в массиве.
 */
export const navigationConfig: SidebarNavigationItem[] = [
  /**
   * Управление пользователями (только для ROOT)
   * 
   * Доступен только пользователям с ролью ROOT.
   */
  {
    id: 'admin-users',
    label: 'Пользователи',
    path: '/admin/users',
    visibility: {
      roles: ['ROOT'], // Только ROOT может видеть этот элемент
    },
  },
  
  /**
   * Управление регионами (только для ROOT)
   * 
   * Доступен только пользователям с ролью ROOT.
   */
  {
    id: 'admin-regions',
    label: 'Регионы',
    path: '/admin/regions',
    visibility: {
      roles: ['ROOT'], // Только ROOT может видеть этот элемент
    },
  },
  
  /**
   * Управление лимитами профилей (только для ROOT)
   * 
   * Доступен только пользователям с ролью ROOT.
   */
  {
    id: 'admin-profile-limits',
    label: 'Лимиты профилей',
    path: '/admin/profile-limits',
    visibility: {
      roles: ['ROOT'], // Только ROOT может видеть этот элемент
    },
  },
  
  /**
   * Управление конфигурациями проверки мессенджеров (только для ROOT)
   * 
   * Доступен только пользователям с ролью ROOT.
   * Позволяет настраивать интервалы проверки статуса входа для каждого мессенджера.
   */
  {
    id: 'admin-messenger-configs',
    label: 'Конфигурации мессенджеров',
    path: '/admin/messenger-configs',
    visibility: {
      roles: ['ROOT'], // Только ROOT может видеть этот элемент
    },
  },
  
  /**
   * Управление клиентами (доступно всем авторизованным)
   * 
   * Каждый пользователь управляет только своими клиентами.
   * Включает управление группами клиентов.
   */
  {
    id: 'clients',
    label: 'Клиенты',
    path: '/clients',
    visibility: {
      roles: [], // Доступно всем авторизованным
    },
  },
  
  /**
   * Управление профилями Chrome (доступно всем авторизованным)
   * 
   * Каждый пользователь управляет только своими профилями.
   * Включает создание, запуск, остановку и мониторинг профилей.
   */
  {
    id: 'profiles',
    label: 'Профили Chrome',
    path: '/profiles',
    visibility: {
      roles: [], // Доступно всем авторизованным
    },
  },
  
  /**
   * Выход из системы (доступен всем авторизованным)
   * 
   * Специальный элемент - не навигация, а действие.
   * Обрабатывается отдельно в компоненте Sidebar.
   */
  {
    id: 'logout',
    label: 'Выход',
    path: '/login', // После выхода редирект на /login
    visibility: {
      // Пустой массив roles означает "доступно всем авторизованным"
      roles: [],
    },
  },
];

/**
 * Утилита для фильтрации элементов навигации по видимости
 * 
 * Проверяет каждый элемент на соответствие условиям видимости
 * для текущего пользователя.
 * 
 * @param items - Массив элементов навигации
 * @param user - Данные пользователя (null если не авторизован)
 * @returns Отфильтрованный массив элементов, доступных пользователю
 * 
 * @example
 * ```typescript
 * const visibleItems = filterVisibleItems(navigationConfig, user);
 * ```
 */
export function filterVisibleItems(
  items: SidebarNavigationItem[],
  user: { role: string; [key: string]: unknown } | null
): SidebarNavigationItem[] {
  if (!user) {
    return []; // Если пользователь не авторизован, ничего не показываем
  }

  return items.filter((item) => {
    const { roles = [], customCheck } = item.visibility;

    // Если roles пустой массив - элемент доступен всем авторизованным
    if (roles.length === 0 && !customCheck) {
      return true;
    }

    // Проверка роли
    const hasRole = roles.length === 0 || roles.includes(user.role as 'ROOT' | 'USER');

    // Проверка кастомной функции (если есть)
    const passesCustomCheck = customCheck ? customCheck(user) : true;

    return hasRole && passesCustomCheck;
  });
}

