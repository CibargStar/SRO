/**
 * WhatsApp Sender
 *
 * Минимальная реализация отправителя WhatsApp.
 * TODO: заменить на полноценную интеграцию с WhatsApp Web (Puppeteer).
 */

import { MessengerType } from '@prisma/client';
import logger from '../../../config/logger';
import { validatePhone } from './utils';

export interface SenderInput {
  phone: string;
  text?: string;
  attachments?: string[];
}

export interface SenderResult {
  success: boolean;
  messenger: MessengerType;
  error?: string;
}

export class WhatsAppSender {
  /**
   * Основной метод отправки (обертка для Executor)
   */
  async sendMessage(_input: SenderInput): Promise<SenderResult> {
    try {
      validatePhone(_input.phone);
      // TODO: интеграция с WA Web. Пока считаем как "не реализовано".
      throw new Error('WhatsApp sender not implemented');
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Unknown WhatsApp error';
      logger.error('WhatsApp send failed', { phone: _input.phone, error: msg });
      return { success: false, messenger: 'WHATSAPP', error: msg };
    }
  }

  /**
   * Открытие чата по номеру
   */
  async openChat(_phone: string): Promise<void> {
    // TODO: реализовать переход в чат (WA Web)
  }

  /**
   * Отправка текстового сообщения
   */
  async sendTextMessage(_phone: string, _text: string): Promise<SenderResult> {
    // TODO: реализовать ввод текста и отправку
    await Promise.resolve();
    return { success: true, messenger: 'WHATSAPP' };
  }

  /**
   * Отправка файла/вложений
   */
  async sendFileMessage(_phone: string, _attachmentPath: string): Promise<SenderResult> {
    // TODO: реализовать загрузку и отправку файла
    await Promise.resolve();
    return { success: true, messenger: 'WHATSAPP' };
  }

  /**
   * Проверка, зарегистрирован ли номер в WhatsApp
   */
  async checkNumberRegistered(_phone: string): Promise<boolean> {
    // TODO: реализовать проверку регистрации номера
    await Promise.resolve();
    return true;
  }

  /**
   * Обработка ошибок и нормализация сообщений
   */
  handleErrors(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    return 'Unknown WhatsApp error';
  }
}

