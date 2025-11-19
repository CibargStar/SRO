# Безопасность Prisma Schema - Модель User

## Обзор

Документ описывает security-аспекты модели User и типичные ошибки, которых нужно избегать.

---

## 1. Критичные ошибки безопасности

### ❌ 1.1. Хранение паролей в plaintext

**НЕПРАВИЛЬНО:**
```prisma
model User {
  password String  // ❌ ПЛОХО: пароль в открытом виде!
}
```

**ПРАВИЛЬНО:**
```prisma
model User {
  passwordHash String  // ✅ Хорошо: только хеш пароля
}
```

**Почему это критично:**
- При компрометации БД все пароли будут раскрыты
- Невозможно восстановить пароли (это хорошо!)
- Соответствие требованиям безопасности (OWASP, GDPR)

**Реализация:**
- Использовать bcrypt с cost factor 12+
- Никогда не логировать пароли (даже хешированные)
- Не возвращать passwordHash в API ответах

---

### ❌ 1.2. Отсутствие уникального индекса по email

**НЕПРАВИЛЬНО:**
```prisma
model User {
  email String  // ❌ Нет @unique - возможны дубликаты!
}
```

**ПРАВИЛЬНО:**
```prisma
model User {
  email String @unique  // ✅ Уникальный индекс
  @@index([email])      // ✅ Дополнительный индекс для производительности
}
```

**Почему это важно:**
- Предотвращает создание дубликатов email
- Обеспечивает целостность данных
- Ускоряет поиск по email (логин)

**Проблемы без уникального индекса:**
- Можно создать несколько пользователей с одним email
- Проблемы с восстановлением пароля
- Нарушение бизнес-логики

---

### ❌ 1.3. Использование предсказуемых ID

**НЕПРАВИЛЬНО:**
```prisma
model User {
  id Int @id @default(autoincrement())  // ❌ Предсказуемый ID (1, 2, 3...)
}
```

**ПРАВИЛЬНО:**
```prisma
model User {
  id String @id @default(uuid())  // ✅ UUID - непредсказуемый
}
```

**Почему это важно:**
- Предсказуемые ID позволяют перебирать пользователей
- UUID защищает от enumeration attacks
- Соответствие best practices

**Пример атаки:**
```
GET /api/users/1  → 200 OK (пользователь существует)
GET /api/users/2  → 200 OK
GET /api/users/999 → 404 (не существует)
```

---

### ❌ 1.4. Отсутствие поля isActive

**НЕПРАВИЛЬНО:**
```prisma
model User {
  // ❌ Нет способа деактивировать пользователя без удаления
}
```

**ПРАВИЛЬНО:**
```prisma
model User {
  isActive Boolean @default(true)  // ✅ Можно деактивировать без удаления
  @@index([isActive])              // ✅ Быстрый поиск активных пользователей
}
```

**Почему это важно:**
- Позволяет временно заблокировать пользователя
- Сохраняет историю (не удаляет данные)
- Можно восстановить доступ без пересоздания

**Использование:**
```typescript
// При логине проверять isActive
if (!user.isActive) {
  throw new Error('User is deactivated');
}
```

---

### ❌ 1.5. Отсутствие passwordVersion

**НЕПРАВИЛЬНО:**
```prisma
model User {
  passwordHash String
  // ❌ Нет способа инвалидировать токены при смене пароля
}
```

**ПРАВИЛЬНО:**
```prisma
model User {
  passwordHash   String
  passwordVersion Int @default(1)  // ✅ Версия пароля для инвалидации токенов
}
```

**Почему это важно:**
- При смене пароля можно инвалидировать все существующие токены
- Защита от использования украденных токенов
- Можно отслеживать версии паролей

**Использование:**
```typescript
// При смене пароля увеличить версию
await prisma.user.update({
  where: { id: userId },
  data: {
    passwordHash: newHash,
    passwordVersion: { increment: 1 }
  }
});

// При проверке токена проверять версию
if (token.passwordVersion !== user.passwordVersion) {
  throw new Error('Token invalidated');
}
```

---

### ❌ 1.6. Отсутствие индексов

