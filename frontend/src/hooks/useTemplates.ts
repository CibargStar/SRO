/**
 * React Query хуки для управления шаблонами сообщений
 * 
 * Предоставляет хуки для работы с API шаблонов:
 * - useTemplateCategories - получение списка категорий
 * - useCreateTemplateCategory, useUpdateTemplateCategory, useDeleteTemplateCategory
 * - useTemplates - получение списка шаблонов
 * - useTemplate - получение шаблона по ID
 * - useCreateTemplate, useUpdateTemplate, useDeleteTemplate
 * - useDuplicateTemplate, useMoveTemplate
 * - usePreviewTemplate
 * - useAddTemplateItem, useUpdateTemplateItem, useDeleteTemplateItem, useReorderTemplateItems
 * - useUploadTemplateFile, useDeleteTemplateFile
 */

import { useQuery, useMutation, useQueryClient, type UseQueryOptions } from '@tanstack/react-query';
import {
  listTemplateCategories,
  getTemplateCategory,
  createTemplateCategory,
  updateTemplateCategory,
  deleteTemplateCategory,
  listTemplates,
  getTemplate,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  duplicateTemplate,
  moveTemplate,
  previewTemplate,
  addTemplateItem,
  updateTemplateItem,
  deleteTemplateItem,
  reorderTemplateItems,
  uploadTemplateFile,
  deleteTemplateFile,
} from '@/utils/templates-api';
import type {
  TemplateCategory,
  Template,
  TemplateItem,
  ListTemplatesQuery,
  TemplatesListResponse,
  CreateCategoryInput,
  UpdateCategoryInput,
  CreateTemplateInput,
  UpdateTemplateInput,
  CreateTemplateItemInput,
  UpdateTemplateItemInput,
  ReorderItemsInput,
  MoveTemplateInput,
  PreviewTemplateInput,
  TemplatePreviewResponse,
  FileUploadResponse,
} from '@/types/template';

/**
 * Ключи для React Query кэша
 */
export const templatesKeys = {
  all: ['templates'] as const,
  lists: () => [...templatesKeys.all, 'list'] as const,
  list: (query?: ListTemplatesQuery) => [...templatesKeys.lists(), query] as const,
  details: () => [...templatesKeys.all, 'detail'] as const,
  detail: (id: string) => [...templatesKeys.details(), id] as const,
  preview: (id: string, data?: PreviewTemplateInput) => [...templatesKeys.detail(id), 'preview', data] as const,
  categories: () => [...templatesKeys.all, 'categories'] as const,
  category: (id: string) => [...templatesKeys.categories(), id] as const,
};

// ============================================
// Template Categories Hooks
// ============================================

/**
 * Хук для получения списка категорий шаблонов
 */
export function useTemplateCategories(
  options?: Omit<UseQueryOptions<TemplateCategory[]>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: templatesKeys.categories(),
    queryFn: () => listTemplateCategories(),
    staleTime: 5 * 60 * 1000, // Данные актуальны 5 минут
    retry: false,
    ...options,
  });
}

/**
 * Хук для получения категории по ID
 */
export function useTemplateCategory(
  categoryId: string,
  options?: Omit<UseQueryOptions<TemplateCategory>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: templatesKeys.category(categoryId),
    queryFn: () => getTemplateCategory(categoryId),
    enabled: !!categoryId,
    staleTime: 5 * 60 * 1000,
    retry: false,
    ...options,
  });
}

/**
 * Хук для создания категории
 */
export function useCreateTemplateCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateCategoryInput) => createTemplateCategory(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: templatesKeys.categories() });
    },
  });
}

/**
 * Хук для обновления категории
 */
export function useUpdateTemplateCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ categoryId, data }: { categoryId: string; data: UpdateCategoryInput }) =>
      updateTemplateCategory(categoryId, data),
    onSuccess: (updatedCategory) => {
      queryClient.setQueryData(templatesKeys.category(updatedCategory.id), updatedCategory);
      queryClient.invalidateQueries({ queryKey: templatesKeys.categories() });
    },
  });
}

/**
 * Хук для удаления категории
 */
export function useDeleteTemplateCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (categoryId: string) => deleteTemplateCategory(categoryId),
    onSuccess: (_, categoryId) => {
      queryClient.invalidateQueries({ queryKey: templatesKeys.categories() });
      queryClient.removeQueries({ queryKey: templatesKeys.category(categoryId) });
      // Также инвалидируем список шаблонов, так как они могут быть связаны с этой категорией
      queryClient.invalidateQueries({ queryKey: templatesKeys.lists() });
    },
  });
}

// ============================================
// Templates Hooks
// ============================================

/**
 * Хук для получения списка шаблонов
 */
export function useTemplates(
  query?: ListTemplatesQuery,
  options?: Omit<UseQueryOptions<TemplatesListResponse>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: templatesKeys.list(query),
    queryFn: () => listTemplates(query),
    staleTime: 30 * 1000, // Данные актуальны 30 секунд
    retry: false,
    ...options,
  });
}

/**
 * Хук для получения шаблона по ID
 */
export function useTemplate(
  templateId: string,
  options?: Omit<UseQueryOptions<Template>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: templatesKeys.detail(templateId),
    queryFn: () => getTemplate(templateId),
    enabled: !!templateId,
    staleTime: 30 * 1000,
    retry: false,
    ...options,
  });
}

