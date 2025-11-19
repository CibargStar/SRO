# BM Tools

Проект на основе современного стека технологий.

## Структура проекта

- `backend/` - Backend приложение (Node.js + Express + TypeScript)
- `frontend/` - Frontend приложение (React + Vite + TypeScript)

## Установка

### Backend
```bash
cd backend
npm install
```

### Frontend
```bash
cd frontend
npm install
```

## Настройка окружения

### Backend

1. Скопируйте `.env.example` в `.env`:
```bash
cd backend
cp .env.example .env
```

2. Заполните переменные окружения в `.env`:

**Обязательные переменные:**
- `ROOT_EMAIL` - Email root-пользователя (администратора)
- `ROOT_PASSWORD` - Пароль root-пользователя (минимум 12 символов, должен содержать заглавные/строчные буквы, цифры, спецсимволы)
- `JWT_ACCESS_SECRET` - Секретный ключ для Access токенов (минимум 32 символа)
- `JWT_REFRESH_SECRET` - Секретный ключ для Refresh токенов (минимум 32 символа, должен отличаться от ACCESS_SECRET)

**Генерация JWT секретов:**
```bash
# Linux/Mac
openssl rand -base64 32

# Windows PowerShell
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Minimum 0 -Maximum 256 }))
```

**Опциональные переменные:**
- `FRONTEND_URL` - URL фронтенд приложения для CORS (по умолчанию: `http://localhost:5173`)
- `JWT_ACCESS_EXPIRES_IN` - Время жизни Access токена (по умолчанию: `15m`)
- `JWT_REFRESH_EXPIRES_IN` - Время жизни Refresh токена (по умолчанию: `7d`)

3. Создайте миграцию базы данных:
```bash
cd backend
npx prisma migrate dev
```

## Запуск

### Development
```bash
# Backend
cd backend
npm run dev

# Frontend
cd frontend
npm run dev
```

### API Документация (Swagger)

После запуска backend сервера, Swagger UI доступен по адресу:
- **URL:** `http://localhost:3000/api-docs`
- **Описание:** Интерактивная документация всех API endpoints с возможностью тестирования запросов

**Особенности:**
- Полное описание всех эндпоинтов авторизации и управления пользователями
- Схемы данных (User, LoginInput, CreateUserInput и т.д.)
- Примеры запросов и ответов
- Описание ошибок и кодов ответов
- Возможность авторизации через Bearer токен прямо в Swagger UI

### Docker

#### Production

**ВАЖНО:** Перед запуском в production установите все переменные окружения в `.env` или через docker secrets.

```bash
docker-compose up --build
```

#### Development (с hot reload)
```bash
docker-compose -f docker-compose.dev.yml up --build
```

**Примечание:** В development режиме используются значения по умолчанию для переменных окружения, но рекомендуется создать `.env` файл.

#### Остановка
```bash
docker-compose down
# или для dev
docker-compose -f docker-compose.dev.yml down
```

#### Пересборка
```bash
docker-compose build --no-cache
```

## Система авторизации

Проект использует систему авторизации без саморегистрации:

- **ROOT** - администратор системы (создается из env переменных при первом запуске)
- **USER** - обычный пользователь (создается только ROOT'ом)

**Особенности:**
- JWT токены (Access + Refresh)
- Access токен в Authorization header (`Authorization: Bearer <token>`)
- Refresh токен в теле запроса (body)
- Ротация refresh токенов (старый токен инвалидируется при refresh)
- Защита от brute force (rate limiting: 5 попыток / 15 минут для `/auth/login`)
- Хеширование паролей через argon2id
- Инвалидация токенов при смене пароля (passwordVersion)
- Защита от создания/обновления ROOT через API

**API Endpoints:**
- `POST /api/auth/login` - вход в систему
- `POST /api/auth/refresh` - обновление токенов
- `POST /api/auth/logout` - выход из системы
- `GET /api/users/me` - данные текущего пользователя
- `GET /api/users` - список пользователей (только ROOT)
- `POST /api/users` - создание пользователя (только ROOT)
- `PATCH /api/users/:id` - обновление пользователя (только ROOT)

Подробнее см. `backend/ARCHITECTURE.md` и `backend/SECURITY.md`.

