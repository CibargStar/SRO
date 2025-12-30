/**
 * Менеджер мониторинга здоровья профилей
 * 
 * Отслеживает состояние профилей, проверяет их работоспособность
 * и определяет необходимость перезапуска.
 * 
 * @module modules/profiles/health-monitoring/profile-health.manager
 */

import { ChromeProcessInfo } from '../chrome-process/chrome-process.manager';
import { ProcessResourceStats } from '../resource-monitoring/process-resources.manager';

/**
 * Статус здоровья профиля
 */
export type ProfileHealthStatus = 'healthy' | 'unhealthy' | 'degraded' | 'unknown';

/**
 * Результат проверки здоровья профиля
 */
export interface ProfileHealthCheck {
  /** ID профиля */
  profileId: string;
  /** Статус здоровья */
  status: ProfileHealthStatus;
  /** Время проверки */
  timestamp: Date;
  /** Детали проверки */
  details: {
    /** Процесс запущен */
    processRunning: boolean;
    /** Браузер подключен */
    browserConnected: boolean;
    /** Использование CPU в процентах */
    cpuUsage?: number;
    /** Использование памяти в MB */
    memoryUsage?: number;
    /** Превышение лимитов ресурсов */
    resourceLimitsExceeded?: boolean;
    /** Последняя ошибка */
    lastError?: string;
  };
}

/**
 * Конфигурация проверки здоровья
 */
export interface HealthCheckConfig {
  /** Максимальное использование CPU (0-100) */
  maxCpuUsage?: number;
  /** Максимальное использование памяти в MB */
  maxMemoryUsage?: number;
  /** Таймаут проверки в миллисекундах */
  timeout?: number;
}

/**
 * Менеджер мониторинга здоровья профилей
 */
export class ProfileHealthManager {
  private healthHistory: Map<string, ProfileHealthCheck[]> = new Map();
  private readonly maxHistorySize = 100; // Максимальное количество записей в истории

  /**
   * Проверка здоровья профиля
   * 
   * @param profileId - ID профиля
   * @param processInfo - Информация о процессе Chrome
   * @param resourceStats - Статистика ресурсов
   * @param config - Конфигурация проверки
   * @returns Результат проверки здоровья
   */
  checkProfileHealth(
    profileId: string,
    processInfo: ChromeProcessInfo | null,
    resourceStats: ProcessResourceStats | null,
    config?: HealthCheckConfig
  ): ProfileHealthCheck {
    const timestamp = new Date();
    const details: ProfileHealthCheck['details'] = {
      processRunning: false,
      browserConnected: false,
    };

    // Проверка процесса
    if (processInfo) {
      details.processRunning = processInfo.status === 'running';
      details.browserConnected = processInfo.browser.isConnected();
    }

    // Проверка ресурсов
    if (resourceStats) {
      details.cpuUsage = resourceStats.cpuUsage;
      details.memoryUsage = resourceStats.memoryUsage;

      // Проверка превышения лимитов
      if (config) {
        if (config.maxCpuUsage !== undefined && resourceStats.cpuUsage > config.maxCpuUsage) {
          details.resourceLimitsExceeded = true;
        }
        if (
          config.maxMemoryUsage !== undefined &&
          resourceStats.memoryUsage > config.maxMemoryUsage
        ) {
          details.resourceLimitsExceeded = true;
        }
      }
    }

    // Определение статуса здоровья
    let status: ProfileHealthStatus = 'unknown';

    if (!processInfo || !details.processRunning) {
      status = 'unhealthy';
    } else if (!details.browserConnected) {
      status = 'unhealthy';
    } else if (details.resourceLimitsExceeded) {
      status = 'degraded';
    } else if (details.processRunning && details.browserConnected) {
      status = 'healthy';
    }

    const healthCheck: ProfileHealthCheck = {
      profileId,
      status,
      timestamp,
      details,
    };

    // Сохранение в историю
    this.addToHistory(profileId, healthCheck);

    return healthCheck;
  }

  /**
   * Получение последней проверки здоровья
   * 
   * @param profileId - ID профиля
   * @returns Последняя проверка здоровья или null
   */
  getLastHealthCheck(profileId: string): ProfileHealthCheck | null {
    const history = this.healthHistory.get(profileId);
    return history && history.length > 0 ? history[history.length - 1] : null;
  }

  /**
   * Получение истории проверок здоровья
   * 
   * @param profileId - ID профиля
   * @param limit - Максимальное количество записей
   * @returns История проверок здоровья
   */
  getHealthHistory(profileId: string, limit: number = 100): ProfileHealthCheck[] {
    const history = this.healthHistory.get(profileId) || [];
    return history.slice(-limit);
  }

  /**
   * Очистка истории проверок здоровья
   * 
   * @param profileId - ID профиля (опционально, если не указан - очищает всю историю)
   */
  clearHistory(profileId?: string): void {
    if (profileId) {
      this.healthHistory.delete(profileId);
    } else {
      this.healthHistory.clear();
    }
  }

  /**
   * Добавление проверки в историю
   * 
   * @param profileId - ID профиля
   * @param healthCheck - Результат проверки
   */
  private addToHistory(profileId: string, healthCheck: ProfileHealthCheck): void {
    if (!this.healthHistory.has(profileId)) {
      this.healthHistory.set(profileId, []);
    }

    const history = this.healthHistory.get(profileId)!;
    history.push(healthCheck);

    // Ограничение размера истории
    if (history.length > this.maxHistorySize) {
      history.shift();
    }
  }

  /**
   * Получение статистики здоровья профиля
   * 
   * @param profileId - ID профиля
   * @returns Статистика здоровья
   */
  getHealthStats(profileId: string): {
    totalChecks: number;
    healthyCount: number;
    unhealthyCount: number;
    degradedCount: number;
    lastCheck: ProfileHealthCheck | null;
  } {
    const history = this.getHealthHistory(profileId);
    const healthyCount = history.filter((h) => h.status === 'healthy').length;
    const unhealthyCount = history.filter((h) => h.status === 'unhealthy').length;
    const degradedCount = history.filter((h) => h.status === 'degraded').length;

    return {
      totalChecks: history.length,
      healthyCount,
      unhealthyCount,
      degradedCount,
      lastCheck: history.length > 0 ? history[history.length - 1] : null,
    };
  }
}






