# Тестовая инфраструктура

## Обзор

Тестовая инфраструктура для backend включает:
- Jest конфигурацию для TypeScript
- Утилиты для создания тестового Express приложения
- Утилиты для работы с тестовой БД

## Структура

```
backend/src/tests/
├── setup.ts              # Глобальная настройка тестов
├── utils/
│   ├── testApp.ts        # Создание тестового Express приложения
│   ├── testDb.ts         # Утилиты для работы с тестовой БД
│   └── index.ts          # Экспорт утилит
└── README.md             # Этот файл
```

## Настройка тестовой БД

### Варианты тестовой БД

**1. In-memory SQLite (по умолчанию, быстрее):**
```env
TEST_DATABASE_URL=file::memory:?cache=shared
```

**Преимущества:**
- Очень быстро
- Автоматическая очистка при закрытии соединения
- Не оставляет файлов

**Недостатки:**
- Нужно применять схему вручную (Prisma Migrate API)
- Данные теряются при закрытии соединения

**2. Отдельный файл (медленнее, но удобнее для отладки):**
```env
TEST_DATABASE_URL=file:./prisma/test.db
```

**Преимущества:**
- Можно использовать Prisma Migrate
- Данные сохраняются для отладки
- Проще применять миграции

**Недостатки:**
- Медленнее in-memory
- Нужно очищать файл между запусками тестов

### Применение миграций

**Для in-memory БД:**
```bash
# Применить схему через db push (перед запуском тестов)
DATABASE_URL="file::memory:?cache=shared" npx prisma db push
```

**Для файловой БД:**
```bash
# Применить миграции
DATABASE_URL="file:./prisma/test.db" npx prisma migrate deploy

# Или использовать db push
DATABASE_URL="file:./prisma/test.db" npx prisma db push
```

**ВАЖНО:** Не использовать `dev.db` или production БД для тестов!

## Использование

### Базовый пример

```typescript
import request from 'supertest';
import { createTestApp, resetDatabase } from '../tests/utils';

describe('Auth API', () => {
  let testApp: TestApp;

  beforeAll(async () => {
    // Создаем тестовое приложение (применяет миграции и создает root пользователя)
    testApp = await createTestApp();
  });

  beforeEach(async () => {
    // Очищаем БД между тестами
    await resetDatabase(testApp.prisma);
  });

  afterAll(async () => {
    // Закрываем соединение с БД
    await testApp.prisma.$disconnect();
  });

  it('should login user', async () => {
    const response = await request(testApp.app)
      .post('/api/auth/login')
      .send({
        email: 'user@example.com',
        password: 'Password123!@#',
      });

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('accessToken');
  });
});
```

### Пропуск инициализации root пользователя

```typescript
// Если нужно создать root пользователя вручную в тесте
const testApp = await createTestApp({ skipRootUser: true });
```

## Переменные окружения для тестов

Устанавливаются автоматически в `setup.ts`:

- `TEST_DATABASE_URL` - URL тестовой БД (по умолчанию: `file::memory:?cache=shared`)
- `TEST_ROOT_EMAIL` - Email root пользователя для тестов (по умолчанию: `test-root@example.com`)
- `TEST_ROOT_PASSWORD` - Пароль root пользователя для тестов (по умолчанию: `TestRootPassword123!@#`)
- `NODE_ENV` - Устанавливается в `test`
- `JWT_ACCESS_SECRET` - Тестовый секрет (если не установлен)
- `JWT_REFRESH_SECRET` - Тестовый секрет (если не установлен)

## Запуск тестов

```bash
# Запуск всех тестов
npm test

# Запуск в watch режиме
npm run test:watch

# Запуск с coverage
npm run test:coverage
```

## Типичные ошибки

1. ❌ Использование dev/production БД для тестов
   ✅ Всегда использовать отдельную тестовую БД

2. ❌ Отсутствие очистки данных между тестами
   ✅ Использовать `resetDatabase` в `beforeEach`

3. ❌ Не закрытие соединений после тестов
   ✅ Всегда закрывать Prisma соединения в `afterAll`

4. ❌ Отсутствие применения миграций
   ✅ Применять миграции перед запуском тестов

5. ❌ Использование одного экземпляра Prisma для всех тестов
   ✅ Создавать отдельный экземпляр для каждого тестового файла

