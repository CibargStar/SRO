/**
 * WebSocket сервер для real-time коммуникации
 * 
 * Особенности:
 * - JWT аутентификация через query параметр или первое сообщение
 * - Система комнат (rooms) для broadcast
 * - Heartbeat (ping/pong) для поддержания соединения
 * - Graceful shutdown
 */

import { Server as HttpServer } from 'http';
import { WebSocket, WebSocketServer as WsServer, RawData } from 'ws';
import { verify, JwtPayload } from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../../config';
import { env } from '../../config/env';
import {
  WsEventType,
  WsRoomType,
  WsMessage,
  WsClientInfo,
  WsSubscribeMessage,
  WsUnsubscribeMessage,
  createRoomName,
  parseRoomName,
} from './websocket.types';

// Расширяем WebSocket для хранения информации о клиенте
interface ExtendedWebSocket extends WebSocket {
  clientInfo?: WsClientInfo;
  isAlive?: boolean;
}

/**
 * WebSocket сервер с поддержкой JWT авторизации и комнат
 */
export class WebSocketServer {
  private wss: WsServer | null = null;
  private clients: Map<string, ExtendedWebSocket> = new Map();
  private rooms: Map<string, Set<string>> = new Map(); // room -> clientIds
  private heartbeatInterval: NodeJS.Timeout | null = null;
  
  private readonly HEARTBEAT_INTERVAL = 30000; // 30 секунд
  private readonly CLIENT_TIMEOUT = 60000; // 60 секунд без pong = disconnect

