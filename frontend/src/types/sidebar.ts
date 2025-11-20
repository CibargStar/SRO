/**
 * Типы для модульного компонента Sidebar
 * 
 * Определяет структуру навигационных элементов и условия их отображения.
 */

import type { UserRole } from './index';

/**
 * Условие видимости элемента навигации
 * 
 * @property roles - Массив ролей, которым доступен элемент (если пустой - доступен всем)
 * @property customCheck - Дополнительная функция проверки (опционально)
 */
export interface NavigationVisibility {
  /** Роли, которым доступен элемент. Если пустой массив - доступен всем авторизованным */
  roles?: UserRole[];
  /** Дополнительная функция проверки видимости (например, проверка флагов пользователя) */
  customCheck?: (user: { role: UserRole; [key: string]: unknown }) => boolean;
}

/**
 * Элемент навигации в сайдбаре
 * 
 * @property id - Уникальный идентификатор элемента (для ключей React)
 * @property label - Текст кнопки навигации
 * @property path - Путь для React Router (используется в useNavigate)
 * @property icon - Иконка MUI (опционально, для будущего расширения)
 * @property visibility - Условия видимости элемента
 * @property onClick - Дополнительный обработчик клика (опционально)
 */
export interface SidebarNavigationItem {
  /** Уникальный идентификатор элемента */
  id: string;
  /** Текст кнопки навигации */
  label: string;
  /** Путь для React Router */
  path: string;
  /** Иконка MUI (опционально, для будущего расширения) */
  icon?: React.ComponentType;
  /** Условия видимости элемента */
  visibility: NavigationVisibility;
  /** Дополнительный обработчик клика (выполняется после навигации) */
  onClick?: () => void;
}

/**
 * Тип для функции проверки видимости элемента
 * 
 * Используется для определения, должен ли элемент отображаться для текущего пользователя.
 */
export type VisibilityChecker = (user: { role: UserRole; [key: string]: unknown } | null) => boolean;

