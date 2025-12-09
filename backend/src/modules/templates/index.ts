/**
 * Модуль шаблонов рассылки
 * 
 * Экспортирует все публичные компоненты модуля:
 * - TemplatesService - бизнес-логика
 * - TemplatesController - обработка HTTP запросов
 * - templatesRouter - Express маршруты
 * - репозитории и типы
 * 
 * @module modules/templates
 */

// Репозитории
export * from './templates.repository';

// Сервисы
export * from './templates.service';
export * from './variable-parser.service';

// Файловое хранилище
export * from './file-storage';

// Контроллер
export * from './templates.controller';

// Роуты
export * from './templates.routes';

// Схемы валидации
export * from './templates.schemas';


