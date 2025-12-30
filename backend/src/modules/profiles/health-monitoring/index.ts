/**
 * Публичный API модуля мониторинга здоровья профилей
 * 
 * Экспортирует все публичные компоненты модуля.
 * 
 * @module modules/profiles/health-monitoring
 */

export { HealthCheckService } from './health-check.service';
export { ProfileHealthManager } from './profile-health.manager';
export type {
  ProfileHealthCheck,
  ProfileHealthStatus,
  HealthCheckConfig,
} from './profile-health.manager';









