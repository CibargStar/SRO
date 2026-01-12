# Объяснение разницы между глобальными настройками и настройками кампании для рабочих часов

## 📋 Обзор

В системе есть два уровня настроек рабочих часов:

1. **Глобальные настройки (ROOT)** - `CampaignGlobalSettings`
   - Настраиваются администратором (ROOT пользователем)
   - Используются как значения по умолчанию для всех кампаний
   - Хранятся в таблице `CampaignGlobalSettings`

2. **Настройки кампании** - `ScheduleConfig` в поле `campaign.scheduleConfig`
   - Настраиваются при создании/редактировании конкретной кампании
   - Переопределяют глобальные настройки для этой кампании
   - Хранятся в JSON поле `scheduleConfig` таблицы `Campaign`

---

## 🔍 Детальное объяснение

### Глобальные настройки (ROOT)

**Где настраиваются:**
- Админ-панель: `/api/admin/campaigns/settings` (PUT)
- Доступ: только ROOT пользователь

**Поля:**
```typescript
{
  defaultWorkHoursStart: "09:00",  // Формат HH:mm
  defaultWorkHoursEnd: "21:00",     // Формат HH:mm
  defaultWorkDays: [1, 2, 3, 4, 5]  // Массив чисел 1-7 (Пн-Вс)
}
```

**Назначение:**
- Значения по умолчанию для всех новых кампаний
- Используются, если в кампании не заданы свои настройки
- Применяются ко всем кампаниям, у которых `workHoursEnabled=false` или не заданы `workHoursStart/workHoursEnd`

---

### Настройки кампании

**Где настраиваются:**
- При создании кампании: `POST /api/campaigns` (в `scheduleConfig`)
- При редактировании: `PATCH /api/campaigns/:id` (в `scheduleConfig`)
- Доступ: все пользователи для своих кампаний

**Поля:**
```typescript
{
  workHoursEnabled: boolean,        // Включить/выключить рабочие часы для этой кампании
  workHoursStart?: "09:00",         // Формат HH:mm (опционально)
  workHoursEnd?: "21:00",           // Формат HH:mm (опционально)
  workDaysEnabled: boolean,          // Включить/выключить рабочие дни для этой кампании
  workDays?: [1, 2, 3, 4, 5],       // Массив 0-6 (Вс-Сб) (опционально)
  timezone?: "Europe/Moscow"        // Таймзона для этой кампании
}
```

**Назначение:**
- Индивидуальные настройки для конкретной кампании
- Переопределяют глобальные настройки
- Позволяют настроить разные рабочие часы для разных кампаний

---

## ⚙️ Логика применения (приоритет)

Логика в `CampaignSchedulerService.isWithinWorkHours()`:

```typescript
// 1. Сначала проверяем настройки кампании
const workHoursStart =
  scheduleConfig?.workHoursStart ??                    // Если задано в кампании - используем
  this.parseHour(globalSettings?.defaultWorkHoursStart ?? '09:00'); // Иначе глобальные, иначе дефолт

const workHoursEnd =
  scheduleConfig?.workHoursEnd ??                      // Если задано в кампании - используем
  this.parseHour(globalSettings?.defaultWorkHoursEnd ?? '21:00');     // Иначе глобальные, иначе дефолт

const workDays =
  scheduleConfig?.workDays ??                          // Если задано в кампании - используем
  globalSettings?.defaultWorkDays ??                   // Иначе глобальные
  [1, 2, 3, 4, 5];                                     // Иначе дефолт (Пн-Пт)
```

**Приоритет:**
1. **Настройки кампании** (если заданы) - высший приоритет
2. **Глобальные настройки** (если не заданы в кампании) - средний приоритет
3. **Значения по умолчанию** (если ничего не задано) - низший приоритет

---

## ⚠️ ПРОБЛЕМА: Флаги `workHoursEnabled` и `workDaysEnabled` не используются!

