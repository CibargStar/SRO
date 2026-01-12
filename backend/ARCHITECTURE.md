# Архитектура модуля авторизации

## Обзор

Документ описывает архитектуру модуля авторизации для backend приложения на Node.js 20, TypeScript 5.9, Express 5, Prisma 6.

**Ключевые требования:**
- Нет саморегистрации (только root создает пользователей)
- Две роли: ROOT (администратор) и USER (обычный пользователь)
- Root-пользователь создается из env переменных при первом запуске
- Обычный пользователь не может изменять свои данные или создавать других пользователей
- Все операции с пользователями выполняет только root

---

## 1. Структура модулей и папок

### 1.1. Общая структура

```
backend/src/
├── modules/                    # Бизнес-модули приложения
│   ├── auth/                   # Модуль авторизации
│   │   ├── auth.controller.ts  # HTTP обработчики (login, refresh, logout)
│   │   ├── auth.schemas.ts      # Zod схемы валидации (login, refresh)
│   │   ├── password.service.ts  # Хеширование паролей (argon2id)
│   │   ├── token.service.ts     # Генерация/валидация JWT токенов
│   │   ├── ensureRootUser.ts    # Инициализация root пользователя
│   │   ├── auth.e2e.spec.ts     # Интеграционные тесты
│   │   ├── schemas/             # Публичный API схем
│   │   │   └── index.ts
│   │   └── index.ts            # Публичный API модуля
│   │
│   └── users/                  # Модуль управления пользователями
│       ├── users.controller.ts # HTTP обработчики (CRUD для ROOT)
│       ├── user.schemas.ts      # Zod схемы валидации (create, update)
│       ├── users.e2e.spec.ts    # Интеграционные тесты
│       ├── schemas/             # Публичный API схем
│       │   └── index.ts
│       └── index.ts            # Публичный API модуля
│
├── middleware/                # Глобальные middleware
│   ├── auth.ts                 # Auth middleware (authMiddleware, requireAuth, requireRoot)
│   ├── security.ts             # Helmet, CORS, rate limiting
│   ├── zodValidate.ts           # Валидация тела запроса через Zod
│   ├── errorHandler.ts          # Глобальный обработчик ошибок
│   ├── logger.ts                # Логирование запросов
│   ├── notFound.ts              # Обработчик 404
│   └── index.ts                 # Экспорт всех middleware
│
├── routes/                     # Express маршруты
│   ├── auth.routes.ts           # Маршруты авторизации (/api/auth/*)
│   ├── users.routes.ts          # Маршруты управления пользователями (/api/users/*)
│   └── index.ts                 # Главный роутер
│
├── config/                     # Конфигурация
│   ├── env.ts                   # Валидация переменных окружения (Zod)
│   ├── database.ts              # Prisma Client
│   ├── logger.ts                # Winston logger
│   └── index.ts                 # Экспорт конфигурации
│
├── tests/                      # Тестовая инфраструктура
│   ├── setup.ts                 # Глобальная настройка тестов
│   ├── utils/                   # Тестовые утилиты
│   │   ├── testApp.ts           # Создание тестового Express приложения
│   │   ├── testDb.ts            # Утилиты для работы с тестовой БД
│   │   └── index.ts
│   └── README.md                # Документация тестов
│
└── index.ts                     # Точка входа приложения
```

### 1.2. Принципы организации

**Модульность:**
- Каждый модуль (auth, users) самодостаточен
- Модуль экспортирует только публичный API через `index.ts`
- Внутренняя структура модуля скрыта от других модулей

**Разделение ответственности:**
- **Controllers** - обработка HTTP запросов/ответов, валидация входных данных
- **Services** - бизнес-логика, работа с БД через Prisma
- **Routes** - определение маршрутов Express (в `src/routes/`)
- **Schemas** - Zod схемы для валидации (внутри модулей)
- **Middleware** - проверка авторизации и прав доступа (в `src/middleware/`)

**Структура модуля:**
- Файлы контроллеров, сервисов и схем на верхнем уровне модуля
- Публичный API через `index.ts`
- Тесты рядом с кодом (`.e2e.spec.ts`)

---

## 2. Сущности и роли

### 2.1. Prisma Schema

