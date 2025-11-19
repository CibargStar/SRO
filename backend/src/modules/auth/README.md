# Модуль авторизации - Password Service

## Обзор

Сервис хеширования паролей использует **argon2id** - современный и безопасный алгоритм хеширования, рекомендованный OWASP.

## Использование

```typescript
import { hashPassword, verifyPassword } from './modules/auth';

// Хеширование пароля при создании пользователя
const passwordHash = await hashPassword('mySecurePassword123!');

// Сохранение в БД
await prisma.user.create({
  data: {
    email: 'user@example.com',
    passwordHash: passwordHash,
    // ...
  }
});

// Верификация пароля при входе
const user = await prisma.user.findUnique({ where: { email } });
if (user && await verifyPassword(password, user.passwordHash)) {
  // Пароль верный
}
```

## Параметры хеширования

- **Алгоритм**: argon2id (гибридный режим)
- **Memory Cost**: 64 MB
- **Time Cost**: 3 итерации
- **Parallelism**: 4 потока
- **Hash Length**: 32 байта (256 бит)

Время хеширования: ~200-500ms (зависит от системы)

## Безопасность

✅ Использует криптографически стойкий алгоритм  
✅ Автоматически генерирует уникальную соль  
✅ Асинхронное хеширование (не блокирует event loop)  
✅ Constant-time сравнение (защита от timing attacks)  
✅ Не логирует пароли или хеши  
✅ Параметры включены в хеш (для верификации)

## Миграция с других алгоритмов

Если в будущем понадобится сменить алгоритм:

1. Увеличить `passwordVersion` в модели User
2. При следующем входе пользователя перехешировать пароль новым алгоритмом
3. Обновить `passwordVersion` в БД

```typescript
// Пример миграции
if (user.passwordVersion < 2) {
  const newHash = await hashPassword(password); // Новый алгоритм
  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: newHash,
      passwordVersion: 2
    }
  });
}
```

