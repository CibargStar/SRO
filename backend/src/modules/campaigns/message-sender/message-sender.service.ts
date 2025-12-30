/**
 * Message Sender Service
 *
 * Обертка над конкретными отправителями (WhatsApp/Telegram).
 * Отвечает за валидацию номера, тайминги (typing/pauses),
 * выбор канала и единый контракт результата отправки.
 *
 * В дальнейшем интегрируется с Executor/Worker и Puppeteer-отправителями.
 *
 * @module modules/campaigns/message-sender/message-sender.service
 */

import { MessengerType, UniversalTarget } from '@prisma/client';
import logger from '../../../config/logger';
import { WhatsAppSender } from './whatsapp-sender';
import { TelegramSender } from './telegram-sender';
import type { ChromeProcessService } from '../../profiles/chrome-process/chrome-process.service';

export interface SendMessageInput {
  messenger: MessengerType | null;
  phone: string;
  text?: string;
  attachments?: string[]; // пути к файлам
  simulateTyping?: boolean;
  typingDelayRange?: { minMs: number; maxMs: number };
  sendDelayMs?: number;
  universalTarget?: UniversalTarget | null;
  hasWhatsApp?: boolean;
  hasTelegram?: boolean;
  profileId?: string; // ID профиля для доступа к Puppeteer
  skipSendDelay?: boolean; // Пропустить задержку перед отправкой (для второго мессенджера в режиме BOTH)
}

export interface SendMessageResult {
  success: boolean;
  messenger: MessengerType;
  error?: string;
}

export class MessageSenderService {
  private whatsappSender: WhatsAppSender;
  private telegramSender: TelegramSender;
  private chromeProcessService?: ChromeProcessService;

  constructor(chromeProcessService?: ChromeProcessService) {
    this.chromeProcessService = chromeProcessService;
    this.whatsappSender = new WhatsAppSender(chromeProcessService);
    this.telegramSender = new TelegramSender(chromeProcessService);
  }

  /**
   * Пометить профиль как занятый рассылкой
   * Предотвращает переключение вкладок мониторингом статуса
   */
  markProfileBusy(profileId: string, messenger: 'whatsapp' | 'telegram', campaignId?: string): void {
    this.chromeProcessService?.markProfileBusy(profileId, messenger, campaignId);
  }

  /**
   * Пометить профиль как свободный
   */
  markProfileFree(profileId: string): void {
    this.chromeProcessService?.markProfileFree(profileId);
  }

  /**
   * Отправка сообщения через выбранный мессенджер
   */
  async sendMessage(input: SendMessageInput): Promise<SendMessageResult> {
    const { messenger, phone, text, attachments } = input;

    try {
      this.ensurePhoneValid(phone);

      // Задержка перед отправкой (анти-спам тайминги)
      // Пропускаем задержку если skipSendDelay=true (для второго мессенджера в режиме BOTH)
      if (input.sendDelayMs && input.sendDelayMs > 0 && !input.skipSendDelay) {
        await this.delay(input.sendDelayMs);
      }

      // Симуляция набора
      if (input.simulateTyping && input.typingDelayRange) {
        await this.simulateTyping(input.typingDelayRange.minMs, input.typingDelayRange.maxMs);
      }

      // Делегируем в конкретный отправитель
      // Определяем канал: либо заданный, либо по universalTarget
      const resolvedMessenger =
        messenger ??
        this.resolveUniversalMessenger(
          input.universalTarget,
          input.hasWhatsApp ?? true,
          input.hasTelegram ?? true
        );

      if (resolvedMessenger === 'WHATSAPP') {
        return await this.whatsappSender.sendMessage({ phone, text, attachments, profileId: input.profileId });
      }

      if (resolvedMessenger === 'TELEGRAM') {
        return await this.telegramSender.sendMessage({ phone, text, attachments, profileId: input.profileId });
      }

      throw new Error(`Unsupported messenger: ${String(resolvedMessenger)}`);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to send message', { error: errorMessage, messenger, phone });
      return {
        success: false,
        messenger: (messenger as MessengerType) ?? 'WHATSAPP',
        error: errorMessage,
      };
    }
  }

  /**
   * Проверка валидности номера (простая)
   */
  ensurePhoneValid(phone: string): void {
    const normalized = phone.replace(/[^\d+]/g, '');
    const isValid = /^\+?\d{7,20}$/.test(normalized);
    if (!isValid) {
      throw new Error('Invalid phone number format');
    }
  }

  /**
   * Симуляция набора
   */
  async simulateTyping(minMs: number, maxMs: number): Promise<void> {
    const delayMs = this.getRandomDelay(minMs, maxMs);
    await this.delay(delayMs);
  }

  /**
   * Случайная задержка (используется только для симуляции набора)
   */
  private getRandomDelay(minMs: number, maxMs: number): number {
    const min = Math.max(0, minMs);
    const max = Math.max(min, maxMs);
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  /**
   * Утилита для ожидания
   */
  private async delay(ms: number): Promise<void> {
    if (ms <= 0) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  private resolveUniversalMessenger(
    universalTarget: UniversalTarget | null | undefined,
    hasWa: boolean,
    hasTg: boolean
  ): MessengerType {
    if (universalTarget === 'TELEGRAM_FIRST') {
      if (hasTg) return 'TELEGRAM';
      if (hasWa) return 'WHATSAPP';
    } else if (universalTarget === 'WHATSAPP_FIRST') {
      if (hasWa) return 'WHATSAPP';
      if (hasTg) return 'TELEGRAM';
    } else if (universalTarget === 'BOTH') {
      // Для BOTH на уровне sendMessage выберем сначала WA, затем вызывающая сторона может дернуть повторно для TG
      if (hasWa) return 'WHATSAPP';
      if (hasTg) return 'TELEGRAM';
    } else {
      // Значение по умолчанию
      if (hasWa) return 'WHATSAPP';
      if (hasTg) return 'TELEGRAM';
    }
    // Ничего недоступно — пробуем WhatsApp для единообразия
    return 'WHATSAPP';
  }
}

