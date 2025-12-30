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
  delayBetweenMessagesMs?: number;
  delayBetweenContactsMs?: number;
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
  private delayBetweenMessagesMs?: number;
  private delayBetweenContactsMs?: number;
  private typingSimulationEnabled?: boolean;
  private typingDelayMs?: { minMs: number; maxMs: number };
  private lastClientId: string | null = null;
  private universalTarget?: UniversalTarget | null;
  private templateText: string | null = null;
  private templateItems: Array<{ type: 'TEXT' | 'FILE'; content?: string | null; filePath?: string | null; orderIndex: number }> = [];
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

    // Помечаем профиль как занятый рассылкой
    // Это предотвращает переключение вкладок мониторингом статуса аккаунтов
    // Определяем мессенджер по типу кампании (можно уточнить позже при отправке)
    this.sender.markProfileBusy(this.profileId, 'whatsapp', this.campaignId);
    logger.debug('Profile marked as busy for campaign', { profileId: this.profileId, campaignId: this.campaignId });
    
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
          // Получаем элементы шаблона с подстановкой переменных клиента
          const processedItems = await this.getProcessedTemplateItems(msg.client, phone);

          // Проверяем, есть ли что отправлять
          if (processedItems.length === 0) {
            // Если нет элементов, помечаем как FAILED
            result = {
              messageId: msg.id,
              status: 'FAILED' as const,
              messenger: null,
              clientId,
              phoneId,
              errorMessage: 'Template has no text or file content',
            };
            await this.onMessageProcessed(result);
            continue;
          }

          // Собираем все элементы шаблона для ОДНОГО вызова sendMessage
          // Это гарантирует, что чат откроется один раз и все элементы уйдут в него
          const allTexts: string[] = [];
          const allAttachments: string[] = [];

          for (const item of processedItems) {
            if (item.type === 'TEXT' && item.content) {
              allTexts.push(item.content);
            } else if (item.type === 'FILE' && item.filePath) {
              allAttachments.push(item.filePath);
            }
          }

          // Объединяем все тексты в один (разделяем переносом строки)
          const combinedText = allTexts.length > 0 ? allTexts.join('\n') : undefined;

          // Отправляем все элементы ОДНИМ вызовом sendMessage
          // Это предотвращает переключение чата между текстом и файлами
          result = await this.sendWithHandling({
            messageId: msg.id,
            messenger,
            phone,
            text: combinedText,
            attachments: allAttachments.length > 0 ? allAttachments : undefined,
            clientId,
            phoneId,
            waStatus: msg.clientPhone?.whatsAppStatus ?? 'Unknown' as MessengerStatus,
            tgStatus: msg.clientPhone?.telegramStatus ?? 'Unknown' as MessengerStatus,
            sendDelayMs: this.delayBetweenMessagesMs,
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

    // Освобождаем профиль после завершения цикла обработки
    this.sender.markProfileFree(this.profileId);
    logger.debug('Profile marked as free after campaign completion', { profileId: this.profileId, campaignId: this.campaignId });
  }

  /**
   * Остановка воркера
   */
  stop(): Promise<void> {
    this.running = false;
    
    // Освобождаем профиль - он больше не занят рассылкой
    this.sender.markProfileFree(this.profileId);
    logger.debug('Profile marked as free after campaign stop', { profileId: this.profileId, campaignId: this.campaignId });
    
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
    attachments?: string[]; // Пути к файлам из шаблона
    clientId: string | null;
    phoneId: string | null;
    waStatus: MessengerStatus;
    tgStatus: MessengerStatus;
    sendDelayMs?: number;
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
          text: input.text,
          attachments: input.attachments, // Передаем файлы из шаблона
          simulateTyping: this.typingSimulationEnabled,
          typingDelayRange: this.typingDelayMs,
          sendDelayMs: input.sendDelayMs,
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

      const trySend = async (messenger: MessengerType, skipSendDelay = false) => {
        const res = await this.sender.sendMessage({
          messenger,
          phone: input.phone,
          text: input.text,
          attachments: input.attachments, // Передаем файлы из шаблона
          simulateTyping: this.typingSimulationEnabled,
          typingDelayRange: this.typingDelayMs,
          sendDelayMs: input.sendDelayMs,
          hasWhatsApp: hasWa,
          hasTelegram: hasTg,
          universalTarget: this.universalTarget,
          profileId: this.profileId,
          skipSendDelay, // Пропускаем задержку для второго мессенджера в режиме BOTH
        });
        tried.push({ messenger, result: res });
        if (res.success) {
          await this.updatePhoneStatus(input.phoneId, messenger);
        }
        return res;
      };

      if (this.universalTarget === 'BOTH') {
        // В режиме BOTH отправляем в оба мессенджера БЕЗ паузы между ними
        // Пауза должна быть только между контактами, а не между мессенджерами для одного контакта
        if (hasWa) {
          await trySend('WHATSAPP', false); // Первый мессенджер - с задержкой
        }
        if (hasTg) {
          await trySend('TELEGRAM', true); // Второй мессенджер - БЕЗ задержки (для того же контакта)
        }
      } else if (this.universalTarget === 'TELEGRAM_FIRST') {
        // В режиме TELEGRAM_FIRST сначала пробуем Telegram, если не удалось - WhatsApp
        // Это fallback, поэтому задержка нужна для обоих (разные попытки)
        if (hasTg) {
          const res = await trySend('TELEGRAM', false);
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
        if (hasWa) {
          await trySend('WHATSAPP', false); // Fallback - с задержкой
        }
      } else {
        // WHATSAPP_FIRST или undefined
        // В режиме WHATSAPP_FIRST сначала пробуем WhatsApp, если не удалось - Telegram
        // Это fallback, поэтому задержка нужна для обоих (разные попытки)
        if (hasWa) {
          const res = await trySend('WHATSAPP', false);
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
        if (hasTg) {
          await trySend('TELEGRAM', false); // Fallback - с задержкой
        }
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
    if (!this.delayBetweenMessagesMs || this.delayBetweenMessagesMs <= 0) {
      return;
    }
    await this.delay(this.delayBetweenMessagesMs);
  }

  private async applyContactDelay(): Promise<void> {
    if (!this.delayBetweenContactsMs || this.delayBetweenContactsMs <= 0) {
      return;
    }
    await this.delay(this.delayBetweenContactsMs);
  }

  private async delay(ms: number): Promise<void> {
    if (ms <= 0) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Загрузка шаблона кампании
   * Загружает все элементы шаблона (TEXT и FILE) для поддержки мульти шаблонов
   */
  private async loadTemplate(): Promise<void> {
    try {
      const campaign = await prisma.campaign.findUnique({
        where: { id: this.campaignId },
        include: {
          template: {
            include: {
              items: {
                orderBy: { orderIndex: 'asc' }, // Загружаем все элементы по порядку
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
        this.templateItems = [];
        return;
      }

      // Сохраняем все элементы шаблона
      this.templateItems = campaign.template.items.map(item => ({
        type: item.type as 'TEXT' | 'FILE',
        content: item.content,
        filePath: item.filePath,
        orderIndex: item.orderIndex,
      }));

      // Объединяем все TEXT элементы шаблона для обратной совместимости
      // ВАЖНО: Для WhatsApp лучше отправлять каждую часть отдельным сообщением,
      // но для обратной совместимости оставляем объединение через \n
      const textItems = this.templateItems
        .filter(item => item.type === 'TEXT')
        .map((item) => item.content || '')
        .filter((text) => text.trim() !== '')
        .join('\n')
        .trim();

      this.templateText = textItems || null; // Может быть null, если только FILE элементы

      logger.debug('Campaign template loaded successfully', { 
        campaignId: this.campaignId,
        templateId: campaign.template.id,
        itemsCount: this.templateItems.length,
        textItemsCount: this.templateItems.filter(i => i.type === 'TEXT').length,
        fileItemsCount: this.templateItems.filter(i => i.type === 'FILE').length,
        textLength: this.templateText?.length || 0
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to load campaign template', { 
        error: errorMsg,
        campaignId: this.campaignId 
      });
      this.templateText = null;
      this.templateItems = [];
    }
  }

  /**
   * Получение обработанного текста шаблона с подстановкой переменных клиента
   * Возвращает текст из TEXT элементов шаблона
   * @deprecated Используйте getProcessedTemplateItems для отправки каждого элемента отдельно
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

  /**
   * Получение обработанных элементов шаблона с подстановкой переменных клиента
   * Возвращает массив элементов (TEXT и FILE) в порядке orderIndex
   */
  private async getProcessedTemplateItems(
    client: WorkerMessage['client'],
    phone: string
  ): Promise<Array<{ type: 'TEXT' | 'FILE'; content?: string; filePath?: string }>> {
    // Если шаблон не загружен, возвращаем пустой массив
    if (this.templateItems.length === 0) {
      return [];
    }

    // Подготавливаем данные клиента для подстановки
    const clientData: ClientData = client ? {
      firstName: client.firstName || '',
      lastName: client.lastName || '',
      middleName: client.middleName || null,
      phone: phone || '',
      groupName: client.group?.name || null,
      regionName: client.region?.name || null,
    } : {
      firstName: '',
      lastName: '',
      middleName: null,
      phone: phone || '',
      groupName: null,
      regionName: null,
    };

    // Обрабатываем каждый элемент шаблона
    const processedItems: Array<{ type: 'TEXT' | 'FILE'; content?: string; filePath?: string }> = [];

    for (const item of this.templateItems) {
      if (item.type === 'TEXT' && item.content) {
        // Обрабатываем TEXT элемент с подстановкой переменных
        const processedContent = this.variableParser.replaceVariables(item.content, clientData);
        if (processedContent.trim().length > 0) {
          processedItems.push({
            type: 'TEXT',
            content: processedContent,
          });
        }
      } else if (item.type === 'FILE' && item.filePath && item.filePath.trim().length > 0) {
        // FILE элемент - просто добавляем путь к файлу
        processedItems.push({
          type: 'FILE',
          filePath: item.filePath,
        });
      }
    }

    return processedItems;
  }

  /**
   * Получение путей к файлам из шаблона
   * Возвращает массив путей к FILE элементам шаблона
   * @deprecated Используйте getProcessedTemplateItems для отправки каждого элемента отдельно
   */
  private getTemplateAttachments(): string[] {
    return this.templateItems
      .filter(item => item.type === 'FILE' && item.filePath && item.filePath.trim().length > 0)
      .map(item => item.filePath!)
      .filter((path): path is string => !!path);
  }
}

