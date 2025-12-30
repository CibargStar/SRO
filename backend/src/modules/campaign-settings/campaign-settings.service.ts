/**
 * Сервис управления глобальными настройками кампаний
 * 
 * Предоставляет бизнес-логику для работы с настройками рассылок.
 * Все настройки доступны только ROOT пользователю для редактирования.
 */

import { CampaignGlobalSettings } from '@prisma/client';
import { CampaignSettingsRepository } from './campaign-settings.repository';

/**
 * Интерфейс для обновления настроек
 */
export interface UpdateGlobalSettingsInput {
  // Режим паузы: 1 = между номерами, 2 = между клиентами
  pauseMode?: number;
  
  // Тайминги (в миллисекундах) - фиксированные значения
  delayBetweenContactsMs?: number;
  delayBetweenMessagesMs?: number;
  
  // Лимиты
  maxContactsPerProfilePerHour?: number;
  maxContactsPerProfilePerDay?: number;
  
  // Рабочее время по умолчанию
  defaultWorkHoursStart?: string;
  defaultWorkHoursEnd?: string;
  defaultWorkDays?: string;
  
  // Имитация набора
  typingSimulationEnabled?: boolean;
  typingSpeedCharsPerSec?: number;
  
  // Обработка ошибок
  maxRetriesOnError?: number;
  retryDelayMs?: number;
  pauseOnCriticalError?: boolean;
  
  // Мониторинг
  profileHealthCheckIntervalMs?: number;
  autoResumeAfterRestart?: boolean;
  
  // Хранение
  keepCompletedCampaignsDays?: number;
  
  // Прогрев профилей
  warmupEnabled?: boolean;
  warmupDay1To3Limit?: number;
  warmupDay4To7Limit?: number;
}

/**
 * Интерфейс для формата настроек с типизированными рабочими днями
 */
export interface CampaignGlobalSettingsFormatted extends Omit<CampaignGlobalSettings, 'defaultWorkDays'> {
  defaultWorkDays: number[];
}

export class CampaignSettingsService {
  constructor(private readonly repository: CampaignSettingsRepository) {}

  /**
   * Получить глобальные настройки
   * Автоматически создаёт дефолтные настройки если их нет
   */
  async getGlobalSettings(): Promise<CampaignGlobalSettingsFormatted> {
    const settings = await this.repository.getOrCreate();
    return this.formatSettings(settings);
  }

