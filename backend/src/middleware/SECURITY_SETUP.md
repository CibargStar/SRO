# Настройка Security Middleware

## Обзор

Security middleware включает:
- **Helmet** - защита HTTP заголовков
- **CORS** - настройка Cross-Origin Resource Sharing
- **Rate Limiting** - защита от brute force и DDoS атак

## Переменные окружения

### FRONTEND_URL

**Обязательно добавить в `.env`:**

```env
# URL фронтенд приложения для CORS
# Development: http://localhost:5173
# Production: https://yourdomain.com
FRONTEND_URL=http://localhost:5173
```

**Валидация:**
- Должен быть валидным URL
- По умолчанию: `http://localhost:5173` (для development)

## Использование

### В главном файле приложения (src/index.ts)

```typescript
import { corsMiddleware, securityMiddleware, rateLimiter } from './middleware';

// Порядок важен!
app.use(corsMiddleware);        // 1. CORS (первым для preflight)
app.use(requestLogger);         // 2. Логирование
app.use(securityMiddleware);    // 3. Helmet
app.use(rateLimiter);          // 4. Глобальный rate limit
```

### Для маршрута /auth/login

```typescript
import { authRateLimiter } from './middleware';

router.post('/auth/login', authRateLimiter, loginHandler);
```

## Настройки

### Helmet

- ✅ Content Security Policy (CSP)
- ✅ X-Frame-Options (защита от clickjacking)
- ✅ X-Content-Type-Options (защита от MIME sniffing)
- ✅ HSTS (HTTP Strict Transport Security)
- ✅ И другие заголовки безопасности

### CORS

- ✅ Разрешен только конкретный origin (из FRONTEND_URL)
- ✅ Credentials разрешены (для httpOnly cookies)
- ✅ Preflight запросы обрабатываются (maxAge: 24 часа)

### Rate Limiting

**Глобальный (rateLimiter):**
- 100 запросов / 15 минут с одного IP

**Для /auth/login (authRateLimiter):**
- 5 попыток / 15 минут с одного IP
- Не считает успешные попытки входа

## Типичные ошибки

### ❌ CORS с origin: '*' и credentials: true

**Проблема:**
```typescript
cors({
  origin: '*',
  credentials: true, // ❌ ОПАСНО!
});
```

**Почему плохо:**
- Любой сайт может делать запросы с credentials
- Утечка cookies и авторизационных данных

**✅ Правильно:**
```typescript
cors({
  origin: 'http://localhost:5173', // Конкретный origin
  credentials: true, // ✅ Безопасно для конкретного origin
});
```

### ❌ Отключенный Helmet

**Проблема:**
```typescript
// ❌ Нет Helmet - уязвимо к XSS, clickjacking и т.д.
```

**✅ Правильно:**
```typescript
app.use(helmet()); // ✅ Всегда использовать
```

### ❌ Отсутствие rate limiting для /auth/login

**Проблема:**
```typescript
// ❌ Только глобальный rate limit - недостаточно для защиты от brute force
router.post('/auth/login', loginHandler);
```

**✅ Правильно:**
```typescript
router.post('/auth/login', authRateLimiter, loginHandler); // ✅ Строгий лимит
```

### ❌ Слишком мягкий rate limit

**Проблема:**
```typescript
rateLimit({
  max: 100, // ❌ Слишком много для login
  windowMs: 15 * 60 * 1000,
});
```

**✅ Правильно:**
```typescript
rateLimit({
  max: 5, // ✅ Строгий лимит для login
  windowMs: 15 * 60 * 1000,
});
```

### ❌ CORS с origin: '*' в production

**Проблема:**
```typescript
cors({
  origin: '*', // ❌ ОПАСНО в production!
});
```

**✅ Правильно:**
```typescript
cors({
  origin: process.env.FRONTEND_URL, // ✅ Конкретный origin
});
```

## Проверка

После настройки проверьте:

1. ✅ Helmet установлен и работает
2. ✅ CORS настроен для конкретного origin
3. ✅ Rate limiting работает для всех маршрутов
4. ✅ Строгий rate limiting для /auth/login
5. ✅ FRONTEND_URL добавлен в .env

## Тестирование

### Проверка CORS

```bash
curl -H "Origin: http://localhost:5173" \
     -H "Access-Control-Request-Method: POST" \
     -H "Access-Control-Request-Headers: Content-Type" \
     -X OPTIONS \
     http://localhost:3000/api/auth/login
```

Должен вернуть заголовки:
- `Access-Control-Allow-Origin: http://localhost:5173`
- `Access-Control-Allow-Credentials: true`

### Проверка Rate Limiting

```bash
# Множественные запросы к /auth/login
for i in {1..6}; do
  curl -X POST http://localhost:3000/api/auth/login
done
```

После 5 запросов должен вернуть 429 Too Many Requests.

