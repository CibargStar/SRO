/**
 * Telegram Bot Controller
 *
 * Обработчики запросов для управления Telegram ботами пользователей.
 *
 * @module modules/telegram-bot/telegram-bot.controller
 */

import { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import logger from '../../config/logger';
import { UserBotManagerService } from './user-bot-manager.service';
import { z } from 'zod';
import { AuthenticatedRequest } from '../../middleware/auth';

// Схемы валидации
const setupBotSchema = z.object({
  botToken: z.string().min(1, 'Bot token is required'),
});

const verifyCodeSchema = z.object({
  code: z.string().length(6, 'Code must be 6 characters'),
});

const updateNotificationsSchema = z.object({
  notifyOnStart: z.boolean().optional(),
  notifyOnComplete: z.boolean().optional(),
  notifyOnError: z.boolean().optional(),
  notifyOnProgress50: z.boolean().optional(),
  notifyOnProgress75: z.boolean().optional(),
  notifyOnProgress90: z.boolean().optional(),
  notifyOnProfileIssue: z.boolean().optional(),
  notifyOnLoginRequired: z.boolean().optional(),
});

export class TelegramBotController {
  constructor(
    private prisma: PrismaClient,
    private botManager: UserBotManagerService
  ) {}

  /**
   * GET /api/telegram-bot
   * Получить настройки бота пользователя
   */
  async getSettings(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;

      const settings = await this.prisma.userTelegramBot.findUnique({
        where: { userId },
        select: {
          id: true,
          botToken: false, // Не возвращаем токен в ответе
          chatId: true,
          isVerified: true,
          notifyOnStart: true,
          notifyOnComplete: true,
          notifyOnError: true,
          notifyOnProgress50: true,
          notifyOnProgress75: true,
          notifyOnProgress90: true,
          notifyOnProfileIssue: true,
          notifyOnLoginRequired: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      if (!settings) {
        res.status(404).json({ error: 'Telegram bot not configured' });
        return;
      }

      res.json(settings);
    } catch (error) {
      logger.error('Failed to get Telegram bot settings', {
        userId: req.user!.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      res.status(500).json({ error: 'Failed to get Telegram bot settings' });
    }
  }

  /**
   * POST /api/telegram-bot/setup
   * Настроить бота (сохранить токен и сгенерировать код верификации)
   */
  async setupBot(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const { botToken } = setupBotSchema.parse(req.body);

      // Создаем или обновляем запись бота
      await this.prisma.userTelegramBot.upsert({
        where: { userId },
        update: {
          botToken,
          isVerified: false,
          chatId: null,
          verifyCode: null,
          verifyCodeExpiresAt: null,
        },
        create: {
          userId,
          botToken,
          isVerified: false,
        },
      });

      // Регистрируем бота (запускаем polling)
      await this.botManager.registerBot(userId, botToken);

      // Генерируем код верификации
      const verifyCode = await this.botManager.generateVerifyCode(userId);

      res.json({
        message: 'Bot configured successfully',
        verifyCode,
        expiresIn: 600, // 10 минут в секундах
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Invalid input', details: error.errors });
        return;
      }

      logger.error('Failed to setup Telegram bot', {
        userId: req.user!.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      res.status(500).json({ error: 'Failed to setup Telegram bot' });
    }
  }

  /**
   * POST /api/telegram-bot/verify
   * Подтвердить код верификации
   */
  async verifyCode(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const { code } = verifyCodeSchema.parse(req.body);

      const botData = await this.prisma.userTelegramBot.findUnique({
        where: { userId },
      });

      if (!botData) {
        res.status(404).json({ error: 'Telegram bot not configured' });
        return;
      }

      if (!botData.verifyCode || botData.verifyCode !== code) {
        res.status(400).json({ error: 'Invalid verification code' });
        return;
      }

      if (!botData.verifyCodeExpiresAt || botData.verifyCodeExpiresAt < new Date()) {
        res.status(400).json({ error: 'Verification code expired' });
        return;
      }

      // Код валиден, но chatId должен быть установлен через команду /verify в боте
      // Здесь мы просто проверяем, что код правильный
      // Фактическая верификация происходит в UserBotManager при получении команды /verify

      res.json({
        message: 'Verification code is valid. Please send /verify <code> to your bot.',
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Invalid input', details: error.errors });
        return;
      }

      logger.error('Failed to verify Telegram bot code', {
        userId: req.user!.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      res.status(500).json({ error: 'Failed to verify code' });
    }
  }

  /**
   * DELETE /api/telegram-bot
   * Отключить бота
   */
  async disconnectBot(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;

      await this.botManager.unregisterBot(userId);

      await this.prisma.userTelegramBot.delete({
        where: { userId },
      }).catch(() => {
        // Игнорируем ошибку, если записи нет
      });

      res.json({ message: 'Bot disconnected successfully' });
    } catch (error) {
      logger.error('Failed to disconnect Telegram bot', {
        userId: req.user!.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      res.status(500).json({ error: 'Failed to disconnect bot' });
    }
  }

  /**
   * PATCH /api/telegram-bot/notifications
   * Обновить настройки уведомлений
   */
  async updateNotifications(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const updates = updateNotificationsSchema.parse(req.body);

      const botData = await this.prisma.userTelegramBot.findUnique({
        where: { userId },
      });

      if (!botData) {
        res.status(404).json({ error: 'Telegram bot not configured' });
        return;
      }

      await this.prisma.userTelegramBot.update({
        where: { userId },
        data: updates,
      });

      res.json({ message: 'Notification settings updated' });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Invalid input', details: error.errors });
        return;
      }

      logger.error('Failed to update notification settings', {
        userId: req.user!.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      res.status(500).json({ error: 'Failed to update notification settings' });
    }
  }

  /**
   * POST /api/telegram-bot/test
   * Отправить тестовое уведомление
   */
  async testNotification(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;

      const botData = await this.prisma.userTelegramBot.findUnique({
        where: { userId },
      });

      if (!botData || !botData.isVerified) {
        res.status(400).json({ error: 'Telegram bot not verified' });
        return;
      }

      const success = await this.botManager.sendNotification(
        userId,
        '🧪 <b>Тестовое уведомление</b>\n\nЭто тестовое сообщение для проверки работы Telegram бота.'
      );

      if (success) {
        res.json({ message: 'Test notification sent successfully' });
      } else {
        res.status(500).json({ error: 'Failed to send test notification' });
      }
    } catch (error) {
      logger.error('Failed to send test notification', {
        userId: req.user!.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      res.status(500).json({ error: 'Failed to send test notification' });
    }
  }
}

