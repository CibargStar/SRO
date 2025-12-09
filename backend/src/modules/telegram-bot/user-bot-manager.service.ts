/**
 * User Bot Manager Service
 *
 * Управляет ботами Telegram для каждого пользователя.
 * Каждый пользователь может иметь свой бот с уникальным токеном.
 *
 * @module modules/telegram-bot/user-bot-manager.service
 */

import TelegramBot from 'node-telegram-bot-api';
import { PrismaClient } from '@prisma/client';
import logger from '../../config/logger';
import { randomBytes } from 'crypto';

interface BotInstance {
  bot: any;
  userId: string;
  chatId: string | null;
}

export class UserBotManagerService {
  private bots: Map<string, BotInstance> = new Map(); // userId -> BotInstance

  constructor(private prisma: PrismaClient) {}

  /**
   * Запуск всех ботов из БД при старте сервера
   */
  async startAllBots(): Promise<void> {
    try {
      const bots = await this.prisma.userTelegramBot.findMany({
        where: {
          isVerified: true,
          botToken: { not: '' },
        },
      });

      logger.info('Starting user Telegram bots', { count: bots.length });

      for (const botData of bots) {
        if (botData.botToken) {
          await this.registerBot(botData.userId, botData.botToken, botData.chatId || undefined);
        }
      }

      logger.info('All user Telegram bots started');
    } catch (error) {
      logger.error('Failed to start user Telegram bots', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Остановка всех ботов
   */
  async stopAllBots(): Promise<void> {
    logger.info('Stopping all user Telegram bots', { count: this.bots.size });

    for (const [userId, instance] of this.bots.entries()) {
      try {
        await instance.bot.stopPolling();
        this.bots.delete(userId);
        logger.debug('Stopped bot for user', { userId });
      } catch (error) {
        logger.error('Error stopping bot', {
          userId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    logger.info('All user Telegram bots stopped');
  }

  /**
   * Регистрация бота для пользователя
   */
  async registerBot(userId: string, botToken: string, chatId?: string): Promise<void> {
    try {
      // Останавливаем существующий бот, если есть
      await this.unregisterBot(userId);

      const bot = new TelegramBot(botToken, { polling: true });

      // Обработчик команды /start
      bot.onText(/\/start/, async (msg: any) => {
        const currentChatId = msg.chat.id.toString();
        await bot.sendMessage(
          currentChatId,
          'Привет! Отправьте /verify <код> чтобы подтвердить связку.'
        );
      });

      // Обработчик команды /verify
      bot.onText(/\/verify (.+)/, async (msg: any, match: any) => {
        const currentChatId = msg.chat.id.toString();
        const code = (match && match[1]?.trim()) || '';

        // Проверяем код в БД
        const botData = await this.prisma.userTelegramBot.findUnique({
          where: { userId },
        });

        if (
          !botData ||
          !botData.verifyCode ||
          botData.verifyCode !== code ||
          !botData.verifyCodeExpiresAt ||
          botData.verifyCodeExpiresAt < new Date()
        ) {
          await bot.sendMessage(currentChatId, 'Код не найден или истёк.');
          return;
        }

        // Сохраняем chatId и помечаем как verified
        await this.prisma.userTelegramBot.update({
          where: { userId },
          data: {
            chatId: currentChatId,
            isVerified: true,
            verifyCode: null,
            verifyCodeExpiresAt: null,
          },
        });

        // Обновляем instance
        const instance = this.bots.get(userId);
        if (instance) {
          instance.chatId = currentChatId;
        }

        await bot.sendMessage(currentChatId, 'Связка подтверждена, уведомления включены.');
      });

      // Обработка ошибок бота
      bot.on('polling_error', (error: any) => {
        logger.error('Telegram bot polling error', {
          userId,
          error: error.message,
        });
      });

      this.bots.set(userId, {
        bot,
        userId,
        chatId: chatId || null,
      });

      logger.info('Bot registered for user', { userId });
    } catch (error) {
      logger.error('Failed to register bot', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Отмена регистрации бота
   */
  async unregisterBot(userId: string): Promise<void> {
    const instance = this.bots.get(userId);
    if (instance) {
      try {
        await instance.bot.stopPolling();
        this.bots.delete(userId);
        logger.info('Bot unregistered for user', { userId });
      } catch (error) {
        logger.error('Error unregistering bot', {
          userId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  }

  /**
   * Получить бот для пользователя
   */
  getBotForUser(userId: string): BotInstance | null {
    return this.bots.get(userId) || null;
  }

  /**
   * Генерация кода верификации
   */
  async generateVerifyCode(userId: string): Promise<string> {
    const code = randomBytes(3).toString('hex').toUpperCase().slice(0, 6); // 6 символов
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 минут

    await this.prisma.userTelegramBot.update({
      where: { userId },
      data: {
        verifyCode: code,
        verifyCodeExpiresAt: expiresAt,
      },
    });

    return code;
  }

  /**
   * Отправка уведомления пользователю
   */
  async sendNotification(userId: string, message: string): Promise<boolean> {
    const instance = this.bots.get(userId);
    if (!instance || !instance.chatId) {
      return false;
    }

    try {
      // Проверяем настройки уведомлений в БД
      const botData = await this.prisma.userTelegramBot.findUnique({
        where: { userId },
      });

      if (!botData || !botData.isVerified || !botData.chatId) {
        return false;
      }

      // Используем chatId из БД (может отличаться от instance)
      const chatId = botData.chatId;

      await instance.bot.sendMessage(chatId, message, { parse_mode: 'HTML' });
      return true;
    } catch (error) {
      logger.error('Failed to send Telegram notification', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }
}

