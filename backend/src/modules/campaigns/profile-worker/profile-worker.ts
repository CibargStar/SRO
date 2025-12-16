/**
 * ProfileWorker
 *
 * Обрабатывает очередь сообщений для одного профиля кампании.
 * Берёт pending сообщения chunk-ами и отправляет через MessageSenderService.
 */

import { CampaignMessageRepository } from '../campaigns.repository';
import { LoadBalancerService } from '../load-balancer';
import { MessageSenderService, SendMessageResult } from '../message-sender';
import { MessengerType, UniversalTarget, MessengerStatus } from '@prisma/client';
import prisma from '../../../config/database';
import { VariableParserService, ClientData } from '../../templates/variable-parser.service';
import logger from '../../../config/logger';

interface ProfileWorkerConfig {
  campaignId: string;
  profileId: string;
  chunkSize: number;
  messageRepository: CampaignMessageRepository;
  loadBalancer: LoadBalancerService;
  sender: MessageSenderService;
  universalTarget?: UniversalTarget | null;
  pauseMode: 1 | 2;
  delayBetweenMessagesMs?: { minMs: number; maxMs: number };
  delayBetweenContactsMs?: { minMs: number; maxMs: number };
  typingSimulationEnabled?: boolean;
  typingDelayMs?: { minMs: number; maxMs: number };
  onMessageProcessed: (result: {
    messageId: string;
    status: 'SENT' | 'FAILED' | 'SKIPPED';
    messenger: SendMessageResult['messenger'] | null;
    clientId: string | null;
    phoneId: string | null;
    errorMessage?: string;
  }) => Promise<void>;
}

type WorkerMessage = {
  id: string;
  messenger: MessengerType | null;
  clientPhone?: { id: string; phone: string; whatsAppStatus: MessengerStatus; telegramStatus: MessengerStatus };
  client?: { 
    id: string; 
    firstName?: string | null;
    lastName?: string | null;
    middleName?: string | null;
    group?: { name: string } | null;
    region?: { name: string } | null;
  } | null;
};

export class ProfileWorker {
  private campaignId: string;
  private profileId: string;
  private chunkSize: number;
  private messageRepository: CampaignMessageRepository;
  private sender: MessageSenderService;
  private onMessageProcessed: ProfileWorkerConfig['onMessageProcessed'];
  private running = false;
  private paused = false;
  private pauseMode: 1 | 2;
  private delayBetweenMessagesMs?: { minMs: number; maxMs: number };
  private delayBetweenContactsMs?: { minMs: number; maxMs: number };
  private typingSimulationEnabled?: boolean;
  private typingDelayMs?: { minMs: number; maxMs: number };
  private lastClientId: string | null = null;
  private universalTarget?: UniversalTarget | null;
  private templateText: string | null = null;
  private variableParser: VariableParserService;

  constructor(config: ProfileWorkerConfig) {
    this.campaignId = config.campaignId;
    this.profileId = config.profileId;
    this.chunkSize = config.chunkSize;
    this.messageRepository = config.messageRepository;
    this.sender = config.sender;
    this.onMessageProcessed = config.onMessageProcessed;
    this.pauseMode = config.pauseMode;
    this.delayBetweenMessagesMs = config.delayBetweenMessagesMs;
    this.delayBetweenContactsMs = config.delayBetweenContactsMs;
    this.typingSimulationEnabled = config.typingSimulationEnabled;
    this.typingDelayMs = config.typingDelayMs;
    this.universalTarget = config.universalTarget;
    this.variableParser = new VariableParserService();
  }

