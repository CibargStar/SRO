/**
 * React Query хуки для экспорта групп клиентов
 * 
 * Предоставляет хуки для работы с API экспорта:
 * - useExportGroup - экспорт группы в файл
 */

import { useMutation } from '@tanstack/react-query';
import { exportGroup } from '@/utils/api';

/**
 * Хук для экспорта группы клиентов
 * 
 * @example
 * ```typescript
 * const exportMutation = useExportGroup();
 * exportMutation.mutate({ groupId: '123', format: 'xlsx' });
 * ```
 */
export function useExportGroup() {
  return useMutation({
    mutationFn: ({ groupId, format }: { groupId: string; format?: 'xlsx' | 'xls' | 'csv' }) =>
      exportGroup(groupId, format || 'xlsx'),
  });
}


