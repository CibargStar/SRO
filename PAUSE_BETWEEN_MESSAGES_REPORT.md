# Отчет: Механизм паузы между отправкой сообщений

## Обзор

Система использует многоуровневую систему пауз для контроля скорости отправки сообщений в кампаниях. Паузы применяются на разных этапах процесса отправки для имитации естественного поведения и предотвращения блокировок.

---

## 1. Глобальные настройки пауз

### Хранение настроек
Настройки хранятся в таблице `CampaignGlobalSettings` (singleton - одна запись на всю систему).

**Файл:** `backend/prisma/schema.prisma` (строки 789-836)

### Параметры пауз:

| Параметр | Тип | Значение по умолчанию | Описание |
|----------|-----|----------------------|----------|
| `pauseMode` | `Int` | `2` | Режим паузы: `1` = между номерами, `2` = между клиентами |
| `minDelayBetweenMessagesMs` | `Int` | `3000` (3 сек) | Минимальная задержка между сообщениями |
| `maxDelayBetweenMessagesMs` | `Int` | `10000` (10 сек) | Максимальная задержка между сообщениями |
| `minDelayBetweenContactsMs` | `Int` | `30000` (30 сек) | Минимальная задержка между контактами |
| `maxDelayBetweenContactsMs` | `Int` | `120000` (2 мин) | Максимальная задержка между контактами |

### Дополнительные параметры:

| Параметр | Тип | Значение по умолчанию | Описание |
|----------|-----|----------------------|----------|
| `typingSimulationEnabled` | `Boolean` | `true` | Включена ли симуляция набора текста |
| `typingSpeedCharsPerSec` | `Int` | `50` | Скорость набора (символов в секунду) |

---

## 2. Архитектура применения пауз

### 2.1. Инициализация настроек

**Файл:** `backend/src/modules/campaigns/executor/campaign-executor.service.ts` (строки 231-246)

При запуске кампании настройки загружаются из базы данных и передаются в `ProfileWorker`:

```typescript
const settings = await this.settingsRepository.getOrCreate();
const pauseMode: 1 | 2 = settings.pauseMode === 2 ? 2 : 1;
const delayBetweenMessagesMs = settings.minDelayBetweenMessagesMs && settings.maxDelayBetweenMessagesMs
  ? { minMs: settings.minDelayBetweenMessagesMs, maxMs: settings.maxDelayBetweenMessagesMs }
  : undefined;
const delayBetweenContactsMs = settings.minDelayBetweenContactsMs && settings.maxDelayBetweenContactsMs
  ? { minMs: settings.minDelayBetweenContactsMs, maxMs: settings.maxDelayBetweenContactsMs }
  : undefined;
```

---

## 3. Уровни применения пауз

### 3.1. Уровень 1: Задержка перед отправкой сообщения

**Файл:** `backend/src/modules/campaigns/message-sender/message-sender.service.ts` (строки 58-62)

**Когда применяется:** Перед отправкой каждого сообщения через мессенджер.

**Логика:**
```typescript
// Задержка перед отправкой (анти-спам тайминги)
// Пропускаем задержку если skipSendDelay=true (для второго мессенджера в режиме BOTH)
if (input.sendDelayRange && !input.skipSendDelay) {
  await this.delay(this.getRandomDelay(input.sendDelayRange.minMs, input.sendDelayRange.maxMs));
}
```

**Параметры:**
- Использует `sendDelayRange` (minMs, maxMs) из настроек
- Случайная задержка в диапазоне `[minDelayBetweenMessagesMs, maxDelayBetweenMessagesMs]`
- **Исключение:** В режиме `BOTH` для второго мессенджера задержка пропускается (`skipSendDelay=true`)

**Пример:** При настройках 3000-10000 мс будет случайная задержка от 3 до 10 секунд.

---

### 3.2. Уровень 2: Симуляция набора текста

**Файл:** `backend/src/modules/campaigns/message-sender/message-sender.service.ts` (строки 64-67)