  /**
   * Обновить глобальные настройки
   * 
   * @param input - Данные для обновления
   * @param updatedBy - ID пользователя (ROOT), выполняющего обновление
   */
  async updateGlobalSettings(
    input: UpdateGlobalSettingsInput,
    updatedBy: string
  ): Promise<CampaignGlobalSettingsFormatted> {
    // Получаем существующие настройки (или создаём)
    const existing = await this.repository.getOrCreate();

    // Подготавливаем данные для обновления
    const updateData: Record<string, unknown> = {};

    // Валидация и добавление полей
    if (input.pauseMode !== undefined) {
      if (input.pauseMode !== 1 && input.pauseMode !== 2) {
        throw new Error('pauseMode must be 1 or 2');
      }
      updateData.pauseMode = input.pauseMode;
    }

    if (input.delayBetweenContactsMs !== undefined) {
      if (input.delayBetweenContactsMs < 0) {
        throw new Error('delayBetweenContactsMs must be non-negative');
      }
      updateData.delayBetweenContactsMs = input.delayBetweenContactsMs;
    }

    if (input.delayBetweenMessagesMs !== undefined) {
      if (input.delayBetweenMessagesMs < 0) {
        throw new Error('delayBetweenMessagesMs must be non-negative');
      }
      updateData.delayBetweenMessagesMs = input.delayBetweenMessagesMs;
    }

    if (input.maxContactsPerProfilePerHour !== undefined) {
      if (input.maxContactsPerProfilePerHour < 1) {
        throw new Error('maxContactsPerProfilePerHour must be at least 1');
      }
      updateData.maxContactsPerProfilePerHour = input.maxContactsPerProfilePerHour;
    }

    if (input.maxContactsPerProfilePerDay !== undefined) {
      if (input.maxContactsPerProfilePerDay < 1) {
        throw new Error('maxContactsPerProfilePerDay must be at least 1');
      }
      updateData.maxContactsPerProfilePerDay = input.maxContactsPerProfilePerDay;
    }

    if (input.defaultWorkHoursStart !== undefined) {
      if (!this.isValidTime(input.defaultWorkHoursStart)) {
        throw new Error('defaultWorkHoursStart must be in HH:mm format');
      }
      updateData.defaultWorkHoursStart = input.defaultWorkHoursStart;
    }

    if (input.defaultWorkHoursEnd !== undefined) {
      if (!this.isValidTime(input.defaultWorkHoursEnd)) {
        throw new Error('defaultWorkHoursEnd must be in HH:mm format');
      }
      updateData.defaultWorkHoursEnd = input.defaultWorkHoursEnd;
    }

    if (input.defaultWorkDays !== undefined) {
      // Валидация формата JSON массива дней недели
      try {
        const days = JSON.parse(input.defaultWorkDays) as unknown;
        if (!Array.isArray(days) || !days.every(d => typeof d === 'number' && d >= 1 && d <= 7)) {
          throw new Error('defaultWorkDays must be JSON array of numbers 1-7');
        }
      } catch {
        throw new Error('defaultWorkDays must be valid JSON array of numbers 1-7');
      }
      updateData.defaultWorkDays = input.defaultWorkDays;
    }

    if (input.typingSimulationEnabled !== undefined) {
      updateData.typingSimulationEnabled = input.typingSimulationEnabled;
    }

    if (input.typingSpeedCharsPerSec !== undefined) {
      if (input.typingSpeedCharsPerSec < 1) {
        throw new Error('typingSpeedCharsPerSec must be at least 1');
      }
      updateData.typingSpeedCharsPerSec = input.typingSpeedCharsPerSec;
    }

    if (input.maxRetriesOnError !== undefined) {
      if (input.maxRetriesOnError < 0) {
        throw new Error('maxRetriesOnError must be non-negative');
      }
      updateData.maxRetriesOnError = input.maxRetriesOnError;
    }

    if (input.retryDelayMs !== undefined) {
      if (input.retryDelayMs < 0) {
        throw new Error('retryDelayMs must be non-negative');
      }
      updateData.retryDelayMs = input.retryDelayMs;
    }

    if (input.pauseOnCriticalError !== undefined) {
      updateData.pauseOnCriticalError = input.pauseOnCriticalError;
    }

    if (input.profileHealthCheckIntervalMs !== undefined) {
      if (input.profileHealthCheckIntervalMs < 5000) {
        throw new Error('profileHealthCheckIntervalMs must be at least 5000ms');
      }
      updateData.profileHealthCheckIntervalMs = input.profileHealthCheckIntervalMs;
    }

    if (input.autoResumeAfterRestart !== undefined) {
      updateData.autoResumeAfterRestart = input.autoResumeAfterRestart;
    }

    if (input.keepCompletedCampaignsDays !== undefined) {
      if (input.keepCompletedCampaignsDays < 1) {
        throw new Error('keepCompletedCampaignsDays must be at least 1');
      }
      updateData.keepCompletedCampaignsDays = input.keepCompletedCampaignsDays;
    }

    if (input.warmupEnabled !== undefined) {
      updateData.warmupEnabled = input.warmupEnabled;
    }

    if (input.warmupDay1To3Limit !== undefined) {
      if (input.warmupDay1To3Limit < 1) {
        throw new Error('warmupDay1To3Limit must be at least 1');
      }
      updateData.warmupDay1To3Limit = input.warmupDay1To3Limit;
    }

    if (input.warmupDay4To7Limit !== undefined) {
      if (input.warmupDay4To7Limit < 1) {
        throw new Error('warmupDay4To7Limit must be at least 1');
      }
      updateData.warmupDay4To7Limit = input.warmupDay4To7Limit;
    }

    // Обновляем настройки
    const updated = await this.repository.updateGlobalSettings(
      existing.id,
      updateData,
      updatedBy
    );

    return this.formatSettings(updated);
  }

  /**
   * Получить задержку между контактами
   */
  async getContactDelay(): Promise<number> {
    const settings = await this.repository.getOrCreate();
    return settings.delayBetweenContactsMs;
  }

  /**
   * Получить задержку между сообщениями в цепочке
   */
  async getMessageDelay(): Promise<number> {
    const settings = await this.repository.getOrCreate();
    return settings.delayBetweenMessagesMs;
  }

  /**
   * Проверить, находится ли текущее время в рабочих часах
   * 
   * @param customStart - Опциональное переопределение начала (HH:mm)
   * @param customEnd - Опциональное переопределение конца (HH:mm)
   * @param customDays - Опциональное переопределение рабочих дней
   */
  async isWithinWorkHours(
    customStart?: string,
    customEnd?: string,
    customDays?: number[]
  ): Promise<boolean> {
    const settings = await this.repository.getOrCreate();
    const now = new Date();
    
    // Получаем рабочие дни
    const workDays = customDays || JSON.parse(settings.defaultWorkDays) as number[];
    
    // Проверяем день недели (1 = Пн, 7 = Вс)
    const dayOfWeek = now.getDay() === 0 ? 7 : now.getDay();
    if (!workDays.includes(dayOfWeek)) {
      return false;
    }

    // Проверяем время
    const startTime = customStart || settings.defaultWorkHoursStart;
    const endTime = customEnd || settings.defaultWorkHoursEnd;
    
    const currentTime = now.toTimeString().slice(0, 5); // HH:mm
    
    return currentTime >= startTime && currentTime < endTime;
  }

  /**
   * Проверка формата времени HH:mm
   */
  private isValidTime(time: string): boolean {
    return /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(time);
  }

  /**
   * Форматирование настроек с парсингом JSON полей
   */
  private formatSettings(settings: CampaignGlobalSettings): CampaignGlobalSettingsFormatted {
    return {
      ...settings,
      defaultWorkDays: JSON.parse(settings.defaultWorkDays) as number[],
    };
  }
}




