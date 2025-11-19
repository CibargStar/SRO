# Руководство по безопасности - Модуль авторизации

## Обзор

Этот документ описывает требования безопасности для модуля авторизации и типичные ошибки, которых нужно избегать при настройке переменных окружения.

## Переменные окружения

### Базовые переменные

- **NODE_ENV**: Режим работы (`development`, `production`, `test`)
- **PORT**: Порт сервера (положительное число)
- **DATABASE_URL**: URL подключения к базе данных
- **LOG_LEVEL**: Уровень логирования (`error`, `warn`, `info`, `debug`)

### Переменные авторизации

- **ROOT_EMAIL**: Email root-пользователя
- **ROOT_PASSWORD**: Пароль root-пользователя
- **JWT_ACCESS_SECRET**: Секретный ключ для Access токенов
- **JWT_REFRESH_SECRET**: Секретный ключ для Refresh токенов
- **JWT_ACCESS_EXPIRES_IN**: Время жизни Access токена
- **JWT_REFRESH_EXPIRES_IN**: Время жизни Refresh токена

## Типичные ошибки безопасности

### ❌ 1. Слабые JWT секреты

**Проблема:**
```env
JWT_ACCESS_SECRET=secret
JWT_REFRESH_SECRET=secret123
```

**Почему это плохо:**
- Слишком короткие секреты легко подобрать методом перебора
- Одинаковые секреты для Access и Refresh токенов - критическая уязвимость
- Простые слова уязвимы к dictionary attacks

**✅ Правильно:**
```env
# Генерируйте криптографически случайные секреты
# Linux/Mac:
JWT_ACCESS_SECRET=$(openssl rand -base64 32)
JWT_REFRESH_SECRET=$(openssl rand -base64 32)

# Windows PowerShell:
JWT_ACCESS_SECRET=[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Minimum 0 -Maximum 256 }))
```

**Требования:**
- Минимум 32 символа (рекомендация OWASP)
- Криптографически случайные значения
- Разные секреты для Access и Refresh токенов
- Минимум 8 уникальных символов (проверка энтропии)

---

### ❌ 2. Слабый пароль root-пользователя

**Проблема:**
```env
ROOT_PASSWORD=admin
ROOT_PASSWORD=123456
ROOT_PASSWORD=password
```

**Почему это плохо:**
- Легко подобрать методом перебора
- Root-пользователь имеет полный доступ к системе
- Компрометация root = компрометация всей системы

**✅ Правильно:**
```env
# Используйте сложный пароль с:
# - Минимум 12 символов
# - Заглавные и строчные буквы
# - Цифры
# - Специальные символы
ROOT_PASSWORD=MyS3cur3P@ssw0rd!2024
```

