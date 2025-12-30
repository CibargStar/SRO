/**
 * Публичный API модуля аналитики профилей
 * 
 * Экспортирует все публичные компоненты модуля.
 * 
 * @module modules/profiles/analytics
 */

export { AnalyticsService } from './analytics.service';
export { StatsAggregator } from './stats-aggregator';
export type { ProfileAnalytics } from './analytics.service';
export type {
  AggregatedResourceStats,
  AggregatedNetworkStats,
  AggregationPeriod,
} from './stats-aggregator';






