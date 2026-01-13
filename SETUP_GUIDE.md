# Полное руководство по установке и запуску SRO

Это руководство поможет вам установить и запустить проект SRO с нуля.

## Содержание

1. [Требования](#требования)
2. [Клонирование репозитория](#клонирование-репозитория)
3. [Установка зависимостей](#установка-зависимостей)
4. [Настройка окружения](#настройка-окружения)
5. [Настройка базы данных](#настройка-базы-данных)
6. [Запуск приложения](#запуск-приложения)
7. [Проверка работоспособности](#проверка-работоспособности)
8. [Запуск через Docker](#запуск-через-docker)
9. [Решение проблем](#решение-проблем)

---

## Требования

Перед началом убедитесь, что у вас установлены:

- **Node.js** версии 18 или выше
- **npm** версии 9 или выше (или **yarn**)
- **Git**
- **Docker** и **Docker Compose** (опционально, для запуска через Docker)

### Проверка версий

```bash
# Проверка Node.js
node --version
# Должно быть v18.x.x или выше

# Проверка npm
npm --version
# Должно быть 9.x.x или выше

# Проверка Git
git --version

# Проверка Docker (опционально)
docker --version
docker-compose --version
```

---

## Клонирование репозитория

### Вариант 1: Клонирование существующего репозитория

```bash
# Клонируйте репозиторий
git clone https://github.com/CibargStar/SRO.git

# Перейдите в директорию проекта
cd SRO
```

### Вариант 2: Создание нового репозитория на GitHub

Если вы хотите создать новый репозиторий:

1. Перейдите на [GitHub](https://github.com/new)
2. Создайте новый репозиторий (например, `SRO`)
3. **НЕ** инициализируйте его с README, .gitignore или лицензией
4. Выполните следующие команды:

```bash
# Если у вас уже есть локальный репозиторий
cd SRO
git remote remove origin  # Удалите старый remote (если есть)
git remote add origin https://github.com/ВАШ_USERNAME/SRO.git
git branch -M main
git push -u origin main

# Если вы клонируете пустой репозиторий
git clone https://github.com/ВАШ_USERNAME/SRO.git
cd SRO
```

---

## Установка зависимостей

Проект состоит из двух частей: backend и frontend. Установите зависимости для обеих частей.

### Backend

```bash
# Перейдите в директорию backend
cd backend

# Установите зависимости
npm install

# Вернитесь в корень проекта
cd ..
```

### Frontend

```bash
# Перейдите в директорию frontend
cd frontend

# Установите зависимости
npm install

# Вернитесь в корень проекта
cd ..
```

**Примечание:** Установка может занять несколько минут, особенно при первом запуске.

---

## Настройка окружения

### Backend

1. **Создайте файл `.env` на основе примера:**

```bash
cd backend

# Windows (PowerShell)
Copy-Item .env.example .env

# Linux/Mac
cp .env.example .env
```

2. **Откройте файл `.env` и настройте переменные окружения:**

```env
# ============================================
# Базовые настройки
# ============================================
NODE_ENV=development
PORT=3000
DATABASE_URL=file:./prisma/dev.db
LOG_LEVEL=debug

# ============================================
# Frontend URL для CORS
# ============================================
FRONTEND_URL=http://localhost:5173

# ============================================
# Авторизация - Root пользователь
# ============================================
# Email администратора (замените на свой)
ROOT_EMAIL=admin@example.com

# Пароль администратора (минимум 12 символов)
# Должен содержать: заглавные/строчные буквы, цифры, спецсимволы
ROOT_PASSWORD=ChangeMe123!@#

# ============================================
# JWT секреты (минимум 32 символа каждый)
# ============================================
# ВАЖНО: Для production сгенерируйте криптографически случайные секреты!

# Генерация секретов (PowerShell):
# [Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Minimum 0 -Maximum 256 }))

JWT_ACCESS_SECRET=dev-access-secret-min-32-chars-long-change-in-production
JWT_REFRESH_SECRET=dev-refresh-secret-min-32-chars-long-change-in-production

# Время жизни токенов
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# ============================================
# Интеграции (опционально)
# ============================================
TELEGRAM_BOT_TOKEN=your-telegram-bot-token
```

**Важно для production:**

Для production окружения **обязательно** сгенерируйте криптографически случайные JWT секреты:

```powershell
# Windows PowerShell
$accessSecret = [Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Minimum 0 -Maximum 256 }))
$refreshSecret = [Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Minimum 0 -Maximum 256 }))
Write-Host "JWT_ACCESS_SECRET=$accessSecret"
Write-Host "JWT_REFRESH_SECRET=$refreshSecret"
```

```bash
# Linux/Mac
openssl rand -base64 32  # Для ACCESS_SECRET
openssl rand -base64 32  # Для REFRESH_SECRET
```

### Frontend

Frontend обычно работает без дополнительной настройки, но при необходимости можно создать файл `.env`:

```bash
cd frontend

# Создайте файл .env (опционально)
# Windows (PowerShell)
New-Item -ItemType File -Path .env

# Linux/Mac
touch .env
```

Добавьте в `.env` (если нужно изменить URL API):

```env
VITE_API_URL=http://localhost:3000
```

**Примечание:** Frontend использует переменные окружения с префиксом `VITE_` для Vite bundler.

---

## Настройка базы данных

### Генерация Prisma Client

```bash
cd backend

# Генерация Prisma Client
npm run prisma:generate
```

### Применение миграций

```bash
# Применение миграций (создаст БД если её нет)
npm run prisma:migrate
```

Эта команда:
- Создаст базу данных SQLite в `backend/prisma/dev.db` (если её нет)
- Применит все миграции
- Создаст ROOT пользователя из переменных окружения

**Примечание:** Если вы видите ошибки при миграции, убедитесь, что:
- Файл `.env` создан и правильно настроен
- Все переменные окружения заполнены
- Пароль ROOT_PASSWORD соответствует требованиям (минимум 12 символов, содержит заглавные/строчные буквы, цифры, спецсимволы)

---

## Запуск приложения

### Development режим

#### Запуск Backend

Откройте первый терминал:

```bash
cd backend
npm run dev
```

Backend запустится на `http://localhost:3000`

Вы должны увидеть:
```
Server is running on port 3000
Swagger UI available at http://localhost:3000/api-docs
```

#### Запуск Frontend

Откройте второй терминал:

```bash
cd frontend
npm run dev
```

Frontend запустится на `http://localhost:5173` (по умолчанию)

Вы должны увидеть:
```
  VITE v7.x.x  ready in xxx ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
```

### Production режим

#### Сборка Backend

```bash
cd backend

# Сборка TypeScript
npm run build

# Запуск
npm start
```

#### Сборка Frontend

```bash
cd frontend

# Сборка
npm run build

# Предпросмотр production сборки
npm run preview
```

---

## Проверка работоспособности

### 1. Проверка Backend

Откройте в браузере:

- **Health Check:** http://localhost:3000/health
  - Должен вернуть: `{"status":"ok"}`

- **Swagger UI:** http://localhost:3000/api-docs
  - Должна открыться интерактивная документация API

### 2. Проверка Frontend

Откройте в браузере:

- **Главная страница:** http://localhost:5173
  - Должен произойти редирект на `/login` (если не авторизованы)

- **Страница входа:** http://localhost:5173/login
  - Должна открыться форма входа

### 3. Первый вход в систему

1. Откройте http://localhost:5173/login
2. Введите данные ROOT пользователя из файла `.env`:
   - **Email:** значение из `ROOT_EMAIL` (например, `admin@example.com`)
   - **Password:** значение из `ROOT_PASSWORD` (например, `ChangeMe123!@#`)
3. Нажмите "Войти"
4. После успешного входа вы будете перенаправлены на главную страницу

### 4. Проверка через Swagger

1. Откройте http://localhost:3000/api-docs
2. Найдите эндпоинт `POST /api/auth/login`
3. Нажмите "Try it out"
4. Введите данные ROOT пользователя:
   ```json
   {
     "email": "admin@example.com",
     "password": "ChangeMe123!@#"
   }
   ```
5. Нажмите "Execute"
6. Скопируйте полученный `accessToken`
7. Нажмите кнопку **"Authorize"** (🔓) в правом верхнем углу
8. Вставьте токен в формате `Bearer <token>`
9. Теперь можете тестировать защищенные эндпоинты

---

## Запуск через Docker

### Development режим (с hot reload)

```bash
# Из корня проекта
docker-compose -f docker-compose.dev.yml up --build
```

Эта команда:
- Соберет образы для backend и frontend
- Запустит контейнеры с hot reload
- Backend будет доступен на `http://localhost:3000`
- Frontend будет доступен на `http://localhost:5173`

**Примечание:** В development режиме используются значения по умолчанию для переменных окружения, но рекомендуется создать `.env` файл.

### Production режим

**ВАЖНО:** Перед запуском в production установите все переменные окружения в `.env` или через docker secrets.

```bash
# Из корня проекта
docker-compose up --build
```

### Остановка контейнеров

```bash
# Остановка и удаление контейнеров
docker-compose down

# Или для dev
docker-compose -f docker-compose.dev.yml down
```

### Пересборка образов

```bash
# Пересборка без кэша
docker-compose build --no-cache
```

---

## Решение проблем

### Проблема: Backend не запускается

**Ошибка:** `Missing required environment variables`

**Решение:**
1. Убедитесь, что файл `backend/.env` существует
2. Проверьте, что все обязательные переменные заполнены:
   - `ROOT_EMAIL`
   - `ROOT_PASSWORD` (минимум 12 символов)
   - `JWT_ACCESS_SECRET` (минимум 32 символа)
   - `JWT_REFRESH_SECRET` (минимум 32 символа)
3. Убедитесь, что `JWT_ACCESS_SECRET` и `JWT_REFRESH_SECRET` отличаются друг от друга

**Ошибка:** `Port 3000 is already in use`

**Решение:**
1. Найдите процесс, использующий порт 3000:
   ```powershell
   # Windows
   netstat -ano | findstr :3000
   ```
   ```bash
   # Linux/Mac
   lsof -i :3000
   ```
2. Остановите процесс или измените порт в `.env`:
   ```env
   PORT=3001
   ```

**Ошибка:** `Prisma Client not generated`

**Решение:**
```bash
cd backend
npm run prisma:generate
```

### Проблема: Frontend не запускается

**Ошибка:** `Port 5173 is already in use`

**Решение:**
1. Найдите процесс, использующий порт 5173
2. Остановите процесс или измените порт в `vite.config.ts`

**Ошибка:** `Cannot connect to backend API`

**Решение:**
1. Убедитесь, что backend запущен на `http://localhost:3000`
2. Проверьте переменную `VITE_API_URL` в `frontend/.env` (если используется)
3. Проверьте CORS настройки в backend (переменная `FRONTEND_URL`)

### Проблема: База данных не создается

**Ошибка:** `Migration failed`

**Решение:**
1. Убедитесь, что файл `backend/.env` существует и правильно настроен
2. Проверьте права доступа к директории `backend/prisma/`
3. Попробуйте удалить существующую БД и создать заново:
   ```bash
   cd backend
   Remove-Item prisma/dev.db -ErrorAction SilentlyContinue  # Windows
   # или
   rm prisma/dev.db  # Linux/Mac
   npm run prisma:migrate
   ```

### Проблема: Не могу войти в систему

**Ошибка:** `Invalid credentials`

**Решение:**
1. Убедитесь, что используете правильные данные из `backend/.env`:
   - `ROOT_EMAIL`
   - `ROOT_PASSWORD`
2. Проверьте, что ROOT пользователь создан:
   ```bash
   cd backend
   npm run prisma:studio
   # Откройте http://localhost:5555 и проверьте таблицу User
   ```
3. Если пользователь не создан, перезапустите backend (ROOT создается при первом запуске)

### Проблема: Docker контейнеры не запускаются

**Ошибка:** `Cannot connect to Docker daemon`

**Решение:**
1. Убедитесь, что Docker Desktop запущен
2. Проверьте, что Docker работает:
   ```bash
   docker ps
   ```

**Ошибка:** `Environment variables not set`

**Решение:**
1. Создайте файл `.env` в корне проекта или в `backend/`
2. Убедитесь, что все обязательные переменные установлены
3. Для production используйте docker secrets или `.env` файл

---

## Полезные команды

### Backend

```bash
cd backend

# Запуск в development режиме
npm run dev

# Сборка
npm run build

# Запуск production
npm start

# Проверка типов TypeScript
npm run type-check

# Линтинг
npm run lint
npm run lint:fix

# Тесты
npm test
npm run test:watch
npm run test:coverage

# Prisma
npm run prisma:generate
npm run prisma:migrate
npm run prisma:studio  # GUI для БД
```

### Frontend

```bash
cd frontend

# Запуск в development режиме
npm run dev

# Сборка
npm run build

# Предпросмотр production сборки
npm run preview

# Проверка типов TypeScript
npm run type-check

# Линтинг
npm run lint
npm run lint:fix

# Тесты
npm test
npm run test:watch
npm run test:coverage
```

---

## Структура проекта

```
SRO/
├── backend/              # Backend приложение
│   ├── src/             # Исходный код
│   ├── prisma/          # Prisma схема и миграции
│   ├── uploads/         # Загруженные файлы (игнорируется git)
│   ├── .env             # Переменные окружения (игнорируется git)
│   ├── .env.example     # Пример переменных окружения
│   └── package.json
├── frontend/            # Frontend приложение
│   ├── src/             # Исходный код
│   ├── .env             # Переменные окружения (опционально)
│   └── package.json
├── docker-compose.yml   # Docker Compose для production
├── docker-compose.dev.yml # Docker Compose для development
├── .gitignore          # Git ignore правила
└── README.md           # Основная документация
```

---

## Дополнительная информация

- **API Документация:** http://localhost:3000/api-docs (Swagger UI)
- **Prisma Studio:** `npm run prisma:studio` в директории backend (GUI для БД)
- **Health Check:** http://localhost:3000/health

---

## Поддержка

Если у вас возникли проблемы, не описанные в этом руководстве:

1. Проверьте логи backend и frontend в консоли
2. Убедитесь, что все зависимости установлены
3. Проверьте, что все переменные окружения настроены правильно
4. Убедитесь, что порты 3000 и 5173 свободны

---

**Успешной разработки! 🚀**
