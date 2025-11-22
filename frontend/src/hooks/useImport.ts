/**
 * React Query хуки для импорта клиентов
 * 
 * Предоставляет хуки для работы с API импорта клиентов из Excel файлов.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { importClients } from '@/utils/api';
import { clientsKeys } from './useClients';

/**
 * Хук для импорта клиентов из Excel файла
 * 
 * Автоматически обновляет кэш списка клиентов после успешного импорта.
 * 
 * @example
 * ```typescript
 * const importMutation = useImportClients();
 * importMutation.mutate({ groupId: 'uuid', file: fileObject });
 * ```
 */
export function useImportClients() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ groupId, file }: { groupId: string; file: File }) =>
      importClients(groupId, file),
    onSuccess: () => {
      // Инвалидируем кэш списка клиентов, чтобы обновить данные
      queryClient.invalidateQueries({ queryKey: clientsKeys.lists() });
    },
  });
}

