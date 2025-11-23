/**
 * Модуль экспорта групп клиентов
 * 
 * Предоставляет функционал экспорта групп клиентов в Excel/CSV файлы.
 * 
 * @module modules/export
 */

export { exportGroupHandler } from './export.controller';
export { exportGroup } from './services/export.service';
export { exportGroupQuerySchema, type ExportGroupQuery } from './schemas/export.schemas';

