/**
 * Telegram Sender
 *
 * Минимальная реализация отправителя Telegram.
 * TODO: заменить на полноценную интеграцию (Telegram Web/Bot API).
 */

import { SenderInput, SenderResult } from './whatsapp-sender';
import logger from '../../../config/logger';
import { validatePhone } from './utils';

export class TelegramSender {
  async sendMessage(input: SenderInput): Promise<SenderResult> {
    try {
      validatePhone(input.phone);
      // TODO: интеграция с Telegram Web/Bot. Пока считаем не реализованным.
      throw new Error('Telegram sender not implemented');
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Unknown Telegram error';
      logger.error('Telegram send failed', { phone: input.phone, error: msg });
      return { success: false, messenger: 'TELEGRAM', error: msg };
    }
  }

  /**
   * Открытие чата по номеру
   */
  async openChat(_phone: string): Promise<void> {
    // TODO: реализовать переход в чат (Telegram Web)
  }

  /**
   * Отправка текстового сообщения
   */
  async sendTextMessage(_phone: string, _text: string): Promise<SenderResult> {
    // TODO: реализовать отправку текста
    await Promise.resolve();
    return { success: true, messenger: 'TELEGRAM' };
  }

  /**
   * Отправка файла/вложений
   */
  async sendFileMessage(_phone: string, _attachmentPath: string): Promise<SenderResult> {
    // TODO: реализовать отправку файла
    await Promise.resolve();
    return { success: true, messenger: 'TELEGRAM' };
  }

  /**
   * Проверка, зарегистрирован ли номер в Telegram
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
    return 'Unknown Telegram error';
  }
}