/**
 * Хук для создания шаблона
 */
export function useCreateTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateTemplateInput) => createTemplate(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: templatesKeys.lists() });
      queryClient.invalidateQueries({ queryKey: templatesKeys.categories() });
    },
  });
}

/**
 * Хук для обновления шаблона
 */
export function useUpdateTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ templateId, data }: { templateId: string; data: UpdateTemplateInput }) =>
      updateTemplate(templateId, data),
    onSuccess: (updatedTemplate) => {
      queryClient.setQueryData(templatesKeys.detail(updatedTemplate.id), updatedTemplate);
      
      // Обновляем шаблон во всех вариантах кэша списка
      queryClient.setQueriesData<TemplatesListResponse>(
        { queryKey: templatesKeys.lists(), exact: false },
        (oldData) => {
          if (!oldData) return oldData;
          return {
            ...oldData,
            data: oldData.data.map((t) =>
              t.id === updatedTemplate.id ? { ...updatedTemplate } : t
            ),
          };
        }
      );
      
      queryClient.invalidateQueries({ queryKey: templatesKeys.lists() });
    },
  });
}

/**
 * Хук для удаления шаблона
 */
export function useDeleteTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (templateId: string) => deleteTemplate(templateId),
    onSuccess: (_, templateId) => {
      queryClient.invalidateQueries({ queryKey: templatesKeys.lists() });
      queryClient.removeQueries({ queryKey: templatesKeys.detail(templateId) });
      queryClient.invalidateQueries({ queryKey: templatesKeys.categories() });
    },
  });
}

/**
 * Хук для дублирования шаблона
 */
export function useDuplicateTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ templateId, name }: { templateId: string; name?: string }) =>
      duplicateTemplate(templateId, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: templatesKeys.lists() });
      queryClient.invalidateQueries({ queryKey: templatesKeys.categories() });
    },
  });
}

/**
 * Хук для перемещения шаблона в категорию
 */
export function useMoveTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ templateId, data }: { templateId: string; data: MoveTemplateInput }) =>
      moveTemplate(templateId, data),
    onSuccess: (updatedTemplate) => {
      queryClient.setQueryData(templatesKeys.detail(updatedTemplate.id), updatedTemplate);
      queryClient.invalidateQueries({ queryKey: templatesKeys.lists() });
      queryClient.invalidateQueries({ queryKey: templatesKeys.categories() });
    },
  });
}

/**
 * Хук для предпросмотра шаблона
 */
export function usePreviewTemplate(
  templateId: string,
  data?: PreviewTemplateInput,
  options?: Omit<UseQueryOptions<TemplatePreviewResponse>, 'queryKey' | 'queryFn'>
) {
  return useQuery({
    queryKey: templatesKeys.preview(templateId, data),
    queryFn: () => previewTemplate(templateId, data),
    enabled: !!templateId,
    staleTime: 0, // Всегда получаем свежие данные для preview
    retry: false,
    ...options,
  });
}

/**
 * Хук для мутации предпросмотра шаблона (для формы)
 */
export function usePreviewTemplateMutation() {
  return useMutation({
    mutationFn: ({ templateId, data }: { templateId: string; data?: PreviewTemplateInput }) =>
      previewTemplate(templateId, data),
  });
}

// ============================================
// Template Items Hooks
// ============================================

/**
 * Хук для добавления элемента в шаблон
 */
export function useAddTemplateItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ templateId, data }: { templateId: string; data: CreateTemplateItemInput }) =>
      addTemplateItem(templateId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: templatesKeys.detail(variables.templateId) });
    },
  });
}

/**
 * Хук для обновления элемента шаблона
 */
export function useUpdateTemplateItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      templateId,
      itemId,
      data,
    }: {
      templateId: string;
      itemId: string;
      data: UpdateTemplateItemInput;
    }) => updateTemplateItem(templateId, itemId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: templatesKeys.detail(variables.templateId) });
    },
  });
}

/**
 * Хук для удаления элемента шаблона
 */
export function useDeleteTemplateItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ templateId, itemId }: { templateId: string; itemId: string }) =>
      deleteTemplateItem(templateId, itemId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: templatesKeys.detail(variables.templateId) });
    },
  });
}

/**
 * Хук для переупорядочивания элементов шаблона
 */
export function useReorderTemplateItems() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ templateId, data }: { templateId: string; data: ReorderItemsInput }) =>
      reorderTemplateItems(templateId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: templatesKeys.detail(variables.templateId) });
    },
  });
}

// ============================================
// File Upload Hooks
// ============================================

/**
 * Хук для загрузки файла в элемент шаблона
 */
export function useUploadTemplateFile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      templateId,
      itemId,
      file,
    }: {
      templateId: string;
      itemId: string;
      file: File;
    }) => uploadTemplateFile(templateId, itemId, file),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: templatesKeys.detail(variables.templateId) });
    },
  });
}

/**
 * Хук для удаления файла элемента шаблона
 */
export function useDeleteTemplateFile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ templateId, itemId }: { templateId: string; itemId: string }) =>
      deleteTemplateFile(templateId, itemId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: templatesKeys.detail(variables.templateId) });
    },
  });
}


