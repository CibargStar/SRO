# План реализации модуля автозагрузки клиентской базы

## Понимание требований

### Входные данные
- **Формат файлов**: XLSX, XLS, CSV (Excel и подобные форматы)
- **Обязательные колонки**:
  1. `name` - Полное ФИО (например: "Никита Путилин Михайлович")
  2. `phone` - Номера телефонов (может быть несколько, разделены запятой/пробелом)
  3. `region` - Название региона (без ID, только текст)

### Бизнес-логика

#### 1. Парсинг ФИО
- **Формат**: "Фамилия Имя Отчество" (3 слова)
- **Исключения**: 4-е слово типа "Оглы" (сын) - **опускается**
- **Обработка пустых значений**: Если ФИО отсутствует - клиент создается без имени (null для всех полей)
- **Результат**: Разделение на `lastName`, `firstName`, `middleName`

#### 2. Парсинг телефонов
- **Множественные номера**: Могут быть через запятую или пробел
- **Форматы**: 
  - Российские: `+7`, `8`, `7` (разные варианты)
  - Международные: другие страны
- **Валидация**: Проверка корректности формата через библиотеку
- **Нормализация**: Приведение к единому формату для хранения

#### 3. Обработка регионов
- **Логика**: 
  - Если региона нет в БД → создаем новый регион → получаем ID
  - Если регион есть → используем существующий ID
- **Важно**: Не создавать дубликаты регионов

#### 4. Умная дедупликация при обновлении базы
- **Сценарий 1**: Контакт уникальный (новый номер + новое ФИО) → **создаем новый клиент**
- **Сценарий 2**: Найден по номеру, но в старой версии не было ФИО → **обновляем, добавляем ФИО**
- **Сценарий 3**: Найден по номеру, появился новый номер → **добавляем новый номер к существующим**
- **Сценарий 4**: Полное совпадение (номер + ФИО) → **пропускаем (не дублируем)**

---

## Архитектура модуля

### Структура директорий
```
backend/src/modules/import/
├── parsers/
│   ├── excel.parser.ts          # Парсинг Excel файлов
│   ├── name.parser.ts           # Парсинг ФИО
│   └── phone.parser.ts          # Парсинг и валидация телефонов
├── processors/
│   ├── region.processor.ts      # Обработка регионов (создание/поиск)
│   ├── deduplication.processor.ts # Логика дедупликации
│   └── client.processor.ts     # Создание/обновление клиентов
├── services/
│   └── import.service.ts        # Основной сервис импорта (координация)
├── schemas/
│   └── import.schemas.ts        # Zod схемы валидации
├── import.controller.ts         # HTTP контроллер
├── import.routes.ts             # Express роуты
└── types.ts                     # TypeScript типы
```

### Зависимости между компонентами

```
import.controller.ts
    ↓
import.service.ts (координация)
    ↓
    ├── excel.parser.ts (чтение файла)
    │   └── name.parser.ts (парсинг ФИО)
    │   └── phone.parser.ts (парсинг телефонов)
    │
    ├── region.processor.ts (обработка регионов)
    │
    ├── deduplication.processor.ts (поиск дубликатов)
    │
    └── client.processor.ts (создание/обновление)
```

---

## Детальный план реализации

### Этап 1: Подготовка инфраструктуры

#### 1.1 Установка зависимостей
```bash
npm install multer @types/multer
npm install xlsx
npm install libphonenumber-js
```

**Обоснование**:
- `multer` - стандартный middleware для загрузки файлов в Express
- `xlsx` - легковесная библиотека для парсинга Excel (поддерживает XLSX, XLS, CSV)
- `libphonenumber-js` - профессиональная валидация и нормализация телефонов

#### 1.2 Создание структуры модуля
- Создать директории согласно архитектуре
- Создать базовые файлы с экспортами

---

### Этап 2: Типы и интерфейсы

#### 2.1 Определение типов (`types.ts`)

