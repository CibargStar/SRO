/**
 * Менеджер управления алертами и уведомлениями
 * 
 * Управляет созданием, хранением и историей алертов для профилей.
 * 
 * @module modules/profiles/notifications/alert.manager
 */

import logger from '../../../config/logger';

/**
 * Тип алерта
 */
export type AlertType =
  | 'RESOURCE_LIMIT_EXCEEDED'
  | 'PROFILE_CRASHED'
  | 'PROFILE_RESTARTED'
  | 'PROFILE_HEALTH_DEGRADED'
  | 'NETWORK_LIMIT_EXCEEDED'
  | 'PROFILE_ERROR'
  | 'MESSENGER_LOGIN_REQUIRED';

/**
 * Уровень серьезности алерта
 */
export type AlertSeverity = 'info' | 'warning' | 'error' | 'critical';

/**
 * Алерт/уведомление
 */
export interface Alert {
  /** ID алерта */
  id: string;
  /** ID профиля */
  profileId: string;
  /** ID пользователя */
  userId: string;
  /** Тип алерта */
  type: AlertType;
  /** Уровень серьезности */
  severity: AlertSeverity;
  /** Заголовок */
  title: string;
  /** Сообщение */
  message: string;
  /** Дополнительные данные */
  metadata?: Record<string, unknown>;
  /** Время создания */
  timestamp: Date;
  /** Прочитан ли алерт */
  read: boolean;
}

/**
 * Менеджер алертов
 */
export class AlertManager {
  private alerts: Map<string, Alert[]> = new Map();
  private readonly maxAlertsPerProfile = 1000; // Максимальное количество алертов на профиль

  /**
   * Создание нового алерта
   * 
   * @param profileId - ID профиля
   * @param userId - ID пользователя
   * @param type - Тип алерта
   * @param severity - Уровень серьезности
   * @param title - Заголовок
   * @param message - Сообщение
   * @param metadata - Дополнительные данные
   * @returns Созданный алерт
   */
  createAlert(
    profileId: string,
    userId: string,
    type: AlertType,
    severity: AlertSeverity,
    title: string,
    message: string,
    metadata?: Record<string, unknown>
  ): Alert {
    const alert: Alert = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      profileId,
      userId,
      type,
      severity,
      title,
      message,
      metadata,
      timestamp: new Date(),
      read: false,
    };

    if (!this.alerts.has(profileId)) {
      this.alerts.set(profileId, []);
    }

    const profileAlerts = this.alerts.get(profileId)!;
    profileAlerts.push(alert);

    // Ограничение размера истории
    if (profileAlerts.length > this.maxAlertsPerProfile) {
      profileAlerts.shift();
    }

    logger.info('Alert created', {
      alertId: alert.id,
      profileId,
      userId,
      type,
      severity,
    });

    return alert;
  }

  /**
   * Получение алертов для профиля
   * 
   * @param profileId - ID профиля
   * @param limit - Максимальное количество алертов
   * @param unreadOnly - Только непрочитанные
   * @param from - Начальная дата (опционально)
   * @param to - Конечная дата (опционально)
   * @returns Массив алертов
   */
  getAlerts(
    profileId: string,
    limit: number = 100,
    unreadOnly: boolean = false,
    from?: Date,
    to?: Date
  ): Alert[] {
    const alerts = this.alerts.get(profileId) || [];

    let filtered = alerts;

    // Фильтрация по датам
    if (from || to) {
      filtered = filtered.filter((alert) => {
        if (from && alert.timestamp < from) return false;
        if (to && alert.timestamp > to) return false;
        return true;
      });
    }

    // Фильтрация по статусу прочтения
    if (unreadOnly) {
      filtered = filtered.filter((alert) => !alert.read);
    }

    // Сортировка по времени (новые первыми)
    filtered.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    // Ограничение количества
    return filtered.slice(0, limit);
  }

  /**
   * Получение количества непрочитанных алертов
   * 
   * @param profileId - ID профиля
   * @returns Количество непрочитанных алертов
   */
  getUnreadCount(profileId: string): number {
    const alerts = this.alerts.get(profileId) || [];
    return alerts.filter((alert) => !alert.read).length;
  }

  /**
   * Отметка алерта как прочитанного
   * 
   * @param profileId - ID профиля
   * @param alertId - ID алерта
   * @returns true если алерт найден и отмечен
   */
  markAsRead(profileId: string, alertId: string): boolean {
    const alerts = this.alerts.get(profileId);
    if (!alerts) {
      return false;
    }

    const alert = alerts.find((a) => a.id === alertId);
    if (!alert) {
      return false;
    }

    alert.read = true;
    return true;
  }

  /**
   * Отметка всех алертов профиля как прочитанных
   * 
   * @param profileId - ID профиля
   * @returns Количество отмеченных алертов
   */
  markAllAsRead(profileId: string): number {
    const alerts = this.alerts.get(profileId);
    if (!alerts) {
      return 0;
    }

    let count = 0;
    for (const alert of alerts) {
      if (!alert.read) {
        alert.read = true;
        count++;
      }
    }

    return count;
  }

  /**
   * Удаление алерта
   * 
   * @param profileId - ID профиля
   * @param alertId - ID алерта
   * @returns true если алерт найден и удален
   */
  deleteAlert(profileId: string, alertId: string): boolean {
    const alerts = this.alerts.get(profileId);
    if (!alerts) {
      return false;
    }

    const index = alerts.findIndex((a) => a.id === alertId);
    if (index === -1) {
      return false;
    }

    alerts.splice(index, 1);
    return true;
  }

  /**
   * Очистка алертов профиля
   * 
   * @param profileId - ID профиля (опционально)
   */
  clearAlerts(profileId?: string): void {
    if (profileId) {
      this.alerts.delete(profileId);
    } else {
      this.alerts.clear();
    }
  }
}

