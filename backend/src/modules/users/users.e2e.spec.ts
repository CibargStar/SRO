/**
 * Интеграционные тесты для API управления пользователями
 * 
 * Тестирует endpoints:
 * - GET /api/users - список пользователей (только ROOT)
 * - POST /api/users - создание пользователя (только ROOT)
 * - PATCH /api/users/:id - обновление пользователя (только ROOT)
 * - GET /api/users/me - данные текущего пользователя (любой авторизованный)
 * 
 * @module modules/users/users.e2e.spec
 */

import request from 'supertest';
import { Express } from 'express';
import { PrismaClient } from '@prisma/client';
import { createTestApp, resetDatabase, type TestApp } from '../../tests/utils';
import { hashPassword } from '../auth/password.service';
import { ensureRootUser } from '../auth/ensureRootUser';
import logger from '../../config/logger';

describe('Users API E2E Tests', () => {
  let testApp: TestApp;
  let app: Express;
  let prisma: PrismaClient;
  let rootUser: { ROOT_EMAIL: string; ROOT_PASSWORD: string };
  let rootAccessToken: string;
  let userAccessToken: string;
  let createdUserId: string;

  beforeAll(async () => {
    // Создаем тестовое приложение
    testApp = await createTestApp();
    app = testApp.app;
    prisma = testApp.prisma;

    // Получаем credentials root пользователя из env
    rootUser = {
      ROOT_EMAIL: process.env.TEST_ROOT_EMAIL || 'test-root@example.com',
      ROOT_PASSWORD: process.env.TEST_ROOT_PASSWORD || 'TestRootPassword123!@#',
    };
  });

  beforeEach(async () => {
    // Очищаем БД между тестами
    await resetDatabase(prisma);

    // Инициализируем root пользователя заново
    await ensureRootUser(prisma, rootUser, logger);

    // Логинимся как ROOT и получаем токен
    const rootLoginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: rootUser.ROOT_EMAIL,
        password: rootUser.ROOT_PASSWORD,
      });

    expect(rootLoginResponse.status).toBe(200);
    rootAccessToken = rootLoginResponse.body.accessToken;

    // Создаем обычного пользователя для тестов
    const userPassword = 'UserPassword123!@#';
    const passwordHash = await hashPassword(userPassword);

    const user = await prisma.user.create({
      data: {
        email: 'testuser@example.com',
        passwordHash,
        role: 'USER',
        isActive: true,
        name: 'Test User',
      },
    });

    createdUserId = user.id;

    // Логинимся как USER и получаем токен
    const userLoginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: user.email,
        password: userPassword,
      });

    expect(userLoginResponse.status).toBe(200);
    userAccessToken = userLoginResponse.body.accessToken;
  });

  afterAll(async () => {
    // Закрываем соединение с БД
    if (prisma) {
      await prisma.$disconnect();
    }
  });

  describe('Authorization and roles', () => {
    it('should return 401 for GET /api/users without token', async () => {
      const response = await request(app).get('/api/users');

      expect(response.status).toBe(401);
      expect(response.body).toEqual({ message: 'Unauthorized' });
    });

    it('should return 403 for GET /api/users with USER token', async () => {
      const response = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${userAccessToken}`);

      expect(response.status).toBe(403);
      expect(response.body).toEqual({ message: 'Forbidden' });
    });

    it('should return 200 for GET /api/users with ROOT token', async () => {
      const response = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${rootAccessToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      
      // Проверяем, что в ответе нет чувствительных полей
      response.body.forEach((user: any) => {
        expect(user).not.toHaveProperty('passwordHash');
        expect(user).not.toHaveProperty('passwordVersion');
        expect(user).toHaveProperty('id');
        expect(user).toHaveProperty('email');
        expect(user).toHaveProperty('role');
      });
    });
  });

  describe('POST /api/users', () => {
    it('should successfully create USER through ROOT', async () => {
      const newUser = {
        email: 'newuser@example.com',
        password: 'NewUserPassword123!@#',
        name: 'New User',
      };

      const response = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${rootAccessToken}`)
        .send(newUser);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body.email).toBe(newUser.email);
      expect(response.body.role).toBe('USER'); // Всегда USER, не ROOT
      expect(response.body.name).toBe(newUser.name);
      expect(response.body.isActive).toBe(true);
      expect(response.body).not.toHaveProperty('passwordHash');
      expect(response.body).not.toHaveProperty('passwordVersion');
    });

    it('should return 409 for duplicate email', async () => {
      const newUser = {
        email: 'duplicate@example.com',
        password: 'Password123!@#',
      };

      // Создаем первого пользователя
      const firstResponse = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${rootAccessToken}`)
        .send(newUser);

      expect(firstResponse.status).toBe(201);

      // Пытаемся создать второго с тем же email
      const secondResponse = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${rootAccessToken}`)
        .send(newUser);

      expect(secondResponse.status).toBe(409);
      expect(secondResponse.body).toEqual({ message: 'Email already in use' });
    });

    it('should return 401 for POST /api/users without token', async () => {
      const response = await request(app)
        .post('/api/users')
        .send({
          email: 'test@example.com',
          password: 'Password123!@#',
        });

      expect(response.status).toBe(401);
      expect(response.body).toEqual({ message: 'Unauthorized' });
    });

    it('should return 403 for POST /api/users with USER token', async () => {
      const response = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .send({
          email: 'test@example.com',
          password: 'Password123!@#',
        });

      expect(response.status).toBe(403);
      expect(response.body).toEqual({ message: 'Forbidden' });
    });

    it('should return 400 for invalid input data', async () => {
      const response = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${rootAccessToken}`)
        .send({
          email: 'invalid-email', // Невалидный email
          password: 'short', // Слишком короткий пароль
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('details');
    });
  });

  describe('PATCH /api/users/:id', () => {
    it('should successfully update USER (email, name, isActive)', async () => {
      const updateData = {
        email: 'updated@example.com',
        name: 'Updated Name',
        isActive: false,
      };

      const response = await request(app)
        .patch(`/api/users/${createdUserId}`)
        .set('Authorization', `Bearer ${rootAccessToken}`)
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.body.email).toBe(updateData.email);
      expect(response.body.name).toBe(updateData.name);
      expect(response.body.isActive).toBe(updateData.isActive);
      expect(response.body).not.toHaveProperty('passwordHash');
      expect(response.body).not.toHaveProperty('passwordVersion');
    });

    it('should successfully update USER password and invalidate tokens', async () => {
      // Сохраняем старый refresh токен
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'testuser@example.com',
          password: 'UserPassword123!@#',
        });

      expect(loginResponse.status).toBe(200);
      const oldRefreshToken = loginResponse.body.refreshToken;

      // Меняем пароль через PATCH
      const newPassword = 'NewUserPassword123!@#';
      const updateResponse = await request(app)
        .patch(`/api/users/${createdUserId}`)
        .set('Authorization', `Bearer ${rootAccessToken}`)
        .send({
          password: newPassword,
        });

      expect(updateResponse.status).toBe(200);

      // Старый refresh токен не должен работать (passwordVersion изменился)
      const refreshResponse = await request(app)
        .post('/api/auth/refresh')
        .send({
          refreshToken: oldRefreshToken,
        });

      expect(refreshResponse.status).toBe(401);
      expect(refreshResponse.body).toEqual({ message: 'Invalid refresh token' });

      // Новый пароль должен работать
      const newLoginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'testuser@example.com',
          password: newPassword,
        });

      expect(newLoginResponse.status).toBe(200);
      expect(newLoginResponse.body).toHaveProperty('accessToken');
    });

    it('should return 403 for updating ROOT user', async () => {
      // Получаем ROOT пользователя
      const rootUserRecord = await prisma.user.findUnique({
        where: { email: rootUser.ROOT_EMAIL },
      });

      expect(rootUserRecord).not.toBeNull();
      expect(rootUserRecord?.role).toBe('ROOT');

      const response = await request(app)
        .patch(`/api/users/${rootUserRecord!.id}`)
        .set('Authorization', `Bearer ${rootAccessToken}`)
        .send({
          email: 'newemail@example.com',
        });

      expect(response.status).toBe(403);
      expect(response.body).toEqual({ message: 'Operation not allowed for ROOT user' });
    });

    it('should return 404 for non-existent user', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000';

      const response = await request(app)
        .patch(`/api/users/${nonExistentId}`)
        .set('Authorization', `Bearer ${rootAccessToken}`)
        .send({
          name: 'Updated Name',
        });

      expect(response.status).toBe(404);
      expect(response.body).toEqual({ message: 'User not found' });
    });

    it('should return 409 for duplicate email when updating', async () => {
      // Создаем второго пользователя
      const secondUserPassword = 'SecondUser123!@#';
      const secondUserPasswordHash = await hashPassword(secondUserPassword);

      const secondUser = await prisma.user.create({
        data: {
          email: 'seconduser@example.com',
          passwordHash: secondUserPasswordHash,
          role: 'USER',
        },
      });

      // Пытаемся обновить первого пользователя с email второго
      const response = await request(app)
        .patch(`/api/users/${createdUserId}`)
        .set('Authorization', `Bearer ${rootAccessToken}`)
        .send({
          email: secondUser.email,
        });

      expect(response.status).toBe(409);
      expect(response.body).toEqual({ message: 'Email already in use' });
    });

    it('should return 401 for PATCH /api/users/:id without token', async () => {
      const response = await request(app)
        .patch(`/api/users/${createdUserId}`)
        .send({
          name: 'Updated Name',
        });

      expect(response.status).toBe(401);
      expect(response.body).toEqual({ message: 'Unauthorized' });
    });

    it('should return 403 for PATCH /api/users/:id with USER token', async () => {
      const response = await request(app)
        .patch(`/api/users/${createdUserId}`)
        .set('Authorization', `Bearer ${userAccessToken}`)
        .send({
          name: 'Updated Name',
        });

      expect(response.status).toBe(403);
      expect(response.body).toEqual({ message: 'Forbidden' });
    });

    it('should return 400 for invalid update data', async () => {
      const response = await request(app)
        .patch(`/api/users/${createdUserId}`)
        .set('Authorization', `Bearer ${rootAccessToken}`)
        .send({
          email: 'invalid-email', // Невалидный email
          password: 'short', // Слишком короткий пароль
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should return 400 for empty update data', async () => {
      const response = await request(app)
        .patch(`/api/users/${createdUserId}`)
        .set('Authorization', `Bearer ${rootAccessToken}`)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /api/users/me', () => {
    it('should return ROOT user data for ROOT token', async () => {
      const response = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${rootAccessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.email).toBe(rootUser.ROOT_EMAIL);
      expect(response.body.role).toBe('ROOT');
      expect(response.body).not.toHaveProperty('passwordHash');
      expect(response.body).not.toHaveProperty('passwordVersion');
    });

    it('should return USER data for USER token', async () => {
      const response = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${userAccessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.email).toBe('testuser@example.com');
      expect(response.body.role).toBe('USER');
      expect(response.body.name).toBe('Test User');
      expect(response.body).not.toHaveProperty('passwordHash');
      expect(response.body).not.toHaveProperty('passwordVersion');
    });

    it('should return 401 for GET /api/users/me without token', async () => {
      const response = await request(app).get('/api/users/me');

      expect(response.status).toBe(401);
      expect(response.body).toEqual({ message: 'Unauthorized' });
    });

    it('should return updated data after user update', async () => {
      // Обновляем пользователя
      const updateResponse = await request(app)
        .patch(`/api/users/${createdUserId}`)
        .set('Authorization', `Bearer ${rootAccessToken}`)
        .send({
          name: 'Updated Name',
        });

      expect(updateResponse.status).toBe(200);

      // Проверяем, что /me возвращает обновленные данные
      const meResponse = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${userAccessToken}`);

      expect(meResponse.status).toBe(200);
      expect(meResponse.body.name).toBe('Updated Name');
    });
  });

  describe('Integration scenarios', () => {
    it('should handle full user management flow: create → update → deactivate', async () => {
      // 1. Создаем пользователя
      const createResponse = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${rootAccessToken}`)
        .send({
          email: 'flowuser@example.com',
          password: 'FlowPassword123!@#',
          name: 'Flow User',
        });

      expect(createResponse.status).toBe(201);
      const userId = createResponse.body.id;

      // 2. Обновляем пользователя
      const updateResponse = await request(app)
        .patch(`/api/users/${userId}`)
        .set('Authorization', `Bearer ${rootAccessToken}`)
        .send({
          name: 'Updated Flow User',
          isActive: false,
        });

      expect(updateResponse.status).toBe(200);
      expect(updateResponse.body.name).toBe('Updated Flow User');
      expect(updateResponse.body.isActive).toBe(false);

      // 3. Пытаемся войти с деактивированным пользователем
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'flowuser@example.com',
          password: 'FlowPassword123!@#',
        });

      expect(loginResponse.status).toBe(401);
      expect(loginResponse.body).toEqual({ message: 'Invalid credentials' });
    });

    it('should prevent USER from accessing protected endpoints', async () => {
      // USER не может получить список пользователей
      const listResponse = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${userAccessToken}`);

      expect(listResponse.status).toBe(403);

      // USER не может создавать пользователей
      const createResponse = await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .send({
          email: 'newuser@example.com',
          password: 'Password123!@#',
        });

      expect(createResponse.status).toBe(403);

      // USER не может обновлять пользователей
      const updateResponse = await request(app)
        .patch(`/api/users/${createdUserId}`)
        .set('Authorization', `Bearer ${userAccessToken}`)
        .send({
          name: 'Updated Name',
        });

      expect(updateResponse.status).toBe(403);
    });
  });
});

