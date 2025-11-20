/**
 * Swagger/OpenAPI конфигурация
 * 
 * Определяет документацию API для Swagger UI.
 * Используется swagger-jsdoc для генерации OpenAPI спецификации из JSDoc комментариев.
 * 
 * @module config/swagger
 */

import swaggerJsdoc from 'swagger-jsdoc';
import { env } from './env';

/**
 * Опции для swagger-jsdoc
 */
const swaggerOptions: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'BM Tools Backend API',
      version: '1.0.0',
      description: `
        API для системы управления с авторизацией без саморегистрации.
        
        ## Особенности:
        - JWT токены (Access + Refresh)
        - Две роли: ROOT (администратор) и USER (обычный пользователь)
        - Только ROOT может создавать и управлять пользователями
        - Защита от brute force (rate limiting)
        - Хеширование паролей через argon2id
        
        ## Авторизация:
        Используйте Bearer токен в заголовке Authorization для доступа к защищенным эндпоинтам.
        Получите токен через POST /api/auth/login.
        
        **Frontend интеграция:**
        - Frontend отправляет accessToken в заголовке \`Authorization: Bearer <token>\`
        - Refresh токен хранится в localStorage (с пониманием рисков XSS)
        - Автоматический refresh токенов при 401 ошибке с защитой от race conditions
        - Проверка истечения access token перед запросами (деконодирование JWT)
        - Валидация формата JWT токенов перед отправкой на сервер
        - Frontend не показывает технические детали ошибок пользователю
        - Frontend блокирует попытки редактирования ROOT пользователей
        
        Подробнее о frontend архитектуре см. README.md и ARCHITECTURE.md.
      `,
      contact: {
        name: 'API Support',
      },
      license: {
        name: 'ISC',
      },
    },
    servers: [
      {
        url: `http://localhost:${env.PORT}`,
        description: 'Development server',
      },
      {
        url: 'https://api.example.com',
        description: 'Production server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT Access Token. Получите токен через POST /api/auth/login',
        },
      },
      schemas: {
        // Error schemas
        Error: {
          type: 'object',
          properties: {
            message: {
              type: 'string',
              description: 'Сообщение об ошибке',
              example: 'Invalid credentials',
            },
          },
          required: ['message'],
        },
        ValidationError: {
          type: 'object',
          properties: {
            errors: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  field: {
                    type: 'string',
                    description: 'Поле с ошибкой',
                    example: 'email',
                  },
                  message: {
                    type: 'string',
                    description: 'Сообщение об ошибке',
                    example: 'Invalid email format',
                  },
                },
                required: ['field', 'message'],
              },
            },
          },
          required: ['errors'],
        },
        
        // Auth schemas
        LoginInput: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: {
              type: 'string',
              format: 'email',
              description: 'Email пользователя',
              example: 'user@example.com',
            },
            password: {
              type: 'string',
              format: 'password',
              minLength: 8,
              description: 'Пароль пользователя (минимум 8 символов)',
              example: 'password123',
            },
          },
        },
        RefreshInput: {
          type: 'object',
          required: ['refreshToken'],
          properties: {
            refreshToken: {
              type: 'string',
              description: 'Refresh токен для обновления access токена',
              example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
            },
          },
        },
        LoginResponse: {
          type: 'object',
          properties: {
            accessToken: {
              type: 'string',
              description: 'JWT Access токен (время жизни: 15 минут)',
              example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
            },
            refreshToken: {
              type: 'string',
              description: 'JWT Refresh токен (время жизни: 7 дней)',
              example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
            },
            expiresIn: {
              type: 'number',
              description: 'Время жизни access token в секундах',
              example: 900,
            },
            refreshExpiresIn: {
              type: 'number',
              description: 'Время жизни refresh token в секундах',
              example: 604800,
            },
            user: {
              $ref: '#/components/schemas/User',
            },
          },
          required: ['accessToken', 'refreshToken', 'expiresIn', 'refreshExpiresIn', 'user'],
        },
        RefreshResponse: {
          type: 'object',
          properties: {
            accessToken: {
              type: 'string',
              description: 'Новый JWT Access токен',
              example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
            },
            refreshToken: {
              type: 'string',
              description: 'Новый JWT Refresh токен (старый токен инвалидирован)',
              example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
            },
            expiresIn: {
              type: 'number',
              description: 'Время жизни access token в секундах',
              example: 900,
            },
            refreshExpiresIn: {
              type: 'number',
              description: 'Время жизни refresh token в секундах',
              example: 604800,
            },
          },
          required: ['accessToken', 'refreshToken', 'expiresIn', 'refreshExpiresIn'],
        },
        
        // User schemas
        User: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              format: 'uuid',
              description: 'UUID пользователя',
              example: '123e4567-e89b-12d3-a456-426614174000',
            },
            email: {
              type: 'string',
              format: 'email',
              description: 'Email пользователя',
              example: 'user@example.com',
            },
            role: {
              type: 'string',
              enum: ['ROOT', 'USER'],
              description: 'Роль пользователя',
              example: 'USER',
            },
            name: {
              type: 'string',
              nullable: true,
              description: 'Имя пользователя',
              example: 'John Doe',
            },
            isActive: {
              type: 'boolean',
              description: 'Активен ли пользователь',
              example: true,
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Дата создания',
              example: '2024-01-01T00:00:00.000Z',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
              description: 'Дата последнего обновления',
              example: '2024-01-01T00:00:00.000Z',
            },
          },
          required: ['id', 'email', 'role', 'isActive', 'createdAt', 'updatedAt'],
        },
        CreateUserInput: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: {
              type: 'string',
              format: 'email',
              description: 'Email пользователя (должен быть уникальным)',
              example: 'newuser@example.com',
            },
            password: {
              type: 'string',
              format: 'password',
              minLength: 12,
              description: 'Пароль пользователя (минимум 12 символов, должен содержать заглавные/строчные буквы, цифры, спецсимволы)',
              example: 'SecurePassword123!',
            },
            name: {
              type: 'string',
              maxLength: 100,
              description: 'Имя пользователя (опционально)',
              example: 'John Doe',
            },
          },
        },
        UpdateUserInput: {
          type: 'object',
          description: 'Все поля опциональны. Можно обновлять только нужные поля.',
          properties: {
            email: {
              type: 'string',
              format: 'email',
              description: 'Email пользователя (должен быть уникальным)',
              example: 'updated@example.com',
            },
            password: {
              type: 'string',
              format: 'password',
              minLength: 12,
              description: 'Новый пароль (минимум 12 символов, должен содержать заглавные/строчные буквы, цифры, спецсимволы). При смене пароля все токены пользователя инвалидируются.',
              example: 'NewSecurePassword123!',
            },
            name: {
              type: 'string',
              maxLength: 100,
              description: 'Имя пользователя',
              example: 'Updated Name',
            },
            isActive: {
              type: 'boolean',
              description: 'Активен ли пользователь',
              example: true,
            },
          },
        },
        UsersListResponse: {
          type: 'object',
          properties: {
            users: {
              type: 'array',
              items: {
                $ref: '#/components/schemas/User',
              },
            },
          },
          required: ['users'],
        },
      },
    },
    tags: [
      {
        name: 'Auth',
        description: 'Эндпоинты авторизации (вход, выход, обновление токенов)',
      },
      {
        name: 'Users',
        description: 'Эндпоинты управления пользователями (только для ROOT)',
      },
    ],
  },
  apis: [
    './src/routes/*.ts', // Путь к файлам с роутами
    './src/modules/**/*.controller.ts', // Путь к контроллерам
  ],
};

/**
 * Сгенерированная OpenAPI спецификация
 */
export const swaggerSpec = swaggerJsdoc(swaggerOptions);