**Когда применяется:** После задержки перед отправкой, если включена симуляция набора.

**Логика:**
```typescript
// Симуляция набора
if (input.simulateTyping && input.typingDelayRange) {
  await this.simulateTyping(input.typingDelayRange.minMs, input.typingDelayRange.maxMs);
}
```

**Параметры:**
- `typingDelayRange` вычисляется на основе `typingSpeedCharsPerSec`:
  ```typescript
  minMs: Math.max(300, Math.floor((1 / settings.typingSpeedCharsPerSec) * 500))
  maxMs: Math.max(600, Math.floor((1 / settings.typingSpeedCharsPerSec) * 1200))
  ```
- При скорости 50 символов/сек: minMs ≈ 10 мс, maxMs ≈ 24 мс (но минимум 300/600 мс)

---

### 3.3. Уровень 3: Задержка между элементами шаблона

**Файл:** `backend/src/modules/campaigns/profile-worker/profile-worker.ts` (строки 198-201)

**Когда применяется:** Между отправкой элементов шаблона (TEXT/FILE) для одного сообщения.

**Логика:**
```typescript
// Небольшая задержка между элементами (кроме последнего)
if (i < processedItems.length - 1) {
  await this.delay(500);
}
```

**Параметры:**
- Фиксированная задержка: **500 мс** (0.5 секунды)
- Применяется только между элементами, не после последнего

**Пример:** Если шаблон содержит 3 элемента (TEXT, FILE, TEXT), будет 2 задержки по 500 мс между ними.

---

### 3.4. Уровень 4: Задержка между сообщениями

**Файл:** `backend/src/modules/campaigns/profile-worker/profile-worker.ts` (строки 239-240, 466-472)

**Когда применяется:** После обработки каждого сообщения (независимо от результата).

**Логика:**
```typescript
// Межсообщенческий тайминг
await this.applyMessageDelay();
```

**Реализация:**
```typescript
private async applyMessageDelay(): Promise<void> {
  if (!this.delayBetweenMessagesMs) {
    return;
  }
  const delayMs = this.randomInRange(this.delayBetweenMessagesMs.minMs, this.delayBetweenMessagesMs.maxMs);
  await this.delay(delayMs);
}
```

**Параметры:**
- Случайная задержка в диапазоне `[minDelayBetweenMessagesMs, maxDelayBetweenMessagesMs]`
- По умолчанию: **3000-10000 мс** (3-10 секунд)

**Важно:** Эта задержка применяется **после каждого сообщения**, даже если оно завершилось ошибкой.

---

### 3.5. Уровень 5: Задержка между контактами

**Файл:** `backend/src/modules/campaigns/profile-worker/profile-worker.ts` (строки 242-252, 474-480)

**Когда применяется:** После успешной отправки сообщения, в зависимости от `pauseMode`.

**Логика:**
```typescript
// Пауза между контактами согласно режиму (только при успешной отправке)
if (result.status === 'SENT') {
  if (this.pauseMode === 1) {
    // Режим 1: пауза между каждым номером
    await this.applyContactDelay();
  } else if (this.pauseMode === 2) {
    // Режим 2: пауза только при смене клиента
    if (this.lastClientId === null || this.lastClientId !== clientId) {
      await this.applyContactDelay();
    }
  }
  this.lastClientId = clientId;
}
```

**Реализация:**
```typescript
private async applyContactDelay(): Promise<void> {
  if (!this.delayBetweenContactsMs) {
    return;
  }
  const delayMs = this.randomInRange(this.delayBetweenContactsMs.minMs, this.delayBetweenContactsMs.maxMs);
  await this.delay(delayMs);
}
```

**Режимы:**

#### Режим 1 (`pauseMode = 1`): Пауза между номерами
- Пауза применяется **после каждого успешного сообщения**
- Независимо от того, один это клиент или разные
- **Использование:** Когда нужно делать паузу между каждым номером телефона