```typescript
// Строка из Excel после парсинга
interface ParsedRow {
  name: string | null;      // Полное ФИО или null
  phone: string;            // Строка с номерами (может быть несколько)
  region: string;           // Название региона
  rowNumber: number;        // Номер строки для отчета об ошибках
}

// Результат парсинга ФИО
interface ParsedName {
  lastName: string | null;
  firstName: string | null;
  middleName: string | null;
}

// Результат парсинга телефонов
interface ParsedPhone {
  normalized: string;       // Нормализованный номер
  original: string;         // Оригинальный формат
  isValid: boolean;         // Прошла ли валидация
}

// Результат обработки строки
interface ProcessedRow {
  parsedRow: ParsedRow;
  parsedName: ParsedName;
  parsedPhones: ParsedPhone[];
  regionId: string | null;
  status: 'new' | 'updated' | 'skipped' | 'error';
  error?: string;
  clientId?: string;        // ID созданного/обновленного клиента
}

// Статистика импорта
interface ImportStatistics {
  total: number;            // Всего строк обработано
  created: number;          // Создано новых клиентов
  updated: number;          // Обновлено существующих
  skipped: number;          // Пропущено (дубликаты)
  errors: number;           // Ошибок
  regionsCreated: number;   // Создано новых регионов
}

// Результат импорта
interface ImportResult {
  success: boolean;
  statistics: ImportStatistics;
  processedRows: ProcessedRow[];
  errors: Array<{
    rowNumber: number;
    message: string;
  }>;
}
```

---

### Этап 3: Парсеры

#### 3.1 Парсер Excel файлов (`parsers/excel.parser.ts`)

**Функции**:
- `parseExcelFile(buffer: Buffer, filename: string): Promise<ParsedRow[]>`
- Поддержка форматов: `.xlsx`, `.xls`, `.csv`
- Поиск обязательных колонок: `name`, `phone`, `region` (case-insensitive)
- Обработка пустых строк и некорректных данных
- Возврат номера строки для каждой записи

**Алгоритм**:
1. Определение формата файла по расширению
2. Парсинг файла через `xlsx`
3. Поиск заголовков (первая строка)
4. Маппинг колонок по названиям (case-insensitive)
5. Извлечение данных из каждой строки
6. Валидация наличия обязательных колонок

#### 3.2 Парсер ФИО (`parsers/name.parser.ts`)

**Функции**:
- `parseFullName(fullName: string | null): ParsedName`

**Алгоритм**:
1. Если `fullName === null` или пустая строка → возврат `{ lastName: null, firstName: null, middleName: null }`
2. Разделение по пробелам: `words = fullName.trim().split(/\s+/)`
3. Фильтрация пустых слов
4. Обработка количества слов:
   - **0 слов** → все null
   - **1 слово** → `lastName = words[0]`, остальные null
   - **2 слова** → `lastName = words[0]`, `firstName = words[1]`, `middleName = null`
   - **3 слова** → `lastName = words[0]`, `firstName = words[1]`, `middleName = words[2]`
   - **4+ слова**:
     - Проверка 4-го слова на "Оглы" и подобные (case-insensitive)
     - Если да → игнорируем, берем первые 3
     - Если нет → берем первые 3, остальные игнорируем

**Список слов-исключений** (для 4-го слова):
- "Оглы", "Оглу", "Оглыу" (сын)
- "Кызы", "Кызыу" (дочь)
- Можно расширить при необходимости

#### 3.3 Парсер телефонов (`parsers/phone.parser.ts`)

**Функции**:
- `parsePhones(phoneString: string): ParsedPhone[]`
- `normalizePhone(phone: string): string | null` (возвращает null если невалидный)

**Алгоритм**:
1. Разделение строки по запятой и пробелу: `phoneString.split(/[,\s]+/)`
2. Фильтрация пустых значений
3. Для каждого номера:
   - Нормализация через `libphonenumber-js`
   - Валидация формата
   - Если валидный → сохраняем нормализованный и оригинальный
   - Если невалидный → помечаем `isValid: false`, но все равно сохраняем (для отчета)