**НЕПРАВИЛЬНО:**
```prisma
model User {
  email String @unique
  role  UserRole
  // ❌ Нет индексов - медленные запросы
}
```

**ПРАВИЛЬНО:**
```prisma
model User {
  email String @unique
  role  UserRole
  
  @@index([email])    // ✅ Быстрый поиск по email
  @@index([role])     // ✅ Быстрый поиск по роли
  @@index([isActive])  // ✅ Быстрый поиск активных пользователей
}
```

**Почему это важно:**
- Ускоряет частые запросы (логин, поиск по роли)
- Улучшает производительность при большом количестве пользователей
- Снижает нагрузку на БД

**Типичные запросы:**
```typescript
// Без индекса - медленно (full table scan)
const user = await prisma.user.findUnique({ where: { email } });

// С индексом - быстро (index lookup)
const rootUsers = await prisma.user.findMany({ where: { role: 'ROOT' } });
```

---

## 2. Защита от множественных ROOT пользователей

### Проблема

Без защиты можно случайно создать несколько ROOT пользователей или удалить последнего ROOT.

### Решение

**В коде (service layer):**

```typescript
// При создании пользователя с ролью ROOT
async createUser(data: CreateUserDto, currentUser: User) {
  if (data.role === UserRole.ROOT) {
    // Проверка: уже есть ROOT?
    const existingRoot = await prisma.user.findFirst({
      where: { role: UserRole.ROOT }
    });
    
    if (existingRoot) {
      throw new Error('ROOT user already exists');
    }
  }
  
  // Создание пользователя...
}

// При удалении ROOT пользователя
async deleteUser(userId: string, currentUser: User) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  
  if (user?.role === UserRole.ROOT) {
    // Проверка: это последний ROOT?
    const rootCount = await prisma.user.count({
      where: { role: UserRole.ROOT }
    });
    
    if (rootCount === 1) {
      throw new Error('Cannot delete last ROOT user');
    }
  }
  
  // Удаление пользователя...
}

// При изменении роли на ROOT
async updateUser(userId: string, data: UpdateUserDto, currentUser: User) {
  if (data.role === UserRole.ROOT) {
    // Проверка: уже есть ROOT?
    const existingRoot = await prisma.user.findFirst({
      where: { 
        role: UserRole.ROOT,
        id: { not: userId }  // Исключить текущего пользователя
      }
    });
    
    if (existingRoot) {
      throw new Error('ROOT user already exists');
    }
  }
  
  // Обновление пользователя...
}
```

**В Prisma schema:**
- Индекс по `role` для быстрой проверки наличия ROOT
- Уникальность не нужна (может быть несколько ROOT в будущем, но контролируется в коде)

---

## 3. Индексы - детальное объяснение

### 3.1. Индекс по email

```prisma
email String @unique
@@index([email])
```

**Зачем:**
- `@unique` создает уникальный индекс автоматически
- Явный `@@index([email])` для документации и производительности
- Ускоряет поиск при логине: `findUnique({ where: { email } })`

**Запросы:**
```typescript
// Быстро благодаря индексу
const user = await prisma.user.findUnique({ where: { email: 'user@example.com' } });
```

---

### 3.2. Индекс по role

```prisma
@@index([role])
```

**Зачем:**
- Ускоряет поиск пользователей по роли
- Критично для проверки наличия ROOT пользователя
- Ускоряет фильтрацию: `findMany({ where: { role: 'ROOT' } })`

**Запросы:**
```typescript
// Быстро благодаря индексу
const rootUsers = await prisma.user.findMany({ where: { role: UserRole.ROOT } });
const isRootExists = await prisma.user.count({ where: { role: UserRole.ROOT } }) > 0;
```

---

### 3.3. Индекс по isActive

```prisma
@@index([isActive])
```

**Зачем:**
- Ускоряет поиск активных пользователей
- Ускоряет фильтрацию: `findMany({ where: { isActive: true } })`
- Полезно для админ-панели

**Запросы:**
```typescript
// Быстро благодаря индексу
const activeUsers = await prisma.user.findMany({ where: { isActive: true } });
```

---