```prisma
// Роли пользователей
enum UserRole {
  ROOT  // Администратор системы (создается из env)
  USER  // Обычный пользователь (создается root'ом)
}

// Пользователь
model User {
  id        String    @id @default(uuid())
  email     String    @unique
  passwordHash   String    // Хешированный пароль (argon2id)
  role      UserRole  @default(USER)
  name      String?   // Опциональное имя
  isActive  Boolean   @default(true)  // Может быть деактивирован root'ом
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
  
  // Связь с refresh токенами
  refreshTokens RefreshToken[]
  
  @@index([email])
  @@index([role])
}

// Refresh токен (для отзыва токенов)
model RefreshToken {
  id        String   @id @default(uuid())
  token     String   @unique  // JWT refresh token
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  expiresAt DateTime
  createdAt DateTime @default(now())
  
  @@index([userId])
  @@index([expiresAt])  // Для очистки истекших токенов
  @@index([token])      // Для быстрого поиска токена
  @@map("refresh_tokens")
}
```

### 2.2. Enum ролей

**Файл: `prisma/schema.prisma`**

```prisma
enum UserRole {
  ROOT  // Администратор системы
  USER  // Обычный пользователь
}
```

**Использование:**
- В Prisma schema (enum)
- В TypeScript типах (генерируется Prisma Client)
- В middleware для проверки прав доступа (`requireRoot`)
- В контроллерах для проверки ролей

### 2.3. Правила доступа

| Действие | ROOT | USER |
|----------|------|------|
| Вход в систему | ✅ | ✅ |
| Просмотр своего профиля | ✅ | ✅ |
| Изменение своего профиля | ❌ | ❌ |
| Просмотр списка пользователей | ✅ | ❌ |
| Создание пользователя | ✅ | ❌ |
| Изменение пользователя | ✅ | ❌ |
| Удаление пользователя | ✅ | ❌ |
| Деактивация пользователя | ✅ | ❌ |

**Важно:**
- ROOT не может изменить свою роль на USER
- ROOT не может удалить себя
- ROOT не может деактивировать себя
- USER не может изменять свои данные (только ROOT)

---

## 3. Схема авторизации (JWT)

### 3.1. Типы токенов

#### Access Token (короткоживущий)
- **Время жизни:** 15 минут (из `JWT_ACCESS_EXPIRES_IN`)
- **Payload:**
  ```typescript
  {
    userId: string;      // UUID пользователя
    role: UserRole;       // ROOT или USER
    type: 'access';      // Тип токена
    iat: number;         // Время выдачи
    exp: number;         // Время истечения
  }
  ```
- **Хранение:** В памяти React (через React Query/Zustand) или localStorage
- **Передача:** В HTTP заголовке `Authorization: Bearer <token>`
- **Назначение:** Доступ к защищенным API endpoints

#### Refresh Token (долгоживущий)
- **Время жизни:** 7 дней (из `JWT_REFRESH_EXPIRES_IN`)
- **Payload:**
  ```typescript
  {
    userId: string;      // UUID пользователя
    tokenId: string;     // UUID refresh токена в БД (для отзыва)
    type: 'refresh';      // Тип токена
    iat: number;         // Время выдачи
    exp: number;         // Время истечения
  }
  ```
- **Хранение:** В теле запроса (body) или памяти клиента
- **Передача:** Автоматически с каждым HTTP запросом
- **Назначение:** Обновление access токена без повторного входа

### 3.2. Решение: Cookie vs Header

**Текущая реализация:**

| Токен | Хранение (Frontend) | Передача | Причина |
|-------|----------|----------|---------|
| **Access Token** | Zustand store + localStorage (persist) | `Authorization: Bearer <token>` header | Стандартный подход, легко отозвать |
| **Refresh Token** | Zustand store + localStorage (persist) | В теле запроса (body) | Простота реализации, контроль со стороны клиента |

**Преимущества:**
- Access token в header - стандартный подход, легко отозвать
- Refresh token в body - полный контроль со стороны клиента
- Простая реализация без сложной логики cookies
- Удобно для SPA (React)
- Сохранение авторизации при перезагрузке страницы (localStorage)

**Безопасность (Frontend):**
- Токены хранятся в localStorage с пониманием рисков XSS (см. комментарии в `frontend/src/store/authStore.ts`)
- При любом 401 - автоматическая очистка auth store и редирект на `/login`
- Frontend не показывает технические детали ошибок пользователю
- Frontend блокирует попытки редактирования ROOT пользователей