4. Возврат массива `ParsedPhone[]`

**Особенности**:
- Поддержка российских форматов: `+7`, `8`, `7` в начале
- Поддержка международных форматов
- Сохранение оригинального формата для отладки

---

### Этап 4: Процессоры

#### 4.1 Процессор регионов (`processors/region.processor.ts`)

**Функции**:
- `async findOrCreateRegion(regionName: string, currentUserId: string, userRole: UserRole): Promise<string | null>`

**Алгоритм**:
1. Нормализация названия: `trim()`, case-insensitive поиск
2. Поиск в БД: `prisma.region.findFirst({ where: { name: { equals: regionName, mode: 'insensitive' } } })`
3. Если найден → возврат `region.id`
4. Если не найден:
   - **Проверка прав**: только ROOT может создавать регионы
   - Если не ROOT → логируем предупреждение, возвращаем `null` (регион не будет присвоен клиенту)
   - Если ROOT → создание: `prisma.region.create({ data: { name: regionName } })`
   - Возврат `region.id`
5. Если `regionName` пустой → возврат `null`

**Примечание**: Если регион не создан (не ROOT), клиент все равно создается, но без региона.

**Кэширование**:
- Кэш в памяти для текущей сессии импорта (Map<string, string>)
- Ключ: нормализованное название региона
- Значение: ID региона
- Это ускорит обработку повторяющихся регионов

#### 4.2 Процессор дедупликации (`processors/deduplication.processor.ts`)

**Функции**:
- `async findExistingClient(phones: ParsedPhone[], userId: string): Promise<{ client: Client | null, matchType: 'phone' | 'name_and_phone' | null }>`

**Алгоритм**:
1. Извлечение всех нормализованных номеров из `phones` (только валидные)
2. Поиск клиентов по номерам среди клиентов конкретного пользователя:
   ```typescript
   const clients = await prisma.client.findMany({
     where: {
       userId,  // Владелец группы (не текущий пользователь!)
       phones: {
         some: {
           phone: { in: normalizedPhones }
         }
       }
     },
     include: {
       phones: true,
       region: true,
       group: true
     }
   })
   ```
3. Если найдено несколько клиентов → берем первого (можно улучшить логику объединения)
4. Определение типа совпадения:
   - `'phone'` - найден только по номеру (ФИО не совпадает или отсутствует)
   - `'name_and_phone'` - найден по номеру и ФИО совпадает (полное совпадение)
   - `null` - не найден (новый клиент)

**Важно**: Поиск происходит только среди клиентов владельца группы (`userId`), не среди всех клиентов системы.

**Стратегия обновления**:
```typescript
interface DeduplicationStrategy {
  action: 'create' | 'update' | 'skip';
  reason: string;
  existingClientId?: string;
}

function determineStrategy(
  existingClient: Client | null,
  parsedName: ParsedName,
  parsedPhones: ParsedPhone[]
): DeduplicationStrategy {
  if (!existingClient) {
    return { action: 'create', reason: 'New client' };
  }

  // Проверка: есть ли ФИО в существующем клиенте
  const hasExistingName = existingClient.firstName || existingClient.lastName;
  const hasNewName = parsedName.firstName || parsedName.lastName;

  // Проверка: есть ли новые номера
  const existingPhones = existingClient.phones.map(p => p.phone);
  const newPhones = parsedPhones
    .filter(p => p.isValid)
    .map(p => p.normalized)
    .filter(p => !existingPhones.includes(p));

  // Стратегия 1: Нет ФИО в старом, есть в новом → обновить ФИО
  if (!hasExistingName && hasNewName) {
    return { 
      action: 'update', 
      reason: 'Add missing name',
      existingClientId: existingClient.id 
    };
  }

  // Стратегия 2: Есть новые номера → добавить номера
  if (newPhones.length > 0) {
    return { 
      action: 'update', 
      reason: 'Add new phones',
      existingClientId: existingClient.id 
    };
  }

  // Стратегия 3: Полное совпадение → пропустить
  return { 
    action: 'skip', 
    reason: 'Duplicate',
    existingClientId: existingClient.id 
  };
}
```