**Требования:**
- Минимум 12 символов
- Заглавные буквы (A-Z)
- Строчные буквы (a-z)
- Цифры (0-9)
- Специальные символы (!@#$%^&* и т.д.)

**Рекомендации:**
- Используйте менеджер паролей (1Password, Bitwarden, LastPass)
- Генерируйте уникальные пароли для каждого окружения
- Регулярно меняйте пароль в production

---

### ❌ 3. Слишком долгоживущие токены

**Проблема:**
```env
JWT_ACCESS_EXPIRES_IN=30d
JWT_REFRESH_EXPIRES_IN=365d
```

**Почему это плохо:**
- Долгоживущие Access токены увеличивают окно атаки при компрометации
- Если токен украден, злоумышленник имеет длительный доступ
- Сложнее отозвать доступ при увольнении сотрудника

**✅ Правильно:**
```env
# Access токен - короткоживущий (15 минут)
JWT_ACCESS_EXPIRES_IN=15m

# Refresh токен - долгоживущий, но разумный (7 дней)
JWT_REFRESH_EXPIRES_IN=7d
```

**Рекомендации:**
- **Access токен**: 15 минут - 1 час (максимум)
- **Refresh токен**: 7-30 дней (зависит от требований безопасности)
- Refresh токен должен быть значительно больше Access токена
- Используйте механизм отзыва Refresh токенов через БД

---

### ❌ 4. Хранение секретов в репозитории

**Проблема:**
```bash
# Коммит .env файла в Git
git add .env
git commit -m "Add environment variables"
```

**Почему это плохо:**
- Секреты попадают в историю Git (даже после удаления)
- Доступ к репозиторию = доступ к секретам
- Публичные репозитории раскрывают секреты всем

**✅ Правильно:**
```bash
# 1. Добавьте .env в .gitignore
echo ".env" >> .gitignore

# 2. Используйте .env.example для документации
# (без реальных секретов)

# 3. Используйте секреты через:
# - Переменные окружения в CI/CD
# - Secret managers (AWS Secrets Manager, HashiCorp Vault)
# - Docker secrets
# - Kubernetes secrets
```

**Проверка:**
```bash
# Проверьте, что .env не в репозитории
git check-ignore .env

# Если нужно удалить уже закоммиченный .env:
git rm --cached .env
git commit -m "Remove .env from repository"
```

---

### ❌ 5. Использование одинаковых секретов в разных окружениях

**Проблема:**
```env
# development/.env
JWT_ACCESS_SECRET=my-secret-key

# production/.env
JWT_ACCESS_SECRET=my-secret-key  # ТОТ ЖЕ СЕКРЕТ!
```

**Почему это плохо:**
- Компрометация development окружения = компрометация production
- Разработчики имеют доступ к production секретам
- Невозможно безопасно тестировать

**✅ Правильно:**
```env
# development/.env
JWT_ACCESS_SECRET=dev-secret-key-unique-32-chars-min

# production/.env
JWT_ACCESS_SECRET=prod-secret-key-completely-different-32-chars
```

**Рекомендации:**
- Уникальные секреты для каждого окружения
- Разные пароли root-пользователя для dev/staging/prod
- Используйте секреты из secure vault в production

---

### ❌ 6. Невалидный email root-пользователя

**Проблема:**
```env
ROOT_EMAIL=admin
ROOT_EMAIL=not-an-email
ROOT_EMAIL=admin@
```

**Почему это плохо:**
- Невозможно восстановить доступ при потере пароля
- Невозможно получать уведомления о безопасности
- Проблемы с валидацией и логированием

**✅ Правильно:**
```env
ROOT_EMAIL=admin@yourcompany.com
ROOT_EMAIL=security@yourdomain.org
```

**Требования:**
- Валидный формат email (RFC 5322)
- Используйте корпоративный email
- Убедитесь, что email доступен и мониторится

---

### ❌ 7. Отсутствие валидации переменных окружения

**Проблема:**
```typescript
// Плохо: нет валидации
const secret = process.env.JWT_SECRET || 'default-secret';
```

**Почему это плохо:**
- Использование дефолтных значений в production
- Нет проверки на слабые секреты
- Ошибки обнаруживаются только в runtime

**✅ Правильно:**
```typescript
// Хорошо: валидация через Zod
const envSchema = z.object({
  JWT_ACCESS_SECRET: z.string().min(32),
  // ...
});
export const env = envSchema.parse(process.env);
```

**Преимущества:**
- Ошибки обнаруживаются при запуске приложения
- Типобезопасность
- Четкие сообщения об ошибках
- Невозможно запустить приложение с невалидными секретами

---

## Best Practices

### 1. Генерация секретов

**Linux/Mac:**
```bash
# Генерация JWT секрета (32 байта, base64)
openssl rand -base64 32

# Генерация более длинного секрета (64 байта)
openssl rand -base64 64
```

**Windows PowerShell:**
```powershell
# Генерация случайного секрета
-join ((48..57) + (65..90) + (97..122) | Get-Random -Count 32 | ForEach-Object {[char]$_})

# Или через .NET
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Minimum 0 -Maximum 256 }))
```

**Node.js:**
```javascript
const crypto = require('crypto');
const secret = crypto.randomBytes(32).toString('base64');
console.log(secret);
```

### 2. Ротация секретов

- Регулярно меняйте JWT секреты (каждые 90 дней)
- При компрометации - немедленная ротация
- Используйте версионирование токенов для плавной миграции

### 3. Мониторинг

- Логируйте все попытки входа (успешные и неудачные)
- Мониторьте подозрительную активность
- Настройте алерты на множественные неудачные попытки входа

### 4. Защита от brute force

- Rate limiting для `/auth/login` (5 попыток/15 минут)
- Блокировка IP после 10 неудачных попыток
- CAPTCHA после нескольких неудачных попыток (опционально)

### 5. Хранение паролей

- **Никогда** не храните пароли в открытом виде
- Используйте bcrypt с cost factor 12+
- Не логируйте пароли (даже хешированные)

### 6. Проверка безопасности перед деплоем

```bash
# Проверьте, что все секреты установлены
npm run type-check  # Проверит валидацию env

# Проверьте .gitignore
git check-ignore .env

# Проверьте, что нет секретов в коде
grep -r "password" --include="*.ts" --include="*.js" src/
```

---

## Чеклист безопасности

Перед деплоем в production убедитесь:

- [ ] Все JWT секреты минимум 32 символа
- [ ] JWT_ACCESS_SECRET ≠ JWT_REFRESH_SECRET
- [ ] ROOT_PASSWORD соответствует требованиям сложности
- [ ] ROOT_EMAIL - валидный email адрес
- [ ] JWT_ACCESS_EXPIRES_IN ≤ 1 часа
- [ ] JWT_REFRESH_EXPIRES_IN > JWT_ACCESS_EXPIRES_IN
- [ ] .env файл в .gitignore
- [ ] Нет секретов в коде или истории Git
- [ ] Уникальные секреты для каждого окружения
- [ ] Настроен rate limiting для auth endpoints
- [ ] Логирование попыток входа включено
- [ ] Пароли хешируются через bcrypt

---

## Дополнительные ресурсы

- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [OWASP JWT Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/JSON_Web_Token_for_Java_Cheat_Sheet.html)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)

---

## Контакты

При обнаружении уязвимостей безопасности, пожалуйста, сообщите об этом ответственным за безопасность.

