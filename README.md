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

### Frontend

1. Создайте файл `.env` в папке `frontend/` (опционально):
```bash
cd frontend
```

2. Заполните переменные окружения (если нужно изменить настройки по умолчанию):

**Опциональные переменные:**
- `VITE_API_URL` - URL backend API (по умолчанию: `http://localhost:3000`)

**Примечание:** Frontend использует переменные окружения с префиксом `VITE_` для Vite bundler.

## Запуск

### Development

**Запуск Backend:**
```bash
cd backend
npm run dev
```
Backend запустится на `http://localhost:3000`

**Запуск Frontend:**
```bash
cd frontend
npm run dev
```
Frontend запустится на `http://localhost:5173` (по умолчанию)

**Frontend маршруты:**
- `/login` - Страница входа (публичная, редиректит на `/` если уже авторизован)
- `/` - Главная страница (требует авторизации)
- `/admin/users` - Управление пользователями (только для ROOT)

**Примечание:** Frontend автоматически обрабатывает авторизацию:
- При 401 ошибке - очищает auth store и редиректит на `/login`
- При наличии токенов - автоматически загружает данные пользователя
- Блокирует доступ к защищенным страницам без авторизации

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

### Backend особенности:

- JWT токены (Access + Refresh)
- Access токен в Authorization header (`Authorization: Bearer <token>`)
- Refresh токен в теле запроса (body)
- Ротация refresh токенов (старый токен инвалидируется при refresh)
- Защита от brute force (rate limiting: 5 попыток / 15 минут для `/auth/login`)
- Хеширование паролей через argon2id
- Инвалидация токенов при смене пароля (passwordVersion)
- Защита от создания/обновления ROOT через API

### Frontend особенности:

- **API Client:** React Query + fetch для HTTP запросов
- **State Management:** Zustand для хранения токенов и пользователя (с persist в localStorage)
- **Route Protection:** React Router 7 с компонентами `ProtectedRoute`, `RootRoute`, `PublicRoute`
- **Auto-login:** Автоматическая загрузка данных пользователя при наличии токенов
- **Auto-logout:** Автоматическая очистка auth store и редирект на `/login` при 401 ошибке
- **Security:**
  - Токены хранятся в localStorage (с пониманием рисков XSS, см. `frontend/src/store/authStore.ts`)
  - accessToken всегда отправляется в `Authorization: Bearer <token>` header
  - При 401 ошибке - очищает auth store и редиректит на `/login`
  - Не показывает технические детали ошибок пользователю
  - Блокирует попытки редактирования ROOT пользователей

**API Endpoints:**
- `POST /api/auth/login` - вход в систему
- `POST /api/auth/refresh` - обновление токенов
- `POST /api/auth/logout` - выход из системы
- `GET /api/users/me` - данные текущего пользователя
- `GET /api/users` - список пользователей (только ROOT)
- `POST /api/users` - создание пользователя (только ROOT)
- `PATCH /api/users/:id` - обновление пользователя (только ROOT)

**Frontend маршруты:**
- `/login` - Страница входа (публичная)
- `/` - Главная страница (требует авторизации)
- `/admin/users` - Управление пользователями (только ROOT)

Подробнее см. `backend/ARCHITECTURE.md`, `backend/SECURITY.md` и `stack&rule.md`.