#### Режим 2 (`pauseMode = 2`): Пауза между клиентами (по умолчанию)
- Пауза применяется **только при смене клиента**
- Если `lastClientId !== clientId`, применяется пауза
- Если тот же клиент (но другой номер), пауза не применяется
- **Использование:** Когда у одного клиента может быть несколько номеров, и нужно делать паузу только между разными клиентами

**Параметры:**
- Случайная задержка в диапазоне `[minDelayBetweenContactsMs, maxDelayBetweenContactsMs]`
- По умолчанию: **30000-120000 мс** (30 секунд - 2 минуты)

**Важно:** Пауза применяется **только при успешной отправке** (`status === 'SENT'`).

---

## 4. Специальные случаи

### 4.1. Режим BOTH (отправка в оба мессенджера)

**Файл:** `backend/src/modules/campaigns/profile-worker/profile-worker.ts` (строки 368-376)

**Особенность:** При отправке в оба мессенджера (WhatsApp + Telegram) для одного контакта:
- Первый мессенджер: применяется задержка `sendDelayRange`
- Второй мессенджер: задержка **пропускается** (`skipSendDelay=true`)

**Логика:**
```typescript
if (this.universalTarget === 'BOTH') {
  // В режиме BOTH отправляем в оба мессенджера БЕЗ паузы между ними
  // Пауза должна быть только между контактами, а не между мессенджерами для одного контакта
  if (hasWa) {
    await trySend('WHATSAPP', false); // Первый мессенджер - с задержкой
  }
  if (hasTg) {
    await trySend('TELEGRAM', true); // Второй мессенджер - БЕЗ задержки
  }
}
```

**Причина:** Пауза должна быть между контактами, а не между мессенджерами для одного контакта.

---

### 4.2. Режимы с fallback (WHATSAPP_FIRST, TELEGRAM_FIRST)

**Файл:** `backend/src/modules/campaigns/profile-worker/profile-worker.ts` (строки 377-414)

**Особенность:** При fallback-режимах (если первый мессенджер не сработал):
- Оба мессенджера используют задержку (`skipSendDelay=false`)
- Это разные попытки для одного контакта, поэтому задержка нужна для обеих

---

## 5. Последовательность применения пауз

### Пример: Отправка сообщения с шаблоном из 2 элементов (TEXT + FILE)

```
1. [Задержка перед отправкой] ← delayBetweenMessagesMs (3-10 сек, случайно)
   ↓
2. [Симуляция набора] ← typingDelayRange (если включена)
   ↓
3. [Отправка первого элемента] (TEXT)
   ↓
4. [Задержка между элементами] ← 500 мс (фиксированная)
   ↓
5. [Задержка перед отправкой] ← delayBetweenMessagesMs (3-10 сек, случайно)
   ↓
6. [Симуляция набора] ← typingDelayRange (если включена)
   ↓
7. [Отправка второго элемента] (FILE)
   ↓
8. [Задержка между сообщениями] ← delayBetweenMessagesMs (3-10 сек, случайно)
   ↓
9. [Задержка между контактами] ← delayBetweenContactsMs (30 сек - 2 мин, случайно)
   (только если status === 'SENT' и выполняется условие pauseMode)
```

---

## 6. Генерация случайных задержек

**Файл:** `backend/src/modules/campaigns/profile-worker/profile-worker.ts` (строки 482-493)

**Метод:**
```typescript
private randomInRange(min: number, max: number): number {
  const safeMin = Math.max(0, min);
  const safeMax = Math.max(safeMin, max);
  return Math.floor(Math.random() * (safeMax - safeMin + 1)) + safeMin;
}

private async delay(ms: number): Promise<void> {
  if (ms <= 0) {
    return;
  }
  await new Promise((resolve) => setTimeout(resolve, ms));
}
```

**Особенности:**
- Защита от отрицательных значений
- Округление до целого числа (миллисекунды)
- Включительно: `[min, max]` (включая оба конца)

---

## 7. Управление настройками

### 7.1. Получение настроек

**Файл:** `backend/src/modules/campaign-settings/campaign-settings.service.ts` (строки 69-72)