  /**
   * Инициализация WebSocket сервера
   * 
   * @param server - HTTP сервер Express
   */
  initialize(server: HttpServer): void {
    this.wss = new WsServer({ 
      server,
      path: '/ws',
    });

    this.wss.on('connection', (ws: ExtendedWebSocket, request) => {
      this.handleConnection(ws, request);
    });

    this.wss.on('error', (error) => {
      logger.error('WebSocket server error', { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
    });

    // Запуск heartbeat
    this.startHeartbeat();

    logger.info('WebSocket server initialized', { path: '/ws' });
  }

  /**
   * Обработка нового подключения
   */
  private handleConnection(ws: ExtendedWebSocket, request: { url?: string }): void {
    // Попытка получить токен из query параметра
    const url = new URL(request.url || '', 'http://localhost');
    const token = url.searchParams.get('token');

    if (token) {
      // Аутентификация по токену из URL
      const authResult = this.authenticateToken(token);
      if (authResult) {
        this.initializeClient(ws, authResult.userId, authResult.role);
      } else {
        ws.close(4001, 'Invalid token');
        return;
      }
    } else {
      // Ожидаем токен в первом сообщении
      ws.once('message', (data: RawData) => {
        try {
          const message = JSON.parse(data.toString()) as { type: string; token?: string };
          if (message.type === 'auth' && message.token) {
            const authResult = this.authenticateToken(message.token);
            if (authResult) {
              this.initializeClient(ws, authResult.userId, authResult.role);
              this.sendToClient(ws, WsEventType.CONNECT, { success: true });
            } else {
              ws.close(4001, 'Invalid token');
            }
          } else {
            ws.close(4002, 'Authentication required');
          }
        } catch {
          ws.close(4003, 'Invalid message format');
        }
      });

      // Таймаут на аутентификацию
      setTimeout(() => {
        if (!ws.clientInfo) {
          ws.close(4004, 'Authentication timeout');
        }
      }, 10000);
    }
  }

  /**
   * Аутентификация JWT токена
   */
  private authenticateToken(token: string): { userId: string; role: string } | null {
    try {
      const decoded = verify(token, env.JWT_ACCESS_SECRET) as JwtPayload & {
        sub: string;
        role: string;
      };

      if (!decoded.sub) {
        return null;
      }

      return {
        userId: decoded.sub,
        role: decoded.role || 'USER',
      };
    } catch {
      return null;
    }
  }

  /**
   * Инициализация клиента после успешной аутентификации
   */
  private initializeClient(ws: ExtendedWebSocket, userId: string, role: string): void {
    const clientId = uuidv4();

    ws.clientInfo = {
      id: clientId,
      userId,
      userRole: role,
      connectedAt: new Date(),
      lastPingAt: new Date(),
      rooms: new Set(),
    };

    ws.isAlive = true;

    // Сохраняем клиента
    this.clients.set(clientId, ws);

    // Автоматическая подписка на комнату пользователя
    this.subscribeToRoom(ws, createRoomName(WsRoomType.USER, userId));

    // Если ROOT - подписываем на admin комнату
    if (role === 'ROOT') {
      this.subscribeToRoom(ws, createRoomName(WsRoomType.ADMIN, 'global'));
    }

    // Обработчики событий
    ws.on('message', (data: RawData) => this.handleMessage(ws, data));
    ws.on('close', () => this.handleDisconnect(ws));
    ws.on('error', (error) => this.handleError(ws, error));
    ws.on('pong', () => {
      ws.isAlive = true;
      if (ws.clientInfo) {
        ws.clientInfo.lastPingAt = new Date();
      }
    });

    logger.info('WebSocket client connected', {
      clientId,
      userId,
      role,
    });
  }

  /**
   * Обработка входящего сообщения
   */
  private handleMessage(ws: ExtendedWebSocket, data: RawData): void {
    if (!ws.clientInfo) return;

    try {
      const message = JSON.parse(data.toString()) as WsMessage;

      switch (message.type) {
        case WsEventType.SUBSCRIBE:
          this.handleSubscribe(ws, message.payload as WsSubscribeMessage);
          break;

        case WsEventType.UNSUBSCRIBE:
          this.handleUnsubscribe(ws, message.payload as WsUnsubscribeMessage);
          break;

        case WsEventType.PING:
          this.sendToClient(ws, WsEventType.PONG, { timestamp: new Date().toISOString() });
          break;

        default:
          // Игнорируем неизвестные типы сообщений
          logger.debug('Unknown WebSocket message type', { 
            type: message.type,
            clientId: ws.clientInfo.id,
          });
      }
    } catch (error) {
      logger.warn('Failed to parse WebSocket message', {
        clientId: ws.clientInfo.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Обработка подписки на комнату
   */
  private handleSubscribe(ws: ExtendedWebSocket, payload: WsSubscribeMessage): void {
    if (!ws.clientInfo) return;

    const { room } = payload;
    const parsed = parseRoomName(room);

    if (!parsed) {
      logger.warn('Invalid room name for subscription', { room, clientId: ws.clientInfo.id });
      return;
    }

    // Проверка прав доступа к комнате
    if (!this.canAccessRoom(ws.clientInfo, parsed.type, parsed.id)) {
      logger.warn('Access denied to room', { 
        room, 
        clientId: ws.clientInfo.id,
        userId: ws.clientInfo.userId,
      });
      this.sendToClient(ws, WsEventType.ERROR, { 
        message: 'Access denied to room',
        room,
      });
      return;
    }

    this.subscribeToRoom(ws, room);
    
    logger.debug('Client subscribed to room', { 
      room, 
      clientId: ws.clientInfo.id,
    });
  }

  /**
   * Обработка отписки от комнаты
   */
  private handleUnsubscribe(ws: ExtendedWebSocket, payload: WsUnsubscribeMessage): void {
    if (!ws.clientInfo) return;

    const { room } = payload;
    this.unsubscribeFromRoom(ws, room);

    logger.debug('Client unsubscribed from room', { 
      room, 
      clientId: ws.clientInfo.id,
    });
  }

  /**
   * Проверка прав доступа к комнате
   */
  private canAccessRoom(clientInfo: WsClientInfo, roomType: string, roomId: string): boolean {
    // ROOT имеет доступ ко всем комнатам
    if (clientInfo.userRole === 'ROOT') {
      return true;
    }

    // Пользователь имеет доступ только к своим ресурсам
    switch (roomType) {
      case WsRoomType.USER:
        return roomId === clientInfo.userId;

      case WsRoomType.PROFILE:
      case WsRoomType.CAMPAIGN:
        // Для профилей и кампаний проверка выполняется на уровне API
        // Здесь просто разрешаем (API должен уже проверить владение)
        return true;

      case WsRoomType.ADMIN:
        return clientInfo.userRole === 'ROOT';

      default:
        return false;
    }
  }

  /**
   * Подписка клиента на комнату
   */
  private subscribeToRoom(ws: ExtendedWebSocket, room: string): void {
    if (!ws.clientInfo) return;

    // Добавляем комнату клиенту
    ws.clientInfo.rooms.add(room);

    // Добавляем клиента в комнату
    if (!this.rooms.has(room)) {
      this.rooms.set(room, new Set());
    }
    this.rooms.get(room)!.add(ws.clientInfo.id);
  }

  /**
   * Отписка клиента от комнаты
   */
  private unsubscribeFromRoom(ws: ExtendedWebSocket, room: string): void {
    if (!ws.clientInfo) return;

    // Удаляем комнату у клиента
    ws.clientInfo.rooms.delete(room);

    // Удаляем клиента из комнаты
    const roomClients = this.rooms.get(room);
    if (roomClients) {
      roomClients.delete(ws.clientInfo.id);
      // Удаляем пустую комнату
      if (roomClients.size === 0) {
        this.rooms.delete(room);
      }
    }
  }

  /**
   * Обработка отключения клиента
   */
  private handleDisconnect(ws: ExtendedWebSocket): void {
    if (!ws.clientInfo) return;

    const clientId = ws.clientInfo.id;
    const userId = ws.clientInfo.userId;

    // Отписываем от всех комнат
    for (const room of ws.clientInfo.rooms) {
      this.unsubscribeFromRoom(ws, room);
    }

    // Удаляем клиента
    this.clients.delete(clientId);

    logger.info('WebSocket client disconnected', { clientId, userId });
  }

  /**
   * Обработка ошибки клиента
   */
  private handleError(ws: ExtendedWebSocket, error: Error): void {
    logger.error('WebSocket client error', {
      clientId: ws.clientInfo?.id,
      error: error.message,
    });
  }

  /**
   * Отправка сообщения конкретному клиенту
   */
  private sendToClient<T>(ws: ExtendedWebSocket, type: WsEventType | string, payload: T): void {
    if (ws.readyState !== WebSocket.OPEN) return;

    const message: WsMessage<T> = {
      type,
      payload,
      timestamp: new Date().toISOString(),
    };

    ws.send(JSON.stringify(message));
  }

  /**
   * Broadcast сообщения в комнату
   * 
   * @param room - Имя комнаты
   * @param type - Тип события
   * @param payload - Данные
   */
  broadcast<T>(room: string, type: WsEventType | string, payload: T): void {
    const roomClients = this.rooms.get(room);
    if (!roomClients || roomClients.size === 0) return;

    const message: WsMessage<T> = {
      type,
      payload,
      timestamp: new Date().toISOString(),
      room,
    };

    const messageStr = JSON.stringify(message);

    for (const clientId of roomClients) {
      const ws = this.clients.get(clientId);
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(messageStr);
      }
    }

    logger.debug('Broadcast message sent', { 
      room, 
      type, 
      recipients: roomClients.size,
    });
  }

  /**
   * Отправка сообщения конкретному пользователю
   * 
   * @param userId - ID пользователя
   * @param type - Тип события
   * @param payload - Данные
   */
  sendToUser<T>(userId: string, type: WsEventType | string, payload: T): void {
    const room = createRoomName(WsRoomType.USER, userId);
    this.broadcast(room, type, payload);
  }

  /**
   * Отправка сообщения всем ROOT пользователям
   * 
   * @param type - Тип события
   * @param payload - Данные
   */
  sendToAdmins<T>(type: WsEventType | string, payload: T): void {
    const room = createRoomName(WsRoomType.ADMIN, 'global');
    this.broadcast(room, type, payload);
  }

  /**
   * Отправка события профиля
   * 
   * @param profileId - ID профиля
   * @param userId - ID владельца профиля
   * @param type - Тип события
   * @param payload - Данные
   */
  emitProfileEvent<T>(profileId: string, userId: string, type: WsEventType, payload: T): void {
    // Отправляем владельцу профиля
    this.sendToUser(userId, type, payload);
    
    // Отправляем в комнату профиля (для тех, кто подписан напрямую)
    this.broadcast(createRoomName(WsRoomType.PROFILE, profileId), type, payload);
    
    // Отправляем админам
    this.sendToAdmins(type, payload);
  }

  /**
   * Отправка события кампании
   * 
   * @param campaignId - ID кампании
   * @param userId - ID владельца кампании
   * @param type - Тип события
   * @param payload - Данные
   */
  emitCampaignEvent<T>(campaignId: string, userId: string, type: WsEventType, payload: T): void {
    // Отправляем владельцу
    this.sendToUser(userId, type, payload);
    
    // Отправляем в комнату кампании
    this.broadcast(createRoomName(WsRoomType.CAMPAIGN, campaignId), type, payload);
    
    // Отправляем админам
    this.sendToAdmins(type, payload);
  }

  /**
   * Запуск heartbeat для проверки живости соединений
   */
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      const now = Date.now();

      for (const [clientId, ws] of this.clients) {
        if (!ws.isAlive) {
          // Клиент не ответил на предыдущий ping - отключаем
          logger.info('Terminating inactive WebSocket client', { clientId });
          ws.terminate();
          this.clients.delete(clientId);
          continue;
        }

        // Проверяем время последнего pong
        if (ws.clientInfo) {
          const lastPing = ws.clientInfo.lastPingAt.getTime();
          if (now - lastPing > this.CLIENT_TIMEOUT) {
            logger.info('WebSocket client timeout', { clientId });
            ws.terminate();
            this.clients.delete(clientId);
            continue;
          }
        }

        // Отправляем ping
        ws.isAlive = false;
        ws.ping();
      }
    }, this.HEARTBEAT_INTERVAL);
  }

  /**
   * Остановка heartbeat
   */
  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Получение статистики подключений
   */
  getStats(): { totalClients: number; totalRooms: number; roomStats: Record<string, number> } {
    const roomStats: Record<string, number> = {};
    for (const [room, clients] of this.rooms) {
      roomStats[room] = clients.size;
    }

    return {
      totalClients: this.clients.size,
      totalRooms: this.rooms.size,
      roomStats,
    };
  }

  /**
   * Graceful shutdown
   */
  close(): void {
    this.stopHeartbeat();

    // Закрываем все соединения
    for (const ws of this.clients.values()) {
      ws.close(1001, 'Server shutting down');
    }

    this.clients.clear();
    this.rooms.clear();

    if (this.wss) {
      this.wss.close();
      this.wss = null;
    }

    logger.info('WebSocket server closed');
  }
}

