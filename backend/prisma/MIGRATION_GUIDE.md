# Руководство по миграции Prisma

## Создание миграции

После обновления `schema.prisma` нужно создать и применить миграцию:

### Development

```bash
# Перейти в директорию backend
cd backend

# Создать миграцию (сгенерирует SQL и применит к БД)
npx prisma migrate dev --name init_user_model

# Или с описанием
npx prisma migrate dev --name init_user_model --create-only
# Затем отредактировать SQL файл в prisma/migrations/ если нужно
# И применить: npx prisma migrate dev
```

### Production

```bash
# Применить миграции (без создания новых)
npx prisma migrate deploy

# Сгенерировать Prisma Client
npx prisma generate
```

## Что будет создано

После миграции будут созданы:

1. **Таблица `users`:**
   - `id` (TEXT PRIMARY KEY) - UUID
   - `email` (TEXT UNIQUE) - Email пользователя
   - `passwordHash` (TEXT) - Хеш пароля
   - `role` (TEXT) - Роль (ROOT/USER)
   - `name` (TEXT NULL) - Имя пользователя
   - `isActive` (INTEGER) - Активен ли (0/1)
   - `passwordVersion` (INTEGER) - Версия пароля
   - `createdAt` (DATETIME) - Время создания
   - `updatedAt` (DATETIME) - Время обновления

2. **Таблица `refresh_tokens`:**
   - `id` (TEXT PRIMARY KEY) - UUID
   - `token` (TEXT UNIQUE) - JWT refresh token
   - `userId` (TEXT) - ID пользователя (FK)
   - `expiresAt` (DATETIME) - Время истечения
   - `createdAt` (DATETIME) - Время создания

3. **Индексы:**
   - `users.email` - уникальный индекс
   - `users.role` - индекс для поиска по роли
   - `users.isActive` - индекс для поиска активных
   - `refresh_tokens.userId` - индекс для поиска токенов пользователя
   - `refresh_tokens.expiresAt` - индекс для очистки истекших
   - `refresh_tokens.token` - уникальный индекс

## Проверка миграции

```bash
# Просмотреть статус миграций
npx prisma migrate status

# Открыть Prisma Studio для просмотра данных
npx prisma studio
```

## Откат миграции (development)

```bash
# Откатить последнюю миграцию
npx prisma migrate reset

# ВНИМАНИЕ: Это удалит все данные!
```

## Важные замечания

1. **Не коммитьте файлы БД** (например, `dev.db` для SQLite)
2. **Коммитьте миграции** в `prisma/migrations/`
3. **Не редактируйте** уже примененные миграции в production
4. **ROOT пользователь** создается через код (из env), не через миграцию

