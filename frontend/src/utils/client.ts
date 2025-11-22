/**
 * Утилиты для работы с клиентами
 * 
 * Вспомогательные функции для форматирования и обработки данных клиентов.
 */

import type { Client } from '@/types';

/**
 * Форматирует полное имя клиента
 * 
 * Если у клиента нет имени (пустые строки), возвращает прочерк (-).
 * Иначе возвращает ФИО, разделенные пробелами.
 * 
 * @param client - Клиент для форматирования
 * @returns Отформатированное имя или прочерк
 * 
 * @example
 * ```typescript
 * formatClientName({ lastName: 'Иванов', firstName: 'Иван', middleName: 'Иванович' })
 * // "Иванов Иван Иванович"
 * 
 * formatClientName({ lastName: '', firstName: '', middleName: null })
 * // "-"
 * ```
 */
export function formatClientName(client: Client): string {
  // Проверяем, есть ли хотя бы одно непустое имя
  const hasName = (client.lastName && client.lastName.trim()) || (client.firstName && client.firstName.trim());
  
  if (!hasName) {
    return '-';
  }
  
  const parts: string[] = [];
  
  if (client.lastName && client.lastName.trim()) {
    parts.push(client.lastName);
  }
  
  if (client.firstName && client.firstName.trim()) {
    parts.push(client.firstName);
  }
  
  if (client.middleName && client.middleName.trim()) {
    parts.push(client.middleName);
  }
  
  return parts.join(' ') || '-';
}