#### 4.3 Процессор клиентов (`processors/client.processor.ts`)

**Функции**:
- `async createClient(data: CreateClientData, groupId: string): Promise<Client>`
- `async updateClient(clientId: string, data: UpdateClientData): Promise<Client>`
- `async addPhonesToClient(clientId: string, phones: ParsedPhone[]): Promise<void>`

**Алгоритм создания**:
1. **ВАЖНО**: `groupId` передается как обязательный параметр (проверяется на уровне API)
2. Получение владельца группы: `const group = await prisma.clientGroup.findUnique({ where: { id: groupId }, select: { userId: true } })`
3. Создание клиента с `userId = group.userId` (владелец группы, не текущий пользователь!)
4. Создание клиента через `prisma.client.create({ data: { userId: group.userId, groupId, ... } })`
5. Создание телефонов через `prisma.clientPhone.createMany()`
6. Возврат созданного клиента с `include: { phones, region, group }`

**Проверка прав**:
- Перед импортом проверяется, что группа существует
- Если группа не существует → ошибка 404
- Если текущий пользователь не ROOT и группа принадлежит другому пользователю → ошибка 403 (или разрешить?)

**Алгоритм обновления**:
1. Определение что обновлять:
   - Если добавляем ФИО → `update({ data: { lastName, firstName, middleName } })`
   - Если добавляем номера → создаем через `createMany()`
2. Транзакция для атомарности операций

---

### Этап 5: Основной сервис импорта

#### 5.1 Сервис импорта (`services/import.service.ts`)

**Функции**:
- `async importClients(file: Express.Multer.File, groupId: string, currentUserId: string, userRole: UserRole): Promise<ImportResult>`

**Изменения**:
- `groupId` - обязательный параметр (группа должна существовать)
- `currentUserId` - пользователь, который выполняет импорт (для логирования)
- `userRole` - роль текущего пользователя (для создания регионов)
- Владелец клиентов определяется из группы: `group.userId`

