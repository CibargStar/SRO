/**
 * Сервис уведомлений и алертов
 * 
 * Высокоуровневый сервис для управления уведомлениями и алертами профилей.
 * 
 * @module modules/profiles/notifications/notification.service
 */

import { AlertManager, Alert, AlertSeverity } from './alert.manager';
import { WebSocketServer } from '../../websocket/websocket.server';
import { WsEventType } from '../../websocket';
import { NotificationDispatcherService } from '../../telegram-bot';

/**
 * Сервис уведомлений
 */
export class NotificationService {
  private alertManager: AlertManager;
  private wsServer?: WebSocketServer;
  private dispatcher?: NotificationDispatcherService;

  constructor() {
    this.alertManager = new AlertManager();
  }

  setWebSocketServer(wsServer: WebSocketServer) {
    this.wsServer = wsServer;
  }

  setNotificationDispatcher(dispatcher: NotificationDispatcherService) {
    this.dispatcher = dispatcher;
  }

  private emitAlert(alert: Alert) {
    if (!this.wsServer) return;
    this.wsServer.emitProfileEvent(alert.profileId, alert.userId, WsEventType.PROFILE_ALERT, {
      ...alert,
      timestamp: alert.timestamp.toISOString(),
    });

    // Telegram/WS комбинированные уведомления через диспетчер
    if (this.dispatcher) {
      const type = alert.type;
      if (type === 'MESSENGER_LOGIN_REQUIRED') {
        const messenger = ((alert.metadata?.serviceName as string) || 'messenger').toLowerCase() === 'whatsapp'
          ? 'whatsapp'
          : 'telegram';
        const profileName = (alert.metadata?.profileName as string) || alert.profileId;
        void this.dispatcher.notifyLoginRequired(alert.userId, alert.profileId, profileName, messenger);
      } else {
        // Остальные алерты профилей — как issue
        const profileName = (alert.metadata?.profileName as string) || alert.profileId;
        void this.dispatcher.notifyProfileIssue(alert.userId, alert.profileId, profileName, alert.message);
      }
    }
  }

  /**
   * Создание алерта о превышении лимитов ресурсов
   * 
   * @param profileId - ID профиля
   * @param userId - ID пользователя
   * @param details - Детали превышения лимитов
   */
  notifyResourceLimitExceeded(
    profileId: string,
    userId: string,
    details: { cpu?: boolean; memory?: boolean; network?: boolean }
  ): Alert {
    const exceededResources: string[] = [];
    if (details.cpu) exceededResources.push('CPU');
    if (details.memory) exceededResources.push('Память');
    if (details.network) exceededResources.push('Сеть');

    const severity: AlertSeverity = exceededResources.length > 1 ? 'error' : 'warning';

    const alert = this.alertManager.createAlert(
      profileId,
      userId,
      'RESOURCE_LIMIT_EXCEEDED',
      severity,
      'Превышение лимитов ресурсов',
      `Превышены лимиты ресурсов: ${exceededResources.join(', ')}. Профиль будет остановлен.`,
      { exceededResources, details }
    );
    this.emitAlert(alert);
    return alert;
  }

  /**
   * Создание алерта о сбое профиля
   * 
   * @param profileId - ID профиля
   * @param userId - ID пользователя
   * @param error - Ошибка
   */
  notifyProfileCrashed(profileId: string, userId: string, error: string): Alert {
    const alert = this.alertManager.createAlert(
      profileId,
      userId,
      'PROFILE_CRASHED',
      'error',
      'Сбой профиля',
      `Профиль завершил работу с ошибкой: ${error}`,
      { error }
    );
    this.emitAlert(alert);
    return alert;
  }

  /**
   * Создание алерта о перезапуске профиля
   * 
   * @param profileId - ID профиля
   * @param userId - ID пользователя
   * @param attempts - Количество попыток перезапуска
   */
  notifyProfileRestarted(profileId: string, userId: string, attempts: number): Alert {
    const alert = this.alertManager.createAlert(
      profileId,
      userId,
      'PROFILE_RESTARTED',
      'info',
      'Перезапуск профиля',
      `Профиль был автоматически перезапущен (попытка ${attempts})`,
      { attempts }
    );
    this.emitAlert(alert);
    return alert;
  }

