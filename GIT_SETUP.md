# 📦 Инструкция по настройке Git для передачи проекта

## ✅ Текущее состояние

- ✅ Git репозиторий уже инициализирован
- ✅ Есть история коммитов
- ✅ `.gitignore` настроен правильно
- ⚠️ БД файлы удалены из индекса (но остались локально)
- ⚠️ Нет remote репозитория (GitHub/GitLab)

---

## 🔧 Шаг 1: Создание `.env.example` файла

Создайте файл `backend/.env.example` со следующим содержимым:

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
ROOT_EMAIL=admin@example.com
ROOT_PASSWORD=ChangeMe123!@#

# ============================================
# JWT Секреты (минимум 32 символа каждый)
# ============================================
JWT_ACCESS_SECRET=dev-access-secret-min-32-chars-long-change-in-production
JWT_REFRESH_SECRET=dev-refresh-secret-min-32-chars-long-change-in-production
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# ============================================
# Интеграции (опционально)
# ============================================
# TELEGRAM_BOT_TOKEN=your-telegram-bot-token
```

---

## 🔧 Шаг 2: Проверка и очистка изменений

### 2.1. Проверьте текущий статус:
```powershell
cd C:\Users\CibargStar\Desktop\SRO
git status
```

### 2.2. Убедитесь, что БД файлы не отслеживаются:
```powershell
git ls-files | Select-String "\.db$"
```
Должно быть пусто (или только файлы, которые должны быть в репозитории).

### 2.3. Добавьте все изменения:
```powershell
git add .
```

### 2.4. Проверьте, что будет закоммичено:
```powershell
git status
```

**ВАЖНО:** Убедитесь, что в списке НЕТ:
- ❌ `backend/prisma/prisma/*.db`
- ❌ `backend/.env` (если есть)
- ❌ `frontend/.env` (если есть)
- ❌ `node_modules/`
- ❌ `backend/dist/`
- ❌ `backend/logs/`

**ДОЛЖНО БЫТЬ:**
- ✅ `backend/.env.example` (новый файл)
- ✅ Изменения в исходном коде
- ✅ Обновленный `.gitignore`

---

## 🔧 Шаг 3: Коммит изменений

```powershell
git commit -m "chore: подготовка к передаче проекта

- Добавлен .env.example для backend
- Обновлен .gitignore для исключения БД файлов
- Удалены БД файлы из индекса Git"
```

---

## 🔧 Шаг 4: Создание remote репозитория

### Вариант A: GitHub

1. **Создайте репозиторий на GitHub:**
   - Перейдите на https://github.com/new
   - Название: `SRO` (или любое другое)
   - Описание: "BM Tools - система массовых рассылок"
   - **НЕ** создавайте README, .gitignore или лицензию (они уже есть)
   - Нажмите "Create repository"

2. **Подключите remote:**
   ```powershell
   git remote add origin https://github.com/ВАШ_USERNAME/SRO.git
   # или через SSH:
   # git remote add origin git@github.com:ВАШ_USERNAME/SRO.git
   ```

3. **Проверьте подключение:**
   ```powershell
   git remote -v
   ```

### Вариант B: GitLab

1. **Создайте проект на GitLab:**
   - Перейдите на https://gitlab.com/projects/new
   - Название: `SRO`
   - Видимость: Private (или Public, как нужно)
   - **НЕ** инициализируйте с README

2. **Подключите remote:**
   ```powershell
   git remote add origin https://gitlab.com/ВАШ_USERNAME/SRO.git
   # или через SSH:
   # git remote add origin git@gitlab.com:ВАШ_USERNAME/SRO.git
   ```

---

## 🔧 Шаг 5: Отправка в remote репозиторий

### 5.1. Первая отправка (если ветка называется `main`):
```powershell
git push -u origin main
```

### 5.2. Если ветка называется `master`:
```powershell
git push -u origin master
```

### 5.3. Если возникла ошибка (ветки не совпадают):
```powershell
# Проверьте текущую ветку:
git branch

# Если нужно переименовать:
git branch -M main

# Затем отправьте:
git push -u origin main
```

---

## 🔧 Шаг 6: Проверка

После успешной отправки:

1. **Откройте репозиторий в браузере** (GitHub/GitLab)
2. **Убедитесь, что:**
   - ✅ Все файлы загружены
   - ✅ Нет `.env` файлов
   - ✅ Нет `node_modules/`
   - ✅ Нет БД файлов (`.db`)
   - ✅ Есть `backend/.env.example`

---

## 📋 Что получит коллега

После того как коллега склонирует репозиторий:

```powershell
git clone https://github.com/ВАШ_USERNAME/SRO.git
cd SRO
```

Он получит:
- ✅ Весь исходный код
- ✅ Конфигурационные файлы
- ✅ `.env.example` для настройки
- ✅ `.gitignore` (правильно настроенный)
- ❌ НЕ получит: `.env`, `node_modules/`, БД файлы, логи

---

## 🚀 Инструкция для коллеги

После клонирования коллеге нужно:

1. **Установить зависимости:**
   ```powershell
   cd backend
   npm install
   cd ../frontend
   npm install
   ```

2. **Создать `.env` файл:**
   ```powershell
   cd backend
   Copy-Item .env.example .env
   # Затем отредактировать .env и заполнить реальные значения
   ```

3. **Инициализировать БД:**
   ```powershell
   npx prisma generate
   npx prisma migrate dev
   ```

4. **Запустить проект:**
   ```powershell
   # Терминал 1:
   cd backend
   npm run dev
   
   # Терминал 2:
   cd frontend
   npm run dev
   ```

---

## ⚠️ Важные замечания

1. **Никогда не коммитьте:**
   - `.env` файлы (содержат секреты)
   - `node_modules/` (тяжелые, устанавливаются через npm)
   - БД файлы (создаются через миграции)
   - Логи и временные файлы

2. **Если случайно закоммитили секреты:**
   - Немедленно смените все пароли и секреты
   - Используйте `git filter-branch` или `git filter-repo` для удаления из истории

3. **Для приватных репозиториев:**
   - Убедитесь, что репозиторий приватный
   - Добавьте коллегу как collaborator (GitHub) или member (GitLab)

---

## 📝 Чеклист перед отправкой

- [ ] Создан `backend/.env.example`
- [ ] БД файлы удалены из Git индекса
- [ ] `.gitignore` обновлен
- [ ] Все изменения закоммичены
- [ ] Remote репозиторий создан и подключен
- [ ] Код отправлен в remote
- [ ] Проверено, что секреты не попали в репозиторий

---

Готово! 🎉