**Алгоритм**:
```typescript
async function importClients(file, groupId, currentUserId, userRole) {
  // 1. ПРОВЕРКА ГРУППЫ (обязательно перед началом)
  const group = await prisma.clientGroup.findUnique({
    where: { id: groupId },
    select: { id: true, userId: true, name: true }
  });

  if (!group) {
    throw new Error(`Group with id ${groupId} not found`);
  }

  // Владелец клиентов = владелец группы
  const clientOwnerId = group.userId;

  const statistics: ImportStatistics = {
    total: 0,
    created: 0,
    updated: 0,
    skipped: 0,
    errors: 0,
    regionsCreated: 0
  };

  const processedRows: ProcessedRow[] = [];
  const regionCache = new Map<string, string>();

  try {
    // 2. Парсинг файла
    const parsedRows = await parseExcelFile(file.buffer, file.originalname);
    statistics.total = parsedRows.length;

    // 3. Обработка каждой строки
    for (const row of parsedRows) {
      try {
        // 3.1 Парсинг ФИО
        const parsedName = parseFullName(row.name);

        // 3.2 Парсинг телефонов
        const parsedPhones = parsePhones(row.phone);

        // 3.3 Обработка региона
        const regionId = await findOrCreateRegion(
          row.region, 
          currentUserId,
          userRole,
          regionCache
        );
        if (regionId && !regionCache.has(row.region.toLowerCase())) {
          statistics.regionsCreated++;
          regionCache.set(row.region.toLowerCase(), regionId);
        }

        // 3.4 Дедупликация (поиск среди клиентов владельца группы)
        const existingClient = await findExistingClient(
          parsedPhones.filter(p => p.isValid),
          clientOwnerId  // Ищем среди клиентов владельца группы!
        );

        const strategy = determineStrategy(
          existingClient,
          parsedName,
          parsedPhones
        );

        // 3.5 Выполнение действия
        let clientId: string | undefined;
        if (strategy.action === 'create') {
          const client = await createClient({
            ...parsedName,
            regionId,
            phones: parsedPhones.filter(p => p.isValid)
          }, groupId);  // Передаем groupId, внутри определяется userId из группы
          clientId = client.id;
          statistics.created++;
        } else if (strategy.action === 'update') {
          if (!strategy.existingClientId) throw new Error('No client ID');
          
          // Обновление ФИО если нужно
          if (strategy.reason === 'Add missing name') {
            await updateClient(strategy.existingClientId, parsedName);
          }
          
          // Добавление новых номеров
          if (strategy.reason === 'Add new phones') {
            await addPhonesToClient(
              strategy.existingClientId,
              parsedPhones.filter(p => p.isValid)
            );
          }
          
          clientId = strategy.existingClientId;
          statistics.updated++;
        } else {
          statistics.skipped++;
        }

        processedRows.push({
          parsedRow: row,
          parsedName,
          parsedPhones,
          regionId,
          status: strategy.action === 'create' ? 'new' : 
                 strategy.action === 'update' ? 'updated' : 'skipped',
          clientId
        });

      } catch (error) {
        statistics.errors++;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        
        // Детальное логирование ошибки
        logger.warn('Error processing import row', {
          rowNumber: row.rowNumber,
          error: errorMessage,
          rowData: { name: row.name, phone: row.phone, region: row.region },
          importedBy: currentUserId,
          groupId
        });

        processedRows.push({
          parsedRow: row,
          parsedName: { lastName: null, firstName: null, middleName: null },
          parsedPhones: [],
          regionId: null,
          status: 'error',
          error: errorMessage
        });
      }
    }

    // 4. Логирование итоговой статистики
    logger.info('Import completed', {
      groupId,
      groupName: group.name,
      importedBy: currentUserId,
      statistics
    });

    return {
      success: statistics.errors === 0,
      statistics,
      processedRows,
      errors: processedRows
        .filter(r => r.status === 'error')
        .map(r => ({
          rowNumber: r.parsedRow.rowNumber,
          message: r.error || 'Unknown error',
          data: {
            name: r.parsedRow.name,
            phone: r.parsedRow.phone,
            region: r.parsedRow.region
          }
        }))
    };

  } catch (error) {
    // Критическая ошибка (например, не удалось прочитать файл)
    logger.error('Critical error during import', {
      error: error instanceof Error ? error.message : 'Unknown error',
      groupId,
      importedBy: currentUserId
    });
    throw error;
  }
}
```

**Оптимизация производительности**:
- Батчинг операций БД (группировка createMany для телефонов)
- Транзакции для атомарности
- Кэширование регионов в памяти
- Обработка больших файлов порциями (chunks)

---

### Этап 6: HTTP API

#### 6.1 Контроллер (`import.controller.ts`)

**Endpoint**: `POST /api/import/clients`

**Middleware**:
- `authMiddleware` - проверка токена
- `requireAuth` - проверка авторизации
- `multer().single('file')` - загрузка файла

**Query/Body параметры**:
- `groupId` (обязательный) - UUID группы, в которую импортируются клиенты
- `file` (обязательный) - загружаемый файл

**Валидация**:
- Формат файла: `.xlsx`, `.xls`, `.csv`
- Размер файла: максимум 50MB (для файлов до 10к строк)
- Наличие файла в запросе
- Наличие и валидность `groupId` (UUID)
- Существование группы в БД
- Права доступа: если группа принадлежит другому пользователю и текущий не ROOT → 403

**Ответ**:
```typescript
{
  success: boolean;
  statistics: ImportStatistics;
  message: string;
  errors?: Array<{ 
    rowNumber: number; 
    message: string;
    data?: { name: string | null; phone: string; region: string }
  }>;
  groupId: string;
  groupName: string;
}
```

**Обработка ошибок**:
- 400: Неверный формат файла, отсутствует файл или groupId
- 403: Группа принадлежит другому пользователю (если не ROOT)
- 404: Группа не найдена
- 500: Ошибка при обработке файла

