/**
 * Сервис для работы с переменными в шаблонах
 * 
 * Поддерживает переменные вида {{variableName}}:
 * - {{firstName}} - Имя клиента
 * - {{lastName}} - Фамилия клиента
 * - {{middleName}} - Отчество клиента
 * - {{fullName}} - Полное имя (Фамилия Имя Отчество)
 * - {{phone}} - Номер телефона
 * - {{date}} - Текущая дата
 * - {{time}} - Текущее время
 * - {{groupName}} - Название группы клиента
 * - {{regionName}} - Название региона клиента
 * 
 * @module modules/templates/variable-parser.service
 */

/**
 * Доступные переменные для шаблонов
 */
export const AVAILABLE_VARIABLES = [
  'firstName',
  'lastName',
  'middleName',
  'fullName',
  'phone',
  'date',
  'time',
  'groupName',
  'regionName',
] as const;

export type VariableName = (typeof AVAILABLE_VARIABLES)[number];

/**
 * Описание переменных для UI
 */
export const VARIABLE_DESCRIPTIONS: Record<VariableName, { label: string; description: string }> = {
  firstName: {
    label: 'Имя',
    description: 'Имя клиента',
  },
  lastName: {
    label: 'Фамилия',
    description: 'Фамилия клиента',
  },
  middleName: {
    label: 'Отчество',
    description: 'Отчество клиента (если указано)',
  },
  fullName: {
    label: 'Полное имя',
    description: 'Фамилия Имя Отчество (полностью)',
  },
  phone: {
    label: 'Телефон',
    description: 'Номер телефона клиента',
  },
  date: {
    label: 'Дата',
    description: 'Текущая дата в формате ДД.ММ.ГГГГ',
  },
  time: {
    label: 'Время',
    description: 'Текущее время в формате ЧЧ:ММ',
  },
  groupName: {
    label: 'Группа',
    description: 'Название группы клиента',
  },
  regionName: {
    label: 'Регион',
    description: 'Название региона клиента',
  },
};

/**
 * Данные клиента для подстановки переменных
 */
export interface ClientData {
  firstName: string;
  lastName: string;
  middleName?: string | null;
  phone?: string;
  groupName?: string | null;
  regionName?: string | null;
}

/**
 * Результат парсинга шаблона
 */
export interface ParseResult {
  /** Найденные переменные */
  variables: VariableName[];
  /** Невалидные переменные (не из списка доступных) */
  invalidVariables: string[];
  /** Есть ли ошибки */
  isValid: boolean;
}

/**
 * Результат валидации шаблона
 */
export interface ValidationResult {
  /** Валиден ли шаблон */
  isValid: boolean;
  /** Ошибки валидации */
  errors: string[];
  /** Предупреждения */
  warnings: string[];
}

/**
 * Регулярное выражение для поиска переменных {{variableName}}
 */
const VARIABLE_REGEX = /\{\{(\w+)\}\}/g;

/**
 * Сервис для работы с переменными шаблонов
 */
export class VariableParserService {
  /**
   * Парсинг текста шаблона для извлечения переменных
   * 
   * @param text - Текст шаблона
   * @returns Результат парсинга
   */
  parseVariables(text: string): ParseResult {
    const variables: VariableName[] = [];
    const invalidVariables: string[] = [];
    const found = new Set<string>();

    let match;
    while ((match = VARIABLE_REGEX.exec(text)) !== null) {
      const varName = match[1];
      
      // Избегаем дубликатов
      if (found.has(varName)) {
        continue;
      }
      found.add(varName);

      // Проверяем, есть ли переменная в списке доступных
      if (AVAILABLE_VARIABLES.includes(varName as VariableName)) {
        variables.push(varName as VariableName);
      } else {
        invalidVariables.push(varName);
      }
    }

    return {
      variables,
      invalidVariables,
      isValid: invalidVariables.length === 0,
    };
  }

  /**
   * Подстановка значений переменных в текст
   * 
   * @param text - Текст шаблона
   * @param clientData - Данные клиента
   * @returns Текст с подставленными значениями
   */
  replaceVariables(text: string, clientData: ClientData): string {
    const values = this.buildVariableValues(clientData);
    
    return text.replace(VARIABLE_REGEX, (match, varName) => {
      if (varName in values) {
        return values[varName] || '';
      }
      // Оставляем как есть если переменная не найдена
      return match;
    });
  }

  /**
   * Валидация текста шаблона
   * 
   * @param text - Текст шаблона
   * @returns Результат валидации
   */
  validateTemplate(text: string): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Парсим переменные
    const parseResult = this.parseVariables(text);

    // Ошибки для невалидных переменных
    if (parseResult.invalidVariables.length > 0) {
      errors.push(
        `Неизвестные переменные: ${parseResult.invalidVariables.map((v) => `{{${v}}}`).join(', ')}`
      );
    }

    // Предупреждение о пустом тексте
    if (!text.trim()) {
      warnings.push('Текст шаблона пустой');
    }

    // Предупреждение если нет переменных персонализации
    const personalizationVars = parseResult.variables.filter((v) =>
      ['firstName', 'lastName', 'middleName', 'fullName'].includes(v)
    );
    if (personalizationVars.length === 0 && text.trim()) {
      warnings.push('Шаблон не содержит переменных персонализации (имя, фамилия)');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Предпросмотр шаблона с тестовыми данными
   * 
   * @param text - Текст шаблона
   * @param clientData - Данные клиента (опционально, используются тестовые)
   * @returns Текст с подставленными значениями
   */
  previewTemplate(text: string, clientData?: ClientData): string {
    // Тестовые данные по умолчанию
    const testData: ClientData = clientData ?? {
      firstName: 'Иван',
      lastName: 'Иванов',
      middleName: 'Иванович',
      phone: '+79001234567',
      groupName: 'Тестовая группа',
      regionName: 'Москва',
    };

    return this.replaceVariables(text, testData);
  }

  /**
   * Получение списка доступных переменных
   * 
   * @returns Список переменных с описаниями
   */
  getAvailableVariables(): Array<{ name: VariableName; label: string; description: string }> {
    return AVAILABLE_VARIABLES.map((name) => ({
      name,
      ...VARIABLE_DESCRIPTIONS[name],
    }));
  }

  /**
   * Построение объекта значений переменных из данных клиента
   */
  private buildVariableValues(clientData: ClientData): Record<string, string> {
    const now = new Date();
    
    // Формирование полного имени
    const fullNameParts = [clientData.lastName, clientData.firstName];
    if (clientData.middleName) {
      fullNameParts.push(clientData.middleName);
    }
    const fullName = fullNameParts.join(' ');

    return {
      firstName: clientData.firstName,
      lastName: clientData.lastName,
      middleName: clientData.middleName ?? '',
      fullName,
      phone: clientData.phone ?? '',
      date: this.formatDate(now),
      time: this.formatTime(now),
      groupName: clientData.groupName ?? '',
      regionName: clientData.regionName ?? '',
    };
  }

  /**
   * Форматирование даты в формате ДД.ММ.ГГГГ
   */
  private formatDate(date: Date): string {
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}.${month}.${year}`;
  }

  /**
   * Форматирование времени в формате ЧЧ:ММ
   */
  private formatTime(date: Date): string {
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  }
}