### 3.4. Составные индексы (опционально)

Если часто ищете по комбинации полей:

```prisma
// Пример: поиск активных пользователей определенной роли
@@index([role, isActive])
```

**Использование:**
```typescript
// Быстро благодаря составному индексу
const activeRoots = await prisma.user.findMany({
  where: { role: UserRole.ROOT, isActive: true }
});
```

**В нашем случае не обязательно**, так как:
- Обычно ищем по одному полю
- SQLite/Postgres оптимизируют запросы автоматически

---

## 4. Типичные ошибки в коде

### ❌ 4.1. Возврат passwordHash в API

**НЕПРАВИЛЬНО:**
```typescript
// ❌ Возвращает passwordHash в ответе
return {
  id: user.id,
  email: user.email,
  passwordHash: user.passwordHash,  // ❌ УТЕЧКА ДАННЫХ!
};
```

**ПРАВИЛЬНО:**
```typescript
// ✅ Исключить passwordHash из ответа
const { passwordHash, ...userWithoutPassword } = user;
return userWithoutPassword;

// Или использовать Prisma select
const user = await prisma.user.findUnique({
  where: { id },
  select: {
    id: true,
    email: true,
    role: true,
    // passwordHash: false  // Не включать
  }
});
```

---

### ❌ 4.2. Логирование паролей

**НЕПРАВИЛЬНО:**
```typescript
logger.info({ email, password });  // ❌ Логирует пароль!
logger.debug({ passwordHash });   // ❌ Даже хеш не нужно логировать!
```

**ПРАВИЛЬНО:**
```typescript
logger.info({ email, action: 'login_attempt' });  // ✅ Без пароля
logger.debug({ userId: user.id });              // ✅ Только ID
```

---

### ❌ 4.3. Слабое хеширование

**НЕПРАВИЛЬНО:**
```typescript
const hash = await bcrypt.hash(password, 5);  // ❌ Слишком низкий cost factor
```

**ПРАВИЛЬНО:**
```typescript
const hash = await bcrypt.hash(password, 12);  // ✅ Рекомендуемый cost factor
```

---

### ❌ 4.4. Отсутствие проверки isActive при логине

**НЕПРАВИЛЬНО:**
```typescript
const user = await prisma.user.findUnique({ where: { email } });
if (await bcrypt.compare(password, user.passwordHash)) {
  // ❌ Не проверяет isActive!
  return generateToken(user);
}
```

**ПРАВИЛЬНО:**
```typescript
const user = await prisma.user.findUnique({ where: { email } });
if (!user) throw new Error('Invalid credentials');
if (!user.isActive) throw new Error('User is deactivated');  // ✅ Проверка
if (!await bcrypt.compare(password, user.passwordHash)) {
  throw new Error('Invalid credentials');
}
return generateToken(user);
```

---

## 5. Миграции и версионирование

### 5.1. Создание миграции

```bash
# Создать миграцию
npx prisma migrate dev --name init_user_model

# Применить миграцию в production
npx prisma migrate deploy
```

### 5.2. Безопасность миграций

**Важно:**
- Не включать тестовые данные в миграции
- Не включать реальные пароли/секреты
- ROOT пользователь создается через код (из env), не через миграцию

---

## 6. Чеклист безопасности

Перед деплоем проверить:

- [ ] Пароли хранятся только как хеши (passwordHash)
- [ ] Email имеет уникальный индекс (@unique)
- [ ] ID использует UUID (не autoincrement)
- [ ] Есть поле isActive для деактивации
- [ ] Есть passwordVersion для инвалидации токенов
- [ ] Есть индексы на часто используемые поля (email, role, isActive)
- [ ] passwordHash не возвращается в API ответах
- [ ] Пароли не логируются
- [ ] bcrypt с cost factor 12+
- [ ] Проверка isActive при логине
- [ ] Защита от создания множественных ROOT
- [ ] Защита от удаления последнего ROOT

---

## Заключение

Правильно спроектированная Prisma schema - основа безопасности приложения. Следуя этим рекомендациям, вы избежите типичных уязвимостей и обеспечите надежную защиту данных пользователей.