#### 6.2 Роуты (`import.routes.ts`)

```typescript
import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { authMiddleware, requireAuth } from '../../middleware';
import { importClientsHandler } from './import.controller';

const router = Router();
const upload = multer({
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB (для файлов до 10к строк)
  fileFilter: (req, file, cb) => {
    const allowedExtensions = ['.xlsx', '.xls', '.csv'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedExtensions.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file format. Allowed: .xlsx, .xls, .csv'));
    }
  }
});

router.post(
  '/clients',
  authMiddleware,
  requireAuth,
  upload.single('file'),
  importClientsHandler
);

export default router;
```

**Примечание**: `groupId` передается через `req.query.groupId` или `req.body.groupId` (на усмотрение, но лучше через query для явности).

---

### Этап 7: Обработка ошибок и логирование

#### 7.1 Типы ошибок
- **Ошибки парсинга файла**: неверный формат, поврежденный файл
- **Ошибки валидации**: отсутствие обязательных колонок
- **Ошибки данных**: невалидные телефоны, некорректные регионы
- **Ошибки БД**: проблемы с транзакциями, дубликаты

#### 7.2 Логирование
- Уровень `info`: начало/конец импорта, статистика
- Уровень `warn`: пропущенные строки, невалидные данные
- Уровень `error`: критические ошибки, ошибки БД

---

### Этап 8: Тестирование

#### 8.1 Unit тесты
- Парсер ФИО: различные форматы, пустые значения, 4 слова
- Парсер телефонов: разные форматы, множественные номера
- Дедупликация: все сценарии стратегий

#### 8.2 Интеграционные тесты
- Полный цикл импорта с тестовым файлом
- Проверка создания/обновления клиентов
- Проверка статистики

---

## Уточнения требований (ответы на вопросы)

1. **Группа клиентов**: Пользователь импортирует в **созданную группу**. `groupId` передается в запросе как обязательный параметр.

2. **Права доступа**: Импортировать могут **все авторизованные пользователи**. Клиенты закрепляются за **владельцем группы**, в которую они импортируются (не за тем, кто импортирует, если это разные пользователи).

3. **Размер файла**: В среднем до **10,000 строк (контактов)**. Синхронная обработка допустима, но нужна оптимизация.

4. **Асинхронная обработка**: **Синхронная обработка** с возвратом результата сразу. Для больших файлов можно добавить прогресс-бар на фронтенде.

5. **Отчет об ошибках**: **Детальное логирование** с номерами строк и причинами ошибок. Возвращается в ответе API.

6. **Создание группы**: **Обязательное условие** - группа должна быть создана перед импортом. Если группы нет - отмена импорта с ошибкой. На фронтенде: открывается диалог создания группы, после создания начинается импорт.

---

## Порядок реализации (TODO)

1. ✅ Установка зависимостей
2. ✅ Создание структуры модуля
3. ✅ Определение типов
4. ✅ Парсер Excel
5. ✅ Парсер ФИО
6. ✅ Парсер телефонов
7. ✅ Процессор регионов
8. ✅ Процессор дедупликации
9. ✅ Процессор клиентов
10. ✅ Сервис импорта
11. ✅ Контроллер и роуты
12. ✅ Валидация и обработка ошибок
13. ✅ Тестирование
14. ✅ Оптимизация производительности

---

## Примечания

- Модуль полностью изолирован от других модулей (кроме использования Prisma и существующих сервисов)
- Следует принципам SOLID (разделение ответственности)
- Все операции логируются для отладки
- Поддерживается обработка больших файлов (до 10к строк)
- Дедупликация умная и не создает дубликаты
- **Важно**: Группа должна быть создана ДО импорта. На фронтенде: если у пользователя нет групп, открывается диалог создания группы, после создания начинается импорт в эту группу
- Клиенты принадлежат **владельцу группы**, а не пользователю, который выполняет импорт (важно для мультитенантности)