```typescript
async getGlobalSettings(): Promise<CampaignGlobalSettingsFormatted>
```

### 7.2. Обновление настроек

**Файл:** `backend/src/modules/campaign-settings/campaign-settings.service.ts` (строки 80-240)

```typescript
async updateGlobalSettings(
  input: UpdateGlobalSettingsInput,
  updatedBy: string
): Promise<CampaignGlobalSettingsFormatted>
```

**Валидация:**
- `pauseMode`: только 1 или 2
- Все задержки: неотрицательные числа
- `typingSpeedCharsPerSec`: минимум 1

**Доступ:** Только для ROOT пользователя.

---

## 8. Итоговая схема пауз

```
┌─────────────────────────────────────────────────────────────┐
│                    ОТПРАВКА СООБЩЕНИЯ                        │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
        ┌───────────────────────────────────┐
        │  Задержка перед отправкой         │
        │  (delayBetweenMessagesMs)         │
        │  3-10 сек (случайно)              │
        └───────────────────────────────────┘
                            │
                            ▼
        ┌───────────────────────────────────┐
        │  Симуляция набора                 │
        │  (typingDelayRange)                │
        │  ~300-600 мс (если включена)      │
        └───────────────────────────────────┘
                            │
                            ▼
        ┌───────────────────────────────────┐
        │  Отправка элемента шаблона        │
        └───────────────────────────────────┘
                            │
                            ▼
        ┌───────────────────────────────────┐
        │  Задержка между элементами         │
        │  500 мс (фиксированная)           │
        │  (если не последний элемент)       │
        └───────────────────────────────────┘
                            │
                            ▼
        ┌───────────────────────────────────┐
        │  Повтор для следующего элемента    │
        │  или завершение                   │
        └───────────────────────────────────┘
                            │
                            ▼
        ┌───────────────────────────────────┐
        │  Задержка между сообщениями       │
        │  (delayBetweenMessagesMs)         │
        │  3-10 сек (случайно)              │
        │  (всегда, даже при ошибке)        │
        └───────────────────────────────────┘
                            │
                            ▼
        ┌───────────────────────────────────┐
        │  Задержка между контактами         │
        │  (delayBetweenContactsMs)          │
        │  30 сек - 2 мин (случайно)        │
        │  (только если SENT)                │
        │  (зависит от pauseMode)            │
        └───────────────────────────────────┘
```

---

## 9. Важные замечания

1. **Пауза между сообщениями применяется всегда** (даже при ошибке), чтобы не перегружать систему.

2. **Пауза между контактами применяется только при успешной отправке** (`status === 'SENT'`).

3. **В режиме BOTH** для второго мессенджера задержка перед отправкой пропускается, чтобы не делать двойную паузу для одного контакта.

4. **Режим паузы влияет только на задержку между контактами**, не на задержку между сообщениями.

5. **Все задержки случайные** в заданном диапазоне для имитации естественного поведения.

6. **Настройки применяются глобально** для всех кампаний (singleton в базе данных).

---

## 10. Файлы, связанные с паузами

| Файл | Описание |
|------|----------|
| `backend/prisma/schema.prisma` | Схема БД с настройками пауз |
| `backend/src/modules/campaign-settings/campaign-settings.service.ts` | Управление глобальными настройками |
| `backend/src/modules/campaigns/executor/campaign-executor.service.ts` | Инициализация настроек при запуске кампании |
| `backend/src/modules/campaigns/profile-worker/profile-worker.ts` | Основная логика применения пауз |
| `backend/src/modules/campaigns/message-sender/message-sender.service.ts` | Задержка перед отправкой и симуляция набора |

---

## Заключение

Система пауз реализована на нескольких уровнях для контроля скорости отправки и имитации естественного поведения. Основные параметры настраиваются глобально через `CampaignGlobalSettings` и применяются ко всем кампаниям. Режим паузы (`pauseMode`) определяет, когда именно применяется задержка между контактами: после каждого номера (режим 1) или только при смене клиента (режим 2).