  /**
   * Создание алерта о необходимости входа в мессенджер
   * 
   * @param profileId - ID профиля
   * @param userId - ID пользователя
   * @param accountId - ID аккаунта мессенджера
   * @param serviceName - Имя мессенджера (whatsapp, telegram)
   * @param serviceDisplayName - Отображаемое имя мессенджера
   * @param qrCode - QR код в формате base64 (если требуется)
   * @param cloudPasswordRequired - Требуется ли облачный пароль (для Telegram)
   * @returns Созданный алерт
   */
  notifyMessengerLoginRequired(
    profileId: string,
    userId: string,
    accountId: string,
    serviceName: string,
    serviceDisplayName: string,
    qrCode?: string,
    cloudPasswordRequired?: boolean
  ): Alert {
    const message = cloudPasswordRequired
      ? `Требуется вход в ${serviceDisplayName}. Отсканируйте QR код и введите облачный пароль.`
      : `Требуется вход в ${serviceDisplayName}. Отсканируйте QR код для входа.`;

    const alert = this.alertManager.createAlert(
      profileId,
      userId,
      'MESSENGER_LOGIN_REQUIRED',
      'warning',
      `Требуется вход в ${serviceDisplayName}`,
      message,
      {
        accountId,
        serviceName,
        serviceDisplayName,
        qrCode,
        cloudPasswordRequired: cloudPasswordRequired ?? false,
      }
    );
    this.emitAlert(alert);
    return alert;
  }

  /**
   * Создание алерта о деградации здоровья профиля
   * 
   * @param profileId - ID профиля
   * @param userId - ID пользователя
   * @param status - Статус здоровья
   */
  notifyProfileHealthDegraded(profileId: string, userId: string, status: string): Alert {
    const alert = this.alertManager.createAlert(
      profileId,
      userId,
      'PROFILE_HEALTH_DEGRADED',
      'warning',
      'Ухудшение здоровья профиля',
      `Здоровье профиля ухудшилось: ${status}`,
      { status }
    );
    this.emitAlert(alert);
    return alert;
  }

  /**
   * Создание алерта об ошибке профиля
   * 
   * @param profileId - ID профиля
   * @param userId - ID пользователя
   * @param error - Ошибка
   */
  notifyProfileError(profileId: string, userId: string, error: string): Alert {
    const alert = this.alertManager.createAlert(
      profileId,
      userId,
      'PROFILE_ERROR',
      'error',
      'Ошибка профиля',
      `Произошла ошибка: ${error}`,
      { error }
    );
    this.emitAlert(alert);
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
    return this.alertManager.getAlerts(profileId, limit, unreadOnly, from, to);
  }

  /**
   * Получение количества непрочитанных алертов
   * 
   * @param profileId - ID профиля
   * @returns Количество непрочитанных алертов
   */
  getUnreadCount(profileId: string): number {
    return this.alertManager.getUnreadCount(profileId);
  }

  /**
   * Отметка алерта как прочитанного
   * 
   * @param profileId - ID профиля
   * @param alertId - ID алерта
   * @returns true если алерт найден и отмечен
   */
  markAlertAsRead(profileId: string, alertId: string): boolean {
    return this.alertManager.markAsRead(profileId, alertId);
  }

  /**
   * Отметка всех алертов профиля как прочитанных
   * 
   * @param profileId - ID профиля
   * @returns Количество отмеченных алертов
   */
  markAllAlertsAsRead(profileId: string): number {
    return this.alertManager.markAllAsRead(profileId);
  }

  /**
   * Удаление алерта
   * 
   * @param profileId - ID профиля
   * @param alertId - ID алерта
   * @returns true если алерт найден и удален
   */
  deleteAlert(profileId: string, alertId: string): boolean {
    return this.alertManager.deleteAlert(profileId, alertId);
  }
}