**Примечание:** В будущем можно перейти на httpOnly cookie для refresh token для дополнительной защиты от XSS.

### 3.3. Flow авторизации

```
1. Вход (POST /api/auth/login)
   ├─ Проверка email/password
   ├─ Генерация Access Token (15 мин)
   ├─ Генерация Refresh Token (7 дней)
   ├─ Сохранение Refresh Token в БД
   └─ Возврат Refresh Token в response body
   └─ Возврат Access Token в response body

2. Запрос к API (GET /api/users)
   ├─ Извлечение Access Token из Authorization header
   ├─ Валидация Access Token
   ├─ Проверка прав доступа (middleware)
   └─ Выполнение запроса

3. Обновление токена (POST /api/auth/refresh)
   ├─ Извлечение Refresh Token из body
   ├─ Валидация Refresh Token
   ├─ Проверка наличия в БД (не отозван)
   ├─ Генерация нового Access Token
   ├─ Опционально: ротация Refresh Token
   └─ Возврат нового Access Token

4. Выход (POST /api/auth/logout)
   ├─ Удаление Refresh Token из БД
   └─ Возврат 204 No Content
```

---

## 4. API Endpoints

### 4.1. Auth Endpoints

```
POST   /api/auth/login          # Вход (email, password) → { accessToken, refreshToken, user }
POST   /api/auth/logout         # Выход (refreshToken в body) → 204
POST   /api/auth/refresh        # Обновление токенов (refreshToken в body) → { accessToken, refreshToken }
```

**Middleware:**
- `/api/auth/login` - `authRateLimiter` (15 попыток / 15 минут) + `validateBody(loginSchema)`
- `/api/auth/refresh` - `validateBody(refreshSchema)`
- `/api/auth/logout` - `validateBody(refreshSchema)`

### 4.2. Users Endpoints

```
GET    /api/users/me            # Текущий пользователь (требует auth) → { user }
GET    /api/users               # Список пользователей (требует ROOT) → { users[] }
POST   /api/users               # Создание пользователя (требует ROOT) → { user } (201)
PATCH  /api/users/:id           # Изменение пользователя (требует ROOT) → { user }
```

**Middleware:**
- `/api/users/me` - `authMiddleware` + `requireAuth`
- `/api/users` (GET, POST) - `authMiddleware` + `requireAuth` + `requireRoot`
- `/api/users/:id` (PATCH) - `authMiddleware` + `requireAuth` + `requireRoot` + `validateBody(updateUserSchema)`

**Ограничения:**
- Нельзя создать ROOT через API (всегда создается с role: USER)
- Нельзя изменить ROOT через API (403)
- Нельзя обновить role на ROOT (403)

---

## 5. Security-инварианты

### 5.1. Rate Limiting

**Общий rate limiter (уже есть):**
- 500 запросов / 15 минут с одного IP

**Строгий rate limiter для `/api/auth/login`:**
- 15 попыток / 15 минут с одного IP
- Защита от brute force атак
- Возвращает 429 Too Many Requests

**Реализация:**
```typescript
// src/middleware/rate-limit/auth-rate-limit.ts
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 минут
  max: 15,                    // 15 попыток
  message: 'Too many login attempts, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});
```

### 5.2. Защита от brute force

**Дополнительные меры:**
- Логирование всех попыток входа (успешных и неудачных)
- Блокировка IP после 10 неудачных попыток на 1 час (опционально, через Redis)
- CAPTCHA после 3 неудачных попыток (опционально)

### 5.3. Отсутствие саморегистрации

**Инвариант:**
- Нет endpoint `/api/auth/register`
- Создание пользователей только через `/api/users` (требует ROOT роль)
- Валидация в middleware: обычный пользователь не может создавать других

### 5.4. Защита root-пользователя

**Инварианты:**
- ROOT не может быть удален через API
- ROOT не может изменить свою роль на USER
- ROOT не может деактивировать себя
- ROOT не может быть создан повторно (проверка при создании)

**Реализация:**
```typescript
// В users.service.ts
async deleteUser(userId: string, currentUser: User) {
  // Проверка: нельзя удалить ROOT
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (user?.role === UserRole.ROOT) {
    throw new Error('Cannot delete ROOT user');
  }
  // ...
}
```

### 5.5. Валидация входных данных

**Все входные данные валидируются через Zod:**
- Email: валидный формат
- Password: требования сложности (для создания пользователя)
- UUID: валидный формат для ID
- Роли: только ROOT или USER