  /**
   * Запуск воркера (обрабатывает до остановки)
   */
  async start(): Promise<void> {
    this.running = true;
    this.paused = false;
    
    // Загружаем шаблон кампании при старте
    await this.loadTemplate();
    
    while (this.running) {
      if (this.paused) {
        await this.delay(200);
        continue;
      }

      const messages = (await this.messageRepository.getChunkForProfile(
        this.campaignId,
        this.profileId,
        this.chunkSize
      )) as WorkerMessage[];

      if (messages.length === 0) {
        // Нет работы — маленькая пауза
        await new Promise((r) => setTimeout(r, 500));
        continue;
      }

      for (const msg of messages) {
        if (!this.running) {
          break;
        }
        if (this.paused) {
          break;
        }

        // Помечаем PROCESSING
        try {
          await this.messageRepository.update(msg.id, { status: 'PROCESSING' });
        } catch (error) {
          logger.error('Failed to mark message as PROCESSING', {
            messageId: msg.id,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
          // Продолжаем обработку, но логируем ошибку
        }

        // Определяем мессенджер (если не выбран — универсальный, решит executor/ sender)
        const messenger = msg.messenger ?? null;
        const phone = msg.clientPhone?.phone ?? '';
        const clientId = msg.client?.id ?? null;
        const phoneId = msg.clientPhone?.id ?? null;
        
        let result: {
          messageId: string;
          status: 'SENT' | 'FAILED' | 'SKIPPED';
          messenger: SendMessageResult['messenger'] | null;
          clientId: string | null;
          phoneId: string | null;
          errorMessage?: string;
        };

        try {
          // Получаем текст из шаблона с подстановкой переменных клиента
          const text = await this.getProcessedTemplateText(msg.client, phone);

          // Проверяем, есть ли что отправлять
          if (!text || text.trim() === '') {
            // Если текст пустой, помечаем как FAILED
            result = {
              messageId: msg.id,
              status: 'FAILED' as const,
              messenger: null,
              clientId,
              phoneId,
              errorMessage: 'Template text is empty or failed to load',
            };
            await this.onMessageProcessed(result);
            continue;
          }

          // Отправляем
          result = await this.sendWithHandling({
            messageId: msg.id,
            messenger,
            phone,
            text,
            clientId,
            phoneId,
            waStatus: msg.clientPhone?.whatsAppStatus ?? 'Unknown' as MessengerStatus,
            tgStatus: msg.clientPhone?.telegramStatus ?? 'Unknown' as MessengerStatus,
          });

          await this.onMessageProcessed(result);
        } catch (error) {
          // Обработка неожиданных ошибок при обработке сообщения
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          logger.error('Unexpected error processing message', {
            messageId: msg.id,
            error: errorMessage,
          });

          // Помечаем сообщение как FAILED
          result = {
            messageId: msg.id,
            status: 'FAILED' as const,
            messenger: null,
            clientId,
            phoneId,
            errorMessage: `Unexpected error: ${errorMessage}`,
          };
          await this.onMessageProcessed(result).catch((processError) => {
            logger.error('Failed to process failed message result', {
              messageId: msg.id,
              error: processError instanceof Error ? processError.message : 'Unknown error',
            });
          });
        }

        // Межсообщенческий тайминг
        await this.applyMessageDelay();

        // Пауза между контактами согласно режиму (только при успешной отправке)
        if (result.status === 'SENT') {
          if (this.pauseMode === 1) {
            await this.applyContactDelay();
          } else if (this.pauseMode === 2) {
            if (this.lastClientId === null || this.lastClientId !== clientId) {
              await this.applyContactDelay();
            }
          }
          this.lastClientId = clientId;
        }
      }
    }
  }

  /**
   * Остановка воркера
   */
  stop(): Promise<void> {
    this.running = false;
    return Promise.resolve();
  }

  /**
   * Пауза воркера
   */
  pause(): Promise<void> {
    this.paused = true;
    return Promise.resolve();
  }

  /**
   * Возобновление воркера
   */
  resume(): Promise<void> {
    this.paused = false;
    return Promise.resolve();
  }

  /**
   * Отправка сообщения с обработкой результата
   */
  private async sendWithHandling(input: {
    messageId: string;
    messenger: 'WHATSAPP' | 'TELEGRAM' | null;
    phone: string;
    text?: string;
    clientId: string | null;
    phoneId: string | null;
    waStatus: MessengerStatus;
    tgStatus: MessengerStatus;
  }): Promise<{
    messageId: string;
    status: 'SENT' | 'FAILED' | 'SKIPPED';
    messenger: SendMessageResult['messenger'] | null;
    clientId: string | null;
    phoneId: string | null;
    errorMessage?: string;
  }> {
    try {
      const hasWa = input.waStatus !== 'Invalid';
      const hasTg = input.tgStatus !== 'Invalid';

      // Если мессенджер задан явно (не universal), отправляем один раз
      if (input.messenger) {
        const sendResult = await this.sender.sendMessage({
          messenger: input.messenger,
          phone: input.phone,
          text: input.text ?? '',
          simulateTyping: this.typingSimulationEnabled,
          typingDelayRange: this.typingDelayMs,
          sendDelayRange: this.delayBetweenMessagesMs,
          hasWhatsApp: hasWa,
          hasTelegram: hasTg,
          universalTarget: this.universalTarget,
          profileId: this.profileId,
        });

        if (sendResult.success) {
          await this.updatePhoneStatus(input.phoneId, sendResult.messenger);
          return {
            messageId: input.messageId,
            status: 'SENT',
            messenger: sendResult.messenger,
            clientId: input.clientId,
            phoneId: input.phoneId,
          };
        }

        return {
          messageId: input.messageId,
          status: 'FAILED',
          messenger: sendResult.messenger,
          clientId: input.clientId,
          phoneId: input.phoneId,
          errorMessage: sendResult.error,
        };
      }

      // UNIVERSAL / BOTH логика: пробуем по приоритету, для BOTH — обе попытки
      const tried: Array<{ messenger: MessengerType; result: SendMessageResult }> = [];

      const trySend = async (messenger: MessengerType) => {
        const res = await this.sender.sendMessage({
          messenger,
          phone: input.phone,
          text: input.text ?? '',
          simulateTyping: this.typingSimulationEnabled,
          typingDelayRange: this.typingDelayMs,
          sendDelayRange: this.delayBetweenMessagesMs,
          hasWhatsApp: hasWa,
          hasTelegram: hasTg,
          universalTarget: this.universalTarget,
          profileId: this.profileId,
        });
        tried.push({ messenger, result: res });
        if (res.success) {
          await this.updatePhoneStatus(input.phoneId, messenger);
        }
        return res;
      };

      if (this.universalTarget === 'BOTH') {
        if (hasWa) await trySend('WHATSAPP');
        if (hasTg) await trySend('TELEGRAM');
      } else if (this.universalTarget === 'TELEGRAM_FIRST') {
        if (hasTg) {
          const res = await trySend('TELEGRAM');
          if (res.success) {
            return {
              messageId: input.messageId,
              status: 'SENT',
              messenger: res.messenger,
              clientId: input.clientId,
              phoneId: input.phoneId,
            };
          }
        }
        if (hasWa) await trySend('WHATSAPP');
      } else {
        // WHATSAPP_FIRST или undefined
        if (hasWa) {
          const res = await trySend('WHATSAPP');
          if (res.success) {
            return {
              messageId: input.messageId,
              status: 'SENT',
              messenger: res.messenger,
              clientId: input.clientId,
              phoneId: input.phoneId,
            };
          }
        }
        if (hasTg) await trySend('TELEGRAM');
      }

      // Итог: если были успешные отправки — считаем SENT, иначе FAILED
      const success = tried.find((t) => t.result.success);
      if (success) {
        return {
          messageId: input.messageId,
          status: 'SENT',
          messenger: success.messenger,
          clientId: input.clientId,
          phoneId: input.phoneId,
        };
      }

      const lastError = tried.find((t) => !t.result.success)?.result.error;
      return {
        messageId: input.messageId,
        status: 'FAILED',
        messenger: tried.at(-1)?.messenger ?? null,
        clientId: input.clientId,
        phoneId: input.phoneId,
        errorMessage: lastError ?? 'Universal send failed',
      };
    } catch (error: unknown) {
      return {
        messageId: input.messageId,
        status: 'FAILED',
        messenger: input.messenger,
        clientId: input.clientId,
        phoneId: input.phoneId,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async updatePhoneStatus(phoneId: string | null, messenger: MessengerType | null): Promise<void> {
    if (!phoneId || !messenger) {
      return;
    }
    if (messenger === 'WHATSAPP') {
      await prisma.clientPhone.update({
        where: { id: phoneId },
        data: { whatsAppStatus: 'Valid' },
      });
    } else if (messenger === 'TELEGRAM') {
      await prisma.clientPhone.update({
        where: { id: phoneId },
        data: { telegramStatus: 'Valid' },
      });
    }
  }

  private async applyMessageDelay(): Promise<void> {
    if (!this.delayBetweenMessagesMs) {
      return;
    }
    const delayMs = this.randomInRange(this.delayBetweenMessagesMs.minMs, this.delayBetweenMessagesMs.maxMs);
    await this.delay(delayMs);
  }

  private async applyContactDelay(): Promise<void> {
    if (!this.delayBetweenContactsMs) {
      return;
    }
    const delayMs = this.randomInRange(this.delayBetweenContactsMs.minMs, this.delayBetweenContactsMs.maxMs);
    await this.delay(delayMs);
  }

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

  /**
   * Загрузка шаблона кампании
   */
  private async loadTemplate(): Promise<void> {
    try {
      const campaign = await prisma.campaign.findUnique({
        where: { id: this.campaignId },
        include: {
          template: {
            include: {
              items: {
                where: { type: 'TEXT' },
                orderBy: { orderIndex: 'asc' },
              },
            },
          },
        },
      });

      if (!campaign?.template) {
        logger.warn('Campaign template not found', { 
          campaignId: this.campaignId 
        });
        this.templateText = null;
        return;
      }

      // Объединяем все TEXT элементы шаблона
      const textItems = campaign.template.items
        .map((item) => item.content || '')
        .filter((text) => text.trim() !== '')
        .join('\n')
        .trim();

      if (!textItems) {
        logger.warn('Campaign template has no text content', { 
          campaignId: this.campaignId,
          templateId: campaign.template.id,
          itemsCount: campaign.template.items.length
        });
        this.templateText = null;
        return;
      }

      this.templateText = textItems;
      logger.debug('Campaign template loaded successfully', { 
        campaignId: this.campaignId,
        templateId: campaign.template.id,
        textLength: this.templateText.length
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to load campaign template', { 
        error: errorMsg,
        campaignId: this.campaignId 
      });
      this.templateText = null;
    }
  }

  /**
   * Получение обработанного текста шаблона с подстановкой переменных клиента
   */
  private async getProcessedTemplateText(
    client: WorkerMessage['client'],
    phone: string
  ): Promise<string> {
    // Если шаблон не загружен, возвращаем пустую строку
    if (!this.templateText) {
      return '';
    }

    // Если нет данных клиента, возвращаем шаблон без обработки
    if (!client) {
      return this.templateText;
    }

    // Подготавливаем данные клиента для подстановки
    const clientData: ClientData = {
      firstName: client.firstName || '',
      lastName: client.lastName || '',
      middleName: client.middleName || null,
      phone: phone || '',
      groupName: client.group?.name || null,
      regionName: client.region?.name || null,
    };

    // Обрабатываем шаблон с подстановкой переменных
    return this.variableParser.replaceVariables(this.templateText, clientData);
  }
}

