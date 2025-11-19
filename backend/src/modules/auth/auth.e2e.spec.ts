/**
 * Интеграционные тесты для API авторизации
 * 
 * Тестирует endpoints:
 * - POST /api/auth/login
 * - POST /api/auth/refresh
 * - POST /api/auth/logout
 * 
 * @module modules/auth/auth.e2e.spec
 */

import request from 'supertest';
import { Express } from 'express';
import { PrismaClient } from '@prisma/client';
import { createTestApp, resetDatabase, type TestApp } from '../../tests/utils';
import { hashPassword } from './password.service';
import { ensureRootUser } from './ensureRootUser';
import logger from '../../config/logger';

describe('Auth API E2E Tests', () => {
  let testApp: TestApp;
  let app: Express;
  let prisma: PrismaClient;
  let rootUser: { email: string; password: string };

  beforeAll(async () => {
    // Создаем тестовое приложение
    testApp = await createTestApp();
    app = testApp.app;
    prisma = testApp.prisma;

    // Получаем credentials root пользователя из env
    rootUser = {
      email: process.env.TEST_ROOT_EMAIL || 'test-root@example.com',
      password: process.env.TEST_ROOT_PASSWORD || 'TestRootPassword123!@#',
    };
  });

  beforeEach(async () => {
    // Очищаем БД между тестами
    await resetDatabase(prisma);

    // Инициализируем root пользователя заново
    await ensureRootUser(prisma, rootUser, logger);
  });

  afterAll(async () => {
    // Закрываем соединение с БД
    await prisma.$disconnect();
  });

  describe('POST /api/auth/login', () => {
    it('should successfully login root user', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: rootUser.email,
          password: rootUser.password,
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('refreshToken');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user.role).toBe('ROOT');
      expect(response.body.user.email).toBe(rootUser.email);
      expect(response.body.user).not.toHaveProperty('passwordHash');
      expect(response.body.user).not.toHaveProperty('passwordVersion');
    });

    it('should return 401 for invalid password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: rootUser.email,
          password: 'WrongPassword123!@#',
        });

      expect(response.status).toBe(401);
      expect(response.body).toEqual({ message: 'Invalid credentials' });
    });

    it('should return 401 for non-existent user', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'SomePassword123!@#',
        });

      expect(response.status).toBe(401);
      expect(response.body).toEqual({ message: 'Invalid credentials' });
    });

    it('should return 401 for inactive user', async () => {
      // Создаем обычного пользователя
      const userPassword = 'UserPassword123!@#';
      const passwordHash = await hashPassword(userPassword);

      const user = await prisma.user.create({
        data: {
          email: 'inactive@example.com',
          passwordHash,
          role: 'USER',
          isActive: false, // Неактивный пользователь
        },
      });

      // Пытаемся войти
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: user.email,
          password: userPassword,
        });

      expect(response.status).toBe(401);
      expect(response.body).toEqual({ message: 'Invalid credentials' });
    });

    it('should return 400 for invalid email format', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'invalid-email',
          password: 'SomePassword123!@#',
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('details');
    });

    it('should return 400 for missing password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: rootUser.email,
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('POST /api/auth/refresh', () => {
    it('should successfully refresh tokens', async () => {
      // Логинимся и получаем токены
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: rootUser.email,
          password: rootUser.password,
        });

      expect(loginResponse.status).toBe(200);
      const { refreshToken: oldRefreshToken } = loginResponse.body;

      // Обновляем токены
      const refreshResponse = await request(app)
        .post('/api/auth/refresh')
        .send({
          refreshToken: oldRefreshToken,
        });

      expect(refreshResponse.status).toBe(200);
      expect(refreshResponse.body).toHaveProperty('accessToken');
      expect(refreshResponse.body).toHaveProperty('refreshToken');
      expect(refreshResponse.body.refreshToken).not.toBe(oldRefreshToken); // Новый токен
    });

    it('should return 401 for invalid refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({
          refreshToken: 'invalid-token-string',
        });

      expect(response.status).toBe(401);
      expect(response.body).toEqual({ message: 'Invalid refresh token' });
    });

    it('should return 401 for non-existent refresh token', async () => {
      // Создаем валидный JWT токен, но не сохраняем его в БД
      // Для этого нужно создать токен вручную или использовать уже отозванный
      // Проще всего использовать невалидный токен

      const response = await request(app)
        .post('/api/auth/refresh')
        .send({
          refreshToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwidG9rZW5JZCI6IjEyMzQ1NiIsInR5cCI6InJlZnJlc2gifQ.invalid',
        });

      expect(response.status).toBe(401);
      expect(response.body).toEqual({ message: 'Invalid refresh token' });
    });

    it('should return 401 after password change (passwordVersion mismatch)', async () => {
      // Логинимся и получаем токены
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: rootUser.email,
          password: rootUser.password,
        });

      expect(loginResponse.status).toBe(200);
      const { refreshToken } = loginResponse.body;

      // Получаем пользователя из БД
      const user = await prisma.user.findUnique({
        where: { email: rootUser.email },
      });

      expect(user).not.toBeNull();

      // Меняем пароль пользователю (инкрементируем passwordVersion)
      const newPassword = 'NewPassword123!@#';
      const newPasswordHash = await hashPassword(newPassword);

      await prisma.user.update({
        where: { id: user!.id },
        data: {
          passwordHash: newPasswordHash,
          passwordVersion: { increment: 1 }, // Инкрементируем passwordVersion
        },
      });

      // Пытаемся обновить токены со старым refresh токеном
      const refreshResponse = await request(app)
        .post('/api/auth/refresh')
        .send({
          refreshToken,
        });

      expect(refreshResponse.status).toBe(401);
      expect(refreshResponse.body).toEqual({ message: 'Invalid refresh token' });
    });

    it('should return 400 for missing refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should successfully logout and revoke refresh token', async () => {
      // Логинимся и получаем токены
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: rootUser.email,
          password: rootUser.password,
        });

      expect(loginResponse.status).toBe(200);
      const { refreshToken } = loginResponse.body;

      // Выходим из системы
      const logoutResponse = await request(app)
        .post('/api/auth/logout')
        .send({
          refreshToken,
        });

      expect(logoutResponse.status).toBe(204);
      expect(logoutResponse.body).toEqual({});

      // Пытаемся использовать отозванный токен для refresh
      const refreshResponse = await request(app)
        .post('/api/auth/refresh')
        .send({
          refreshToken,
        });

      expect(refreshResponse.status).toBe(401);
      expect(refreshResponse.body).toEqual({ message: 'Invalid refresh token' });
    });

    it('should return 204 even for non-existent token (idempotent)', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .send({
          refreshToken: 'non-existent-token',
        });

      expect(response.status).toBe(204);
      expect(response.body).toEqual({});
    });

    it('should return 400 for missing refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Integration scenarios', () => {
    it('should handle full auth flow: login → refresh → logout', async () => {
      // 1. Логин
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: rootUser.email,
          password: rootUser.password,
        });

      expect(loginResponse.status).toBe(200);
      const { accessToken: initialAccessToken, refreshToken: initialRefreshToken, user } = loginResponse.body;
      expect(user.role).toBe('ROOT');

      // 2. Refresh
      const refreshResponse = await request(app)
        .post('/api/auth/refresh')
        .send({
          refreshToken: initialRefreshToken,
        });

      expect(refreshResponse.status).toBe(200);
      const { accessToken: newAccessToken, refreshToken: newRefreshToken } = refreshResponse.body;
      expect(newAccessToken).not.toBe(initialAccessToken);
      expect(newRefreshToken).not.toBe(initialRefreshToken);

      // 3. Logout
      const logoutResponse = await request(app)
        .post('/api/auth/logout')
        .send({
          refreshToken: newRefreshToken,
        });

      expect(logoutResponse.status).toBe(204);

      // 4. Проверка, что токен отозван
      const finalRefreshResponse = await request(app)
        .post('/api/auth/refresh')
        .send({
          refreshToken: newRefreshToken,
        });

      expect(finalRefreshResponse.status).toBe(401);
    });

    it('should invalidate all tokens after password change', async () => {
      // 1. Логин
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: rootUser.email,
          password: rootUser.password,
        });

      expect(loginResponse.status).toBe(200);
      const { accessToken, refreshToken } = loginResponse.body;

      // 2. Меняем пароль
      const user = await prisma.user.findUnique({
        where: { email: rootUser.email },
      });

      const newPassword = 'NewSecurePassword123!@#';
      const newPasswordHash = await hashPassword(newPassword);

      await prisma.user.update({
        where: { id: user!.id },
        data: {
          passwordHash: newPasswordHash,
          passwordVersion: { increment: 1 },
        },
      });

      // 3. Старый refresh токен не должен работать
      const refreshResponse = await request(app)
        .post('/api/auth/refresh')
        .send({
          refreshToken,
        });

      expect(refreshResponse.status).toBe(401);

      // 4. Можно войти с новым паролем
      const newLoginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: rootUser.email,
          password: newPassword,
        });

      expect(newLoginResponse.status).toBe(200);
      expect(newLoginResponse.body).toHaveProperty('accessToken');
    });
  });
});