### 5.6. Хеширование паролей

**Требования:**
- Использовать argon2id (memoryCost: 65536, timeCost: 3, parallelism: 4)
- Никогда не хранить пароли в открытом виде
- Не логировать пароли (даже хешированные)

### 5.7. JWT Security

**Требования:**
- Секреты минимум 32 символа (валидируется в env.ts)
- Разные секреты для Access и Refresh токенов
- Access token короткоживущий (15 минут)
- Refresh token хранится в БД для возможности отзыва
- Валидация подписи при каждом запросе

### 5.8. CORS

**Настройка для фронтенда:**
```typescript
// Разрешить только с фронтенда
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,  // Для CORS (если в будущем будут использоваться cookies)
}));
```

### 5.9. Логирование безопасности

**Логировать:**
- Все попытки входа (успешные и неудачные)
- Изменение ролей пользователей
- Удаление пользователей
- Отзыв refresh токенов
- Подозрительная активность (множественные неудачные попытки)

---

## 6. Инициализация root-пользователя

### 6.1. При первом запуске

**Процесс:**
1. При старте приложения проверять наличие ROOT пользователя
2. Если ROOT не существует:
   - Создать пользователя с данными из `ROOT_EMAIL` и `ROOT_PASSWORD`
   - Хешировать пароль через argon2id
   - Установить роль `ROOT`
3. Если ROOT уже существует - пропустить

**Реализация:**
```typescript
// В src/index.ts или отдельном файле src/config/init-root.ts
async function initializeRootUser() {
  const rootExists = await prisma.user.findFirst({
    where: { role: UserRole.ROOT }
  });
  
  if (!rootExists) {
    const passwordHash = await hashPassword(env.ROOT_PASSWORD);
    await prisma.user.create({
      data: {
        email: env.ROOT_EMAIL,
        password: hashedPassword,
        role: UserRole.ROOT,
      }
    });
    logger.info('Root user initialized');
  }
}
```

---

## 7. Типы TypeScript

### 7.1. Расширение Express Request

**Файл: `src/middleware/auth.ts`**

```typescript
export interface AuthenticatedUser {
  id: string;
  email: string;
  role: 'ROOT' | 'USER';
  passwordVersion: number;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}
```

**Использование:**
- После middleware `authMiddleware` в `req.user` доступны данные пользователя
- Типобезопасный доступ к `req.user` в контроллерах
- `requireAuth` проверяет наличие `req.user`
- `requireRoot` проверяет `req.user.role === 'ROOT'`

### 7.2. JWT Payload типы

**Файл: `src/modules/auth/token.service.ts`**

```typescript
export interface AccessTokenPayload {
  sub: string;              // UUID пользователя
  email: string;            // Email пользователя
  role: 'ROOT' | 'USER';    // Роль
  passwordVersion: number;  // Версия пароля (для инвалидации)
  type: 'access';
  iat: number;
  exp: number;
}

export interface RefreshTokenPayload {
  sub: string;              // UUID пользователя
  tokenId: string;          // UUID refresh token в БД
  passwordVersion: number;  // Версия пароля (для инвалидации)
  type: 'refresh';
  iat: number;
  exp: number;
}
```

---

## 8. Зависимости

### 8.1. Необходимые пакеты

```json
{
  "dependencies": {
    "jsonwebtoken": "^9.0.2",        // JWT токены
    "argon2": "^0.44.0",             // Хеширование паролей (argon2id)
    "zod": "^3.24.1",                // Валидация схем
    "dotenv-safe": "^9.1.0",         // Валидация env переменных
    "@prisma/client": "6.18.0",      // Prisma ORM
    "express-rate-limit": "^8.2.1",  // Rate limiting
    "helmet": "^8.1.0",              // Security headers
    "cors": "^2.8.5"                 // CORS
  },
  "devDependencies": {
    "@types/jsonwebtoken": "^9.0.10",
    "@types/argon2": "^0.14.1",
    "@types/cors": "^2.8.19",
    "jest": "^30.2.0",               // Тестирование
    "supertest": "^7.1.4",           // HTTP тесты
    "ts-jest": "^29.4.5"             // TypeScript для Jest
  }
}
```

---

## 9. Порядок реализации

