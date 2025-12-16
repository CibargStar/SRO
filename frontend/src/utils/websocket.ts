/**
 * WebSocket client с авто‑переподключением и подписками.
 *
 * Поддерживает:
 * - Подключение с JWT (?token=)
 * - Автоподнятие при обрыве (exponential backoff)
 * - subscribe/unsubscribe каналов (campaign:{id}, user:{id}, admin)
 * - Локальный EventEmitter по incoming event
 */

import { API_URL } from '@/config';

type WsEvents = {
  open: void;
  close: void;
  error: string;
  message: unknown;
  [event: string]: any;
};

const WS_PATH = '/ws';

function buildWsUrl(token: string): string {
  const url = new URL(API_URL);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  url.pathname = WS_PATH;
  url.searchParams.set('token', token);
  return url.toString();
}

type Handler<T = any> = (event: T) => void;

class SimpleEmitter<Events extends Record<string, any>> {
  private handlers = new Map<keyof Events, Set<Handler>>();

  on<EventName extends keyof Events>(event: EventName, handler: Handler<Events[EventName]>) {
    const set = this.handlers.get(event) ?? new Set();
    set.add(handler as Handler);
    this.handlers.set(event, set);
  }

  off<EventName extends keyof Events>(event: EventName, handler: Handler<Events[EventName]>) {
    const set = this.handlers.get(event);
    if (set) {
      set.delete(handler as Handler);
      if (set.size === 0) {
        this.handlers.delete(event);
      }
    }
  }

  emit<EventName extends keyof Events>(event: EventName, payload: Events[EventName]) {
    const set = this.handlers.get(event);
    if (set) {
      set.forEach((handler) => handler(payload));
    }
  }
}

class WebSocketService {
  private socket: WebSocket | null = null;
  private token: string | null = null;
  private reconnectAttempts = 0;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private emitter = new SimpleEmitter<WsEvents>();
  private subscribedChannels = new Set<string>();
  private manualClose = false;

  connect(token: string) {
    if (!token) return;
    this.token = token;
    this.manualClose = false;
    this.initSocket();
  }

  disconnect() {
    this.manualClose = true;
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }

  subscribe(event: string, handler: (data: any) => void) {
    this.emitter.on(event as any, handler as any);
  }

  unsubscribe(event: string, handler: (data: any) => void) {
    this.emitter.off(event as any, handler as any);
  }

  joinChannel(channel: string) {
    this.subscribedChannels.add(channel);
    this.send({ action: 'subscribe', channel });
  }

  leaveChannel(channel: string) {
    this.subscribedChannels.delete(channel);
    this.send({ action: 'unsubscribe', channel });
  }

  get status(): 'connected' | 'disconnected' {
    return this.socket && this.socket.readyState === WebSocket.OPEN
      ? 'connected'
      : 'disconnected';
  }

  private initSocket() {
    if (!this.token) return;
    const url = buildWsUrl(this.token);
    this.socket = new WebSocket(url);

    this.socket.addEventListener('open', () => {
      this.reconnectAttempts = 0;
      this.emitter.emit('open', undefined);
      // Восстанавливаем подписки
      this.subscribedChannels.forEach((ch) => {
        this.send({ action: 'subscribe', channel: ch });
      });
    });

    this.socket.addEventListener('message', (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data?.event) {
          this.emitter.emit(data.event, data.data);
        }
        this.emitter.emit('message', data);
      } catch (e) {
        this.emitter.emit('error', 'Invalid message format');
      }
    });

    this.socket.addEventListener('close', () => {
      this.emitter.emit('close', undefined);
      if (!this.manualClose) {
        this.scheduleReconnect();
      }
    });

    this.socket.addEventListener('error', () => {
      this.emitter.emit('error', 'WebSocket error');
      this.socket?.close();
    });
  }

  private scheduleReconnect() {
    if (this.reconnectTimeout) return;
    const delay = Math.min(30000, 1000 * 2 ** this.reconnectAttempts);
    this.reconnectAttempts += 1;
    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = null;
      if (this.token) {
        this.initSocket();
      }
    }, delay);
  }

  private send(payload: unknown) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(payload));
    }
  }
}

export const wsService = new WebSocketService();


