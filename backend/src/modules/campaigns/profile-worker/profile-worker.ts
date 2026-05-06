/**
 * ProfileWorker
 *
 * Обрабатывает очередь сообщений для одного профиля кампании.
 * Берёт pending сообщения chunk-ами и отправляет через MessageSenderService.
 */

import { CampaignMessageRepository } from '../campaigns.repository';
import { LoadBalancerService } from '../load-balancer';
import { MessageSenderService, SendMessageResult } from '../message-sender';
import { MessengerType, UniversalTarget, MessengerStatus, MessengerTarget } from '@prisma/client';
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
  messengerTarget?: MessengerTarget;
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

// Тип для хранения шаблона с его элементами
interface TemplateWithItems {
  id: string;
  name: string;
  items: Array<{ type: 'TEXT' | 'FILE'; content?: string | null; filePath?: string | null; orderIndex: number }>;
}

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
  private messengerTarget?: MessengerTarget;
  private universalTarget?: UniversalTarget | null;
  
  // Множественные шаблоны для ротации (round-robin)
  private templates: TemplateWithItems[] = [];
  private currentTemplateIndex: number = 0;
  private messagesSentCount: number = 0;
  
  // Текущие активные элементы шаблона для обработки
  private templateItems: Array<{ type: 'TEXT' | 'FILE'; content?: string | null; filePath?: string | null; orderIndex: number }> = [];
  private variableParser: VariableParserService;

  constructor(config: ProfileWorkerConfig) {
    this.campaignId = config.campaignId;
    this.profileId = config.profileId;
    this.chunkSize = config.chunkSize;
    this.messageRepository = config.messageRepository;
    this.sender = config.sender;
    this.messengerTarget = config.messengerTarget;
    this.onMessageProcessed = config.onMessageProcessed;
    this.pauseMode = config.pauseMode;
    this.delayBetweenMessagesMs = config.delayBetweenMessagesMs;
    this.delayBetweenContactsMs = config.delayBetweenContactsMs;
    this.typingSimulationEnabled = config.typingSimulationEnabled;
    this.typingDelayMs = config.typingDelayMs;
    // Legacy-совместимость: старые кампании с BOTH трактуем как WHATSAPP_FIRST.
    this.universalTarget =
      config.universalTarget === 'BOTH' ? 'WHATSAPP_FIRST' : config.universalTarget;
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
    // Это предотвращает переключение вкладок мониторингом статуса аккаунтов.
    // Для универсального режима выбираем первый канал по приоритету.
    const busyMessenger: 'whatsapp' | 'telegram' =
      this.messengerTarget === 'TELEGRAM_ONLY' ||
      (this.messengerTarget === 'UNIVERSAL' && this.universalTarget === 'TELEGRAM_FIRST')
        ? 'telegram'
        : 'whatsapp';
    this.sender.markProfileBusy(this.profileId, busyMessenger, this.campaignId);
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

          // Отправляем батчами по мессенджеру:
          // 1) все части мультишаблона в первом канале;
          // 2) затем все части во втором (для UNIVERSAL).
          const fixedMessenger: 'WHATSAPP' | 'TELEGRAM' | null = messenger;
          const hasWa = (msg.clientPhone?.whatsAppStatus ?? 'Unknown') !== 'Invalid';
          const hasTg = (msg.clientPhone?.telegramStatus ?? 'Unknown') !== 'Invalid';

          const baseOrder: Array<'WHATSAPP' | 'TELEGRAM'> =
            this.universalTarget === 'TELEGRAM_FIRST'
              ? ['TELEGRAM', 'WHATSAPP']
              : ['WHATSAPP', 'TELEGRAM'];
          const messengerOrder: Array<'WHATSAPP' | 'TELEGRAM'> = fixedMessenger
            ? [fixedMessenger]
            : baseOrder.filter((m) => (m === 'WHATSAPP' ? hasWa : hasTg));

          if (messengerOrder.length === 0) {
            result = {
              messageId: msg.id,
              status: 'FAILED' as const,
              messenger: null,
              clientId,
              phoneId,
              errorMessage: 'No valid messenger channels for this contact',
            };
            await this.onMessageProcessed(result);
            continue;
          }

          let lastSuccessResult: {
            messageId: string;
            status: 'SENT' | 'FAILED' | 'SKIPPED';
            messenger: SendMessageResult['messenger'] | null;
            clientId: string | null;
            phoneId: string | null;
            errorMessage?: string;
          } | null = null;
          const channelFailures: string[] = [];
          let sentPartsTotal = 0;
          let isFirstSendOverall = true;

          for (const channel of messengerOrder) {
            let channelFailed = false;

            for (const item of processedItems) {
              const textPart = item.type === 'TEXT' ? item.content : undefined;
              const attachmentPart = item.type === 'FILE' && item.filePath ? [item.filePath] : undefined;

              if (!textPart && !attachmentPart) {
                continue;
              }

              logger.debug('Sending template item', {
                phone,
                messageId: msg.id,
                messenger: channel,
                itemType: item.type,
                textLength: textPart?.length ?? 0,
                attachmentsCount: attachmentPart?.length ?? 0,
                attachmentPath: attachmentPart?.[0] ?? null,
                sentPartsTotal,
              });

              const partResult = await this.sendWithHandling({
                messageId: msg.id,
                messenger: channel,
                phone,
                text: textPart,
                attachments: attachmentPart,
                clientId,
                phoneId,
                waStatus: msg.clientPhone?.whatsAppStatus ?? 'Unknown' as MessengerStatus,
                tgStatus: msg.clientPhone?.telegramStatus ?? 'Unknown' as MessengerStatus,
                // Применяем задержку только перед первой фактической отправкой по контакту.
                sendDelayMs: isFirstSendOverall ? this.delayBetweenMessagesMs : 0,
              });
              isFirstSendOverall = false;

              if (partResult.status !== 'SENT') {
                channelFailed = true;
                channelFailures.push(`${channel}: ${partResult.errorMessage ?? 'Unknown send error'}`);
                break;
              }

              lastSuccessResult = partResult;
              sentPartsTotal++;
            }

            // Переходим к следующему мессенджеру только после завершения текущего батча.
            if (channelFailed) {
              continue;
            }
          }

          if (channelFailures.length > 0) {
            result = {
              messageId: msg.id,
              status: 'FAILED' as const,
              messenger: lastSuccessResult?.messenger ?? messengerOrder[messengerOrder.length - 1] ?? null,
              clientId,
              phoneId,
              errorMessage: `Failed channels: ${channelFailures.join(' | ')}`,
            };
          } else if (sentPartsTotal === 0 || !lastSuccessResult) {
            result = {
              messageId: msg.id,
              status: 'FAILED' as const,
              messenger: fixedMessenger,
              clientId,
              phoneId,
              errorMessage: 'Template has no sendable text or file parts',
            };
          } else {
            result = {
              ...lastSuccessResult,
              messageId: msg.id,
              clientId,
              phoneId,
            };
          }

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

        // Пауза между получателями:
        // - применяем только при успешной отправке (SENT);
        // - при FAILED паузу пропускаем согласно бизнес-правилу.
        if (result.status === 'SENT') {
          if (this.pauseMode === 1) {
            await this.applyInterRecipientDelay();
          } else if (this.pauseMode === 2) {
            if (this.lastClientId === null || this.lastClientId !== clientId) {
              await this.applyInterRecipientDelay();
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

        await this.updatePhoneStatusByError(input.phoneId, sendResult.messenger, sendResult.error);

        return {
          messageId: input.messageId,
          status: 'FAILED',
          messenger: sendResult.messenger,
          clientId: input.clientId,
          phoneId: input.phoneId,
          errorMessage: sendResult.error,
        };
      }

      // UNIVERSAL логика: пробуем оба канала, universalTarget задает только порядок.
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
          skipSendDelay, // Пропускаем задержку для второго мессенджера для того же контакта
        });
        tried.push({ messenger, result: res });
        if (res.success) {
          await this.updatePhoneStatus(input.phoneId, messenger);
        } else {
          await this.updatePhoneStatusByError(input.phoneId, messenger, res.error);
        }
        return res;
      };

      // UNIVERSAL логика:
      // - всегда пытаемся отправить в оба мессенджера (если они валидны для номера);
      // - universalTarget определяет ТОЛЬКО порядок: кто идет первым.
      const orderedMessengers: MessengerType[] = this.universalTarget === 'TELEGRAM_FIRST'
        ? ['TELEGRAM', 'WHATSAPP']
        : ['WHATSAPP', 'TELEGRAM']; // WHATSAPP_FIRST и default

      for (const [index, messenger] of orderedMessengers.entries()) {
        // Пропускаем невалидные каналы для конкретного номера
        if (messenger === 'WHATSAPP' && !hasWa) {
          continue;
        }
        if (messenger === 'TELEGRAM' && !hasTg) {
          continue;
        }

        // Для второго мессенджера пропускаем межсообщенческую задержку:
        // это тот же контакт, просто второй канал.
        await trySend(messenger, index > 0);
      }

      // Итог для UNIVERSAL:
      // - успех только если ВСЕ реально попытанные каналы успешно отправили;
      // - если хоть один из попытанных каналов упал, считаем FAILED.
      if (tried.length === 0) {
        return {
          messageId: input.messageId,
          status: 'FAILED',
          messenger: null,
          clientId: input.clientId,
          phoneId: input.phoneId,
          errorMessage: 'No valid messenger channels for this contact',
        };
      }

      const allSucceeded = tried.every((t) => t.result.success);
      if (allSucceeded) {
        const firstSuccess = tried[0];
        return {
          messageId: input.messageId,
          status: 'SENT',
          messenger: firstSuccess?.messenger ?? null,
          clientId: input.clientId,
          phoneId: input.phoneId,
        };
      }

      const failedAttempts = tried.filter((t) => !t.result.success);
      const lastError = failedAttempts[failedAttempts.length - 1]?.result.error;
      const failedMessengers = failedAttempts.map((t) => t.messenger).join(', ');
      return {
        messageId: input.messageId,
        status: 'FAILED',
        messenger: tried.at(-1)?.messenger ?? null,
        clientId: input.clientId,
        phoneId: input.phoneId,
        errorMessage: lastError
          ? `Universal send failed for: ${failedMessengers}. Last error: ${lastError}`
          : `Universal send failed for: ${failedMessengers}`,
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

  private async updatePhoneStatusByError(
    phoneId: string | null,
    messenger: MessengerType | null,
    errorMessage?: string
  ): Promise<void> {
    if (!phoneId || !messenger || !errorMessage) {
      return;
    }

    const normalized = errorMessage.toLowerCase();

    const isWhatsAppInvalid =
      messenger === 'WHATSAPP' &&
      (
        normalized.includes('invalid phone number') ||
        normalized.includes('contact not found in whatsapp') ||
        normalized.includes('not registered in whatsapp')
      );

    const isTelegramUndeliverable =
      messenger === 'TELEGRAM' &&
      (
        normalized.includes('user_not_found') ||
        normalized.includes("doesn't seem to exist") ||
        normalized.includes('пользователь не найден') ||
        normalized.includes('premium_restriction') ||
        normalized.includes('only premium users can message') ||
        normalized.includes('принимает сообщения только от premium')
      );

    if (!isWhatsAppInvalid && !isTelegramUndeliverable) {
      return;
    }

    if (messenger === 'WHATSAPP') {
      await prisma.clientPhone.update({
        where: { id: phoneId },
        data: { whatsAppStatus: 'Invalid' },
      });
      return;
    }

    await prisma.clientPhone.update({
      where: { id: phoneId },
      data: { telegramStatus: 'Invalid' },
    });
  }

  /**
   * Пауза между получателями с учётом выбранного режима.
   *
   * ВАЖНО:
   * - pauseMode=2 (между клиентами): основной тайминг delayBetweenContactsMs.
   * - Если delayBetweenContactsMs не задан, используем fallback на delayBetweenMessagesMs
   *   чтобы не терять throttling из-за неполной конфигурации.
   * - pauseMode=1 (между номерами): используем delayBetweenMessagesMs.
   */
  private async applyInterRecipientDelay(): Promise<void> {
    const delayMs = this.resolveInterRecipientDelayMs();
    if (!delayMs || delayMs <= 0) {
      return;
    }
    await this.delay(delayMs);
  }

  private resolveInterRecipientDelayMs(): number {
    if (this.pauseMode === 2) {
      if (typeof this.delayBetweenContactsMs === 'number' && this.delayBetweenContactsMs > 0) {
        return this.delayBetweenContactsMs;
      }
      return this.delayBetweenMessagesMs ?? 0;
    }

    if (typeof this.delayBetweenMessagesMs === 'number' && this.delayBetweenMessagesMs > 0) {
      return this.delayBetweenMessagesMs;
    }
    return this.delayBetweenContactsMs ?? 0;
  }

  private async delay(ms: number): Promise<void> {
    if (ms <= 0) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Загрузка шаблонов кампании
   * Загружает все шаблоны из CampaignTemplate (многие-ко-многим связь)
   * для поддержки ротации шаблонов (round-robin)
   */
  private async loadTemplate(): Promise<void> {
    try {
      // Загружаем все шаблоны кампании через связующую таблицу campaign_templates
      const campaignTemplates = await prisma.campaignTemplate.findMany({
        where: { campaignId: this.campaignId },
        orderBy: { orderIndex: 'asc' },
        include: {
          template: {
            include: {
              items: {
                orderBy: { orderIndex: 'asc' },
              },
            },
          },
        },
      });

      if (campaignTemplates.length === 0) {
        // Fallback: пробуем загрузить через старую связь templateId (для обратной совместимости)
        const campaign = await prisma.campaign.findUnique({
          where: { id: this.campaignId },
          include: {
            template: {
              include: {
                items: {
                  orderBy: { orderIndex: 'asc' },
                },
              },
            },
          },
        });

        if (!campaign?.template) {
          logger.warn('Campaign templates not found', { 
            campaignId: this.campaignId 
          });
          this.templates = [];
          this.templateItems = [];
          return;
        }

        // Используем единственный шаблон из старой связи
        this.templates = [{
          id: campaign.template.id,
          name: campaign.template.name,
          items: campaign.template.items.map(item => ({
            type: item.type as 'TEXT' | 'FILE',
            content: item.content,
            filePath: item.filePath,
            orderIndex: item.orderIndex,
          })),
        }];
      } else {
        // Сохраняем все шаблоны для ротации
        this.templates = campaignTemplates.map(ct => ({
          id: ct.template.id,
          name: ct.template.name,
          items: ct.template.items.map(item => ({
            type: item.type as 'TEXT' | 'FILE',
            content: item.content,
            filePath: item.filePath,
            orderIndex: item.orderIndex,
          })),
        }));
      }

      // Сбрасываем индекс шаблона
      this.currentTemplateIndex = 0;
      this.messagesSentCount = 0;

      // Устанавливаем первый шаблон как активный для обратной совместимости
      this.setActiveTemplate(0);

      logger.info('Campaign templates loaded successfully', { 
        campaignId: this.campaignId,
        templateCount: this.templates.length,
        templateNames: this.templates.map(t => t.name),
        totalItemsCount: this.templates.reduce((sum, t) => sum + t.items.length, 0),
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to load campaign templates', { 
        error: errorMsg,
        campaignId: this.campaignId 
      });
      this.templates = [];
      this.templateItems = [];
    }
  }

  /**
   * Выбор следующего шаблона для отправки (round-robin)
   * Возвращает индекс выбранного шаблона
   */
  private selectNextTemplate(): number {
    if (this.templates.length === 0) {
      return 0;
    }

    // Round-robin: берём следующий шаблон по кругу
    const selectedIndex = this.currentTemplateIndex;
    this.currentTemplateIndex = (this.currentTemplateIndex + 1) % this.templates.length;
    this.messagesSentCount++;

    // Устанавливаем выбранный шаблон как активный
    this.setActiveTemplate(selectedIndex);

    logger.debug('Template selected for message (round-robin)', {
      campaignId: this.campaignId,
      selectedTemplateIndex: selectedIndex,
      selectedTemplateName: this.templates[selectedIndex]?.name,
      nextTemplateIndex: this.currentTemplateIndex,
      totalMessagesSent: this.messagesSentCount,
    });

    return selectedIndex;
  }

  /**
   * Установка активного шаблона (для использования в getProcessedTemplateItems)
   */
  private setActiveTemplate(index: number): void {
    if (index < 0 || index >= this.templates.length) {
      return;
    }

    const template = this.templates[index];
    this.templateItems = template.items;
  }

  /**
   * Получение обработанных элементов шаблона с подстановкой переменных клиента
   * Возвращает массив элементов (TEXT и FILE) в порядке orderIndex
   * Автоматически выбирает следующий шаблон через round-robin ротацию
   */
  private async getProcessedTemplateItems(
    client: WorkerMessage['client'],
    phone: string
  ): Promise<Array<{ type: 'TEXT' | 'FILE'; content?: string; filePath?: string }>> {
    // Выбираем следующий шаблон (round-robin) перед обработкой
    if (this.templates.length > 1) {
      this.selectNextTemplate();
    }

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

    logger.debug('Processing template items', {
      totalItems: this.templateItems.length,
      items: this.templateItems.map(item => ({
        type: item.type,
        hasContent: !!item.content,
        hasFilePath: !!item.filePath,
        filePath: item.filePath,
        orderIndex: item.orderIndex,
      })),
      phone,
    });

    for (const item of this.templateItems) {
      if (item.type === 'TEXT' && item.content) {
        // Обрабатываем TEXT элемент с подстановкой переменных
        const processedContent = this.variableParser.replaceVariables(item.content, clientData);
        if (processedContent.trim().length > 0) {
          processedItems.push({
            type: 'TEXT',
            content: processedContent,
          });
          logger.debug('TEXT item processed', { orderIndex: item.orderIndex, contentLength: processedContent.length });
        }
      } else if (item.type === 'FILE') {
        // FILE элемент - проверяем и добавляем путь к файлу
        if (item.filePath && item.filePath.trim().length > 0) {
          processedItems.push({
            type: 'FILE',
            filePath: item.filePath,
          });
          logger.info('FILE item processed and added', { 
            orderIndex: item.orderIndex, 
            filePath: item.filePath,
            phone 
          });
        } else {
          logger.warn('FILE item skipped - filePath is empty or null', {
            orderIndex: item.orderIndex,
            filePath: item.filePath,
            phone,
          });
        }
      }
    }

    logger.debug('Template items processing completed', {
      phone,
      processedItemsCount: processedItems.length,
      textItemsCount: processedItems.filter(i => i.type === 'TEXT').length,
      fileItemsCount: processedItems.filter(i => i.type === 'FILE').length,
    });

    return processedItems;
  }

}