### Этап 1: Базовая структура
1. Создать структуру папок (`modules/auth`, `modules/users`, `common`)
2. Создать enum `UserRole`
3. Обновить Prisma schema
4. Создать миграцию

### Этап 2: Общие модули
1. Создать типы (`auth.types.ts`)
2. Создать утилиты (`password.util.ts`)
3. Создать константы (`auth.constants.ts`)

### Этап 3: Auth модуль
1. Создать `token.service.ts` (генерация/валидация JWT)
2. Создать `auth.service.ts` (логика входа/выхода)
3. Создать middleware `authenticate.ts`
4. Создать middleware `authorize.ts`
5. Создать контроллеры и routes
6. Создать Zod схемы

### Этап 4: Users модуль
1. Создать `users.service.ts` (CRUD с проверками)
2. Создать контроллеры и routes
3. Создать Zod схемы

### Этап 5: Интеграция
1. Подключить routes в главный роутер
2. Настроить rate limiting
3. Инициализация root-пользователя
4. Тестирование

---

## 11. Frontend архитектура авторизации

### 11.1. Структура frontend

```
frontend/src/
├── components/           # React компоненты
│   ├── AuthProvider.tsx  # Auth Context Provider (auto-login/logout)
│   ├── ProtectedRoute.tsx # Защищенный маршрут (требует авторизации)
│   ├── RootRoute.tsx     # Маршрут для ROOT (требует ROOT роль)
│   ├── PublicRoute.tsx   # Публичный маршрут (редирект если авторизован)
│   └── index.ts
├── hooks/                # React Query хуки
│   ├── useAuth.ts        # useLogin, useLogout, useCurrentUser, useRefresh
│   └── index.ts
├── store/                # Zustand store
│   ├── authStore.ts      # Auth state (user, tokens, selectors)
│   └── index.ts
├── utils/                # Утилиты
│   ├── api.ts            # API client (login, logout, refresh, getCurrentUser)
│   └── index.ts
├── pages/                # Страницы
│   ├── LoginPage.tsx     # Страница входа
│   ├── UsersAdminPage.tsx # Управление пользователями (ROOT)
│   └── index.ts
├── schemas/              # Zod схемы
│   ├── auth.schema.ts    # Схема валидации формы входа
│   └── index.ts
└── types/                # TypeScript типы
    └── index.ts
```

### 11.2. API Client (`utils/api.ts`)

**Основные функции:**
- `login(credentials)` - вход в систему
- `logout(refreshToken)` - выход из системы
- `refresh(refreshToken)` - обновление токенов
- `getCurrentUser(accessToken?)` - получение данных текущего пользователя

**Особенности:**
- Централизованная обработка ошибок через `handleResponse()`
- Автоматическая очистка auth store при 401 ошибке
- Автоматический редирект на `/login` при 401 ошибке
- `accessToken` всегда отправляется в `Authorization: Bearer <token>` header

### 11.3. Auth Store (`store/authStore.ts`)

**Состояние:**
- `user` - данные пользователя (User | null)
- `accessToken` - Access токен (string | null)
- `refreshToken` - Refresh токен (string | null)

**Экшены:**
- `setAuth(accessToken, refreshToken, user)` - установка токенов и пользователя
- `clearAuth()` - очистка состояния авторизации
- `updateUser(user)` - обновление данных пользователя
- `updateTokens(accessToken, refreshToken)` - обновление токенов

**Селекторы (computed):**
- `useIsAuthenticated()` - проверка авторизации (!!accessToken && !!user)
- `useIsRoot()` - проверка ROOT роли (user?.role === 'ROOT')

**Persistence:**
- Использует `persist` middleware из Zustand
- Сохраняет только токены в localStorage (ключ: `auth-storage`)
- User обновляется через API при загрузке приложения

**Безопасность:**
- Подробные комментарии о рисках XSS в localStorage
- Рекомендации по защите от XSS атак
- Примечание о будущей миграции на httpOnly cookies

### 11.4. React Query хуки (`hooks/useAuth.ts`)

**Хуки:**
- `useLogin()` - mutation для входа (сохраняет токены в store)
- `useLogout()` - mutation для выхода (очищает store и React Query cache)
- `useCurrentUser()` - query для получения данных пользователя (автоматический refetch)
- `useRefresh()` - mutation для обновления токенов (обновляет store)

**Особенности:**
- Интеграция с Zustand store
- Автоматическое обновление React Query cache
- Очистка кэша при logout

