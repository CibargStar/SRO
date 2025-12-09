/**
 * Telegram Bot Routes
 *
 * Маршруты для управления Telegram ботами пользователей.
 *
 * @module modules/telegram-bot/telegram-bot.routes
 */

import { Router } from 'express';
import { authMiddleware } from '../../middleware';
import { AuthenticatedRequest } from '../../middleware/auth';
import { TelegramBotController } from './telegram-bot.controller';
import { UserBotManagerService } from './user-bot-manager.service';
import { prisma } from '../../config';

const router = Router();

// Получаем UserBotManager из app (будет установлен в bootstrap)
const getBotManager = (req: AuthenticatedRequest): UserBotManagerService => {
  return req.app.get('userBotManager') as UserBotManagerService;
};

// Все маршруты требуют аутентификации
router.use(authMiddleware);

// Получить настройки бота
router.get('/', (req: AuthenticatedRequest, res) => {
  const botManager = getBotManager(req);
  const ctrl = new TelegramBotController(prisma, botManager);
  void ctrl.getSettings(req, res);
});

// Настроить бота
router.post('/setup', (req: AuthenticatedRequest, res) => {
  const botManager = getBotManager(req);
  const ctrl = new TelegramBotController(prisma, botManager);
  void ctrl.setupBot(req, res);
});

// Подтвердить код верификации
router.post('/verify', (req: AuthenticatedRequest, res) => {
  const botManager = getBotManager(req);
  const ctrl = new TelegramBotController(prisma, botManager);
  void ctrl.verifyCode(req, res);
});

// Отключить бота
router.delete('/', (req: AuthenticatedRequest, res) => {
  const botManager = getBotManager(req);
  const ctrl = new TelegramBotController(prisma, botManager);
  void ctrl.disconnectBot(req, res);
});

// Обновить настройки уведомлений
router.patch('/notifications', (req: AuthenticatedRequest, res) => {
  const botManager = getBotManager(req);
  const ctrl = new TelegramBotController(prisma, botManager);
  void ctrl.updateNotifications(req, res);
});

// Отправить тестовое уведомление
router.post('/test', (req: AuthenticatedRequest, res) => {
  const botManager = getBotManager(req);
  const ctrl = new TelegramBotController(prisma, botManager);
  void ctrl.testNotification(req, res);
});

export default router;

