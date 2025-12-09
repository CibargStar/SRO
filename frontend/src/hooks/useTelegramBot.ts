import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ApiError,
  TelegramBotSettings,
  SetupTelegramBotResponse,
  VerifyTelegramBotResponse,
  UpdateTelegramNotificationsInput,
  TestTelegramBotResponse,
} from '@/types';
import {
  disconnectTelegramBot,
  getTelegramBotSettings,
  sendTestTelegramNotification,
  setupTelegramBot,
  updateTelegramNotifications,
  verifyTelegramBot,
} from '@/utils/telegram-bot-api';

const telegramKeys = {
  settings: ['telegramBotSettings'] as const,
};

export function useTelegramBotSettings() {
  return useQuery<TelegramBotSettings, ApiError>({
    queryKey: telegramKeys.settings,
    queryFn: getTelegramBotSettings,
  });
}

export function useSetupTelegramBot() {
  const queryClient = useQueryClient();
  return useMutation<SetupTelegramBotResponse, ApiError, { botToken: string }>({
    mutationFn: ({ botToken }) => setupTelegramBot(botToken),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: telegramKeys.settings });
    },
  });
}

export function useVerifyTelegramBot() {
  const queryClient = useQueryClient();
  return useMutation<VerifyTelegramBotResponse, ApiError, { code: string }>({
    mutationFn: ({ code }) => verifyTelegramBot(code),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: telegramKeys.settings });
    },
  });
}

export function useDisconnectTelegramBot() {
  const queryClient = useQueryClient();
  return useMutation<{ message: string }, ApiError>({
    mutationFn: disconnectTelegramBot,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: telegramKeys.settings });
    },
  });
}

export function useUpdateTelegramNotifications() {
  const queryClient = useQueryClient();
  return useMutation<{ message: string }, ApiError, UpdateTelegramNotificationsInput>({
    mutationFn: updateTelegramNotifications,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: telegramKeys.settings });
    },
  });
}

export function useTestTelegramBot() {
  return useMutation<TestTelegramBotResponse, ApiError>({
    mutationFn: sendTestTelegramNotification,
  });
}