### 11.5. Auth Provider (`components/AuthProvider.tsx`)

**Функциональность:**
- Автоматическая загрузка данных пользователя при наличии токенов
- Автоматическая очистка auth store при ошибке загрузки пользователя

**Использование:**
- Оборачивает все приложение в `App.tsx`
- Использует `useCurrentUser()` для загрузки данных пользователя

### 11.6. Route Protection

**ProtectedRoute:**
- Проверяет `isAuthenticated`
- Редиректит на `/login` если не авторизован
- Разрешает доступ только авторизованным пользователям

**RootRoute:**
- Проверяет `isAuthenticated` и `isRoot`
- Редиректит на `/login` если не авторизован
- Редиректит на `/` если авторизован, но не ROOT
- Разрешает доступ только ROOT пользователям

**PublicRoute:**
- Редиректит на `/` если уже авторизован
- Используется для страниц входа (чтобы избежать повторного входа)

### 11.7. Login Page (`pages/LoginPage.tsx`)

**Особенности:**
- React Hook Form + Zod для валидации
- MUI компоненты для UI
- Общее сообщение об ошибке (без технических деталей)
- Автоматический редирект после успешного входа (через PublicRoute)

### 11.8. Security требования (Frontend)

**Обязательные требования:**
- ✅ Токены хранятся в localStorage (с пониманием рисков XSS)
- ✅ accessToken всегда отправляется в `Authorization: Bearer <token>` header
- ✅ При любом 401 - очищает auth store и редиректит на `/login`
- ✅ Не показывает технические детали ошибок пользователю
- ✅ Не раскрывает детали ошибок авторизации
- ✅ Блокирует попытки редактирования ROOT пользователей

**Защита от редактирования ROOT:**
- UI поля disabled для ROOT в `EditUserDialog`
- Кнопка редактирования скрыта для ROOT в `UserTable`
- Дополнительная проверка в `onSubmit` для предотвращения отправки запросов

---

## 12. Чеклист безопасности

Перед деплоем проверить:

### Backend:
- [ ] Все JWT секреты минимум 32 символа
- [ ] JWT_ACCESS_SECRET ≠ JWT_REFRESH_SECRET
- [ ] ROOT_PASSWORD соответствует требованиям (мин. 12 символов, заглавные/строчные, цифры, спецсимволы)
- [ ] Access token живет ≤ 1 часа (рекомендуется 15 минут)
- [ ] Refresh token живет дольше Access token (рекомендуется 7 дней)
- [ ] Rate limiting настроен для `/api/auth/login` (15 попыток / 15 минут)
- [ ] CORS настроен правильно (не `*`, только разрешенные origins)
- [ ] ROOT не может быть удален/изменен через API
- [ ] Нельзя создать ROOT через API
- [ ] Нет endpoint для саморегистрации
- [ ] Пароли хешируются через argon2id (не bcrypt)
- [ ] Логирование попыток входа (без паролей/токенов)
- [ ] Валидация всех входных данных через Zod
- [ ] Ротация refresh токенов реализована
- [ ] Инвалидация токенов при смене пароля (passwordVersion)
- [ ] Helmet.js настроен с правильными заголовками

### Frontend:
- [ ] Токены хранятся в localStorage (с пониманием рисков XSS - см. комментарии в коде)
- [ ] accessToken всегда отправляется в `Authorization: Bearer <token>` header
- [ ] При любом 401 - очищает auth store и редиректит на `/login`
- [ ] Не показывает технические детали ошибок пользователю
- [ ] Не раскрывает детали ошибок авторизации
- [ ] Блокирует попытки редактирования ROOT пользователей (UI + проверка в onSubmit)
- [ ] ProtectedRoute и RootRoute корректно редиректят при отсутствии авторизации
- [ ] AuthProvider автоматически загружает данные пользователя при наличии токенов

---

## Заключение

Эта архитектура обеспечивает:
- ✅ Модульность и масштабируемость
- ✅ Безопасность (JWT, rate limiting, защита root)
- ✅ Типобезопасность (TypeScript + Zod)
- ✅ Удобство для SPA (React + React Query + Zustand)
- ✅ Соответствие best practices

**Backend:** Полностью реализован и покрыт интеграционными тестами.  
**Frontend:** Полностью реализован с авторизацией и защитой маршрутов.

Готово к использованию! 🚀

