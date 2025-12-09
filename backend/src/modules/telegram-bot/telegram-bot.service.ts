/**
 * Telegram Bot Service
 *
 * Реализация уведомлений и верификации через Telegram Bot.
 * Использует node-telegram-bot-api (long polling).
 */

import TelegramBot from 'node-telegram-bot-api';
import logger from '../../config/logger';
import prisma from '../../config/database';
import { env } from '../../config/env';
import { randomBytes } from 'crypto';

export interface VerifyCodePayload {
  userId: string;
  code: string;
  expiresAt: Date;
}

export class TelegramBotService {
  // any из-за отсутствия полного type def
  private bot: any = null;
  private verifyCodes: Map<string, VerifyCodePayload> = new Map();

  async init(): Promise<void> {
    try {
      const token = env.TELEGRAM_BOT_TOKEN;
      if (!token) {
        logger.warn('Telegram bot token not set, skipping init');
        return;
      }

      this.bot = new TelegramBot(token, { polling: true });

      this.bot.onText(/\/start/, async (msg: any) => {
        const chatId = msg.chat.id;
        await this.bot?.sendMessage(chatId, 'Привет! Отправьте /verify <код> чтобы подтвердить связку.');
      });

      this.bot.onText(/\/verify (.+)/, async (msg: any, match: any) => {
        const chatId = msg.chat.id;
        const code = (match && match[1]?.trim()) || '';
        const payload = this.verifyCodes.get(code);
        if (!payload) {
          await this.bot?.sendMessage(chatId, 'Код не найден или истёк.');
          return;
        }
        if (payload.expiresAt < new Date()) {
          this.verifyCodes.delete(code);
          await this.bot?.sendMessage(chatId, 'Код истёк, запросите новый.');
          return;
        }

        // Сохраняем связь
        await prisma.userTelegramBot.upsert({
          where: { userId: payload.userId },
          update: { chatId: String(chatId) },
          create: {
            userId: payload.userId,
            botToken: env.TELEGRAM_BOT_TOKEN!,
            chatId: String(chatId),
          },
        });

        this.verifyCodes.delete(code);
        await this.bot?.sendMessage(chatId, 'Связка подтверждена, уведомления включены.');
      });

      logger.info('Telegram bot initialized (polling)');
    } catch (error) {
      logger.error('Failed to init Telegram bot', {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async stop(): Promise<void> {
    if (this.bot) {
      await this.bot.stopPolling();
      this.bot = null;
    }
  }

  /**
   * Генерирует код верификации и возвращает его
   */
  async generateVerifyCode(userId: string): Promise<string> {
    const code = randomBytes(3).toString('hex'); // 6 символов
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 минут
    this.verifyCodes.set(code, { userId, code, expiresAt });
    return code;
  }

  /**
   * Отправляет уведомление пользователю (если включено)
   */
  async sendNotification(userId: string, message: string): Promise<void> {
    if (!this.bot) return;
    const settings = await prisma.userTelegramBot.findUnique({ where: { userId } });
    if (!settings || !settings.chatId) return;
    await this.bot.sendMessage(settings.chatId, message, { parse_mode: 'HTML' });
  }

  /**
   * Форматированные уведомления по событиям кампаний/профилей
   */
  async notifyCampaignStarted(userId: string, campaignName: string): Promise<void> {
    await this.sendNotification(userId, `🚀 Кампания <b>${campaignName}</b> запущена`);
  }

  async notifyCampaignCompleted(userId: string, campaignName: string): Promise<void> {
    await this.sendNotification(userId, `✅ Кампания <b>${campaignName}</b> завершена`);
  }

  async notifyCampaignError(userId: string, campaignName: string, error: string): Promise<void> {
    await this.sendNotification(userId, `❌ Ошибка кампании <b>${campaignName}</b>: ${error}`);
  }
}