**Текущая ситуация:**
- В схеме `scheduleConfigSchema` есть флаги `workHoursEnabled` и `workDaysEnabled`
- Эти флаги сохраняются в БД
- **НО** в логике `isWithinWorkHours()` эти флаги **НЕ ПРОВЕРЯЮТСЯ**!

**Последствия:**
- Если `workHoursEnabled=false`, но заданы `workHoursStart` и `workHoursEnd`, они все равно применяются
- Если `workDaysEnabled=false`, но заданы `workDays`, они все равно применяются
- Нет способа полностью отключить рабочие часы для кампании

**Ожидаемое поведение:**
- Если `workHoursEnabled=false` → рабочие часы не проверяются (всегда `true`)
- Если `workDaysEnabled=false` → рабочие дни не проверяются (всегда `true`)
- Если оба `false` → кампания работает 24/7

---

## 🔧 Рекомендация по исправлению

Нужно обновить метод `isWithinWorkHours()`:

```typescript
isWithinWorkHours(
  scheduleConfig: ScheduleConfig | null,
  date: Date,
  globalSettings?: GlobalSettings | null
): boolean {
  // Если рабочие часы отключены в кампании - всегда разрешаем
  if (scheduleConfig?.workHoursEnabled === false) {
    return true;
  }

  // Если рабочие дни отключены в кампании - всегда разрешаем
  if (scheduleConfig?.workDaysEnabled === false) {
    return true;
  }

  const timezone = scheduleConfig?.timezone ?? 'UTC';

  // Применяем рабочие часы только если они включены
  if (scheduleConfig?.workHoursEnabled === true) {
    const workHoursStart = scheduleConfig?.workHoursStart 
      ? this.parseHour(scheduleConfig.workHoursStart)
      : this.parseHour(globalSettings?.defaultWorkHoursStart ?? '09:00');
    const workHoursEnd = scheduleConfig?.workHoursEnd
      ? this.parseHour(scheduleConfig.workHoursEnd)
      : this.parseHour(globalSettings?.defaultWorkHoursEnd ?? '21:00');

    const localTime = this.getLocalTime(date, timezone);
    const currentHour = localTime.getHours();

    if (currentHour < workHoursStart || currentHour >= workHoursEnd) {
      return false;
    }
  }

  // Применяем рабочие дни только если они включены
  if (scheduleConfig?.workDaysEnabled === true) {
    const workDays = scheduleConfig?.workDays 
      ?? globalSettings?.defaultWorkDays 
      ?? [1, 2, 3, 4, 5];

    const localTime = this.getLocalTime(date, timezone);
    const currentDay = localTime.getDay();

    if (!workDays.includes(currentDay)) {
      return false;
    }
  }

  return true;
}
```

---

## 📊 Сравнительная таблица

| Параметр | Глобальные настройки | Настройки кампании |
|----------|---------------------|-------------------|
| **Где настраиваются** | Админ-панель (ROOT) | При создании/редактировании кампании |
| **Кто настраивает** | ROOT пользователь | Владелец кампании |
| **Применение** | Ко всем кампаниям (если не переопределено) | Только к конкретной кампании |
| **Формат времени** | `"HH:mm"` (строка) | `"HH:mm"` (строка) |
| **Формат дней** | `[1,2,3,4,5]` (1-7, Пн-Вс) | `[0,1,2,3,4,5,6]` (0-6, Вс-Сб) |
| **Флаги включения** | Нет (всегда применяются как дефолт) | `workHoursEnabled`, `workDaysEnabled` |
| **Приоритет** | Низкий (fallback) | Высокий (переопределяет) |

---

## 🎯 Итог

**Разница:**
- **Глобальные настройки** = значения по умолчанию для всех кампаний
- **Настройки кампании** = индивидуальные настройки, переопределяющие глобальные

**Текущая проблема:**
- Флаги `workHoursEnabled` и `workDaysEnabled` не учитываются в логике
- Нет способа полностью отключить рабочие часы для кампании

**Рекомендация:**
- Исправить метод `isWithinWorkHours()` для учета флагов `workHoursEnabled` и `workDaysEnabled`







