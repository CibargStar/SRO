# Диагностика статуса WhatsApp Web

## Быстрая проверка статуса

### 1. Проверьте вкладку Application в DevTools

Откройте Chrome DevTools (если headless: false):
1. Нажмите F12
2. Перейдите в **Application** → **Service Workers**
3. Проверьте:
   - ✅ Должен быть зарегистрирован Service Worker для `https://web.whatsapp.com`
   - ✅ Статус должен быть **activated and running**
   - ❌ Если статус **stopped** или **error** - проблема с Service Workers

### 2. Проверьте вкладку Application → Cache Storage

1. В той же вкладке Application
2. Разверните **Cache Storage**
3. Должны быть кеши WhatsApp (например, `sw-cache-v1`)
4. Если кешей нет - CacheStorage все еще не работает

### 3. Проверьте вкладку Network

1. Перейдите в **Network**
2. Отфильтруйте по `WS` (WebSocket)
3. Должно быть WebSocket соединение к WhatsApp серверам
4. Статус должен быть **101 Switching Protocols** (зеленый)

### 4. Проверьте вкладку Console

Отфильтруйте ошибки:
- **Errors** (красные) - критичные
- **Warnings** (желтые) - некритичные

**Критичные ошибки для WhatsApp:**
- `Failed to execute 'open' on 'CacheStorage'` - CacheStorage не работает
- `Service Worker registration failed` - Service Worker не регистрируется
- `WebSocket connection failed` - нет связи с серверами WhatsApp
- `Failed to fetch` - сетевые проблемы

**Некритичные предупреждения (можно игнорировать):**
- `page-load-validation-missing-wam-incomplete-ws-timing` - метрики аналитики
- `Deprecated feature used` - устаревшие API
- `Unload event listeners are deprecated` - устаревшие события
- `Ignored @property rule` - CSS проблемы (косметические)

## Возможные проблемы и решения

### Проблема: Service Worker не регистрируется

**Симптомы:**
- В Application → Service Workers нет Service Worker для WhatsApp
- Ошибка в консоли: `Service Worker registration failed`

**Решение:**
```bash
# Убедитесь, что профиль запущен с новыми флагами
# Проверьте логи backend:
tail -f backend/logs/combined.log | grep "Chrome process launched"

# Должны быть флаги:
# --disable-web-security
# --enable-features=ServiceWorkerOnUI
```

### Проблема: CacheStorage не работает

**Симптомы:**
- Service Worker зарегистрирован, но в Cache Storage нет кешей
- Ошибка: `Failed to execute 'open' on 'CacheStorage'`

**Решение:**
```bash
# Удалите директорию профиля и создайте новый профиль:
rm -rf backend/profiles/{userId}/{profileId}/

# Создайте новый профиль с headless: false
```

### Проблема: WebSocket не подключается

**Симптомы:**
- В Network нет WebSocket соединений
- Или WebSocket с ошибкой (красный)

**Решение:**
Проверьте сетевые настройки:
- Нет ли блокировки файрволом?
- Есть ли доступ к интернету?
- Не используется ли прокси?

### Проблема: QR-код не появляется, но ошибок нет

**Симптомы:**
- Service Worker работает
- CacheStorage есть
- WebSocket подключен
- Но QR-кода нет

**Решение:**
Возможно, WhatsApp детектирует автоматизацию. Попробуйте:
1. Использовать `headless: false` (обязательно!)
2. Подождать дольше (до 2 минут)
3. Очистить cookies и попробовать снова

## Скриншоты для диагностики

Если проблема сохраняется, сделайте скриншоты:

1. **Console** (все ошибки и предупреждения)
2. **Network** (вкладка WS с WebSocket соединениями)
3. **Application → Service Workers** (список Service Workers)
4. **Application → Cache Storage** (список кешей)

И предоставьте их для анализа.

## Команды для сбора информации

```bash
# 1. Проверить, что backend перезапущен
ps aux | grep node

# 2. Проверить логи backend
tail -100 backend/logs/combined.log

# 3. Проверить директорию профиля
ls -la backend/profiles/{userId}/{profileId}/chrome-data/

# 4. Проверить, что профиль запущен
curl http://localhost:3000/api/profiles/{profileId}

# 5. Проверить статус аккаунта WhatsApp
curl http://localhost:3000/api/messenger-accounts/{accountId}
```

## Ожидаемое поведение при успешной загрузке

1. **Через 5-10 секунд после навигации на web.whatsapp.com:**
   - Service Worker регистрируется
   - CacheStorage создается
   - WebSocket соединение устанавливается

2. **Через 15-30 секунд:**
   - QR-код появляется на странице
   - Canvas с QR-кодом видим в DOM

3. **Каждые 20 секунд:**
   - QR-код обновляется (новый код)

Если это не происходит в течение 60 секунд - есть проблема.



