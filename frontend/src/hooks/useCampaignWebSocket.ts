import { useEffect, useRef } from 'react';
import { wsService } from '@/utils/websocket';
import type {
  CampaignProgressPayload,
  CampaignStatusPayload,
  CampaignMessagePayload,
  CampaignErrorPayload,
  CampaignCompletedPayload,
} from '@/types/websocket';

type Handlers = {
  onProgress?: (data: CampaignProgressPayload) => void;
  onStatus?: (data: CampaignStatusPayload) => void;
  onMessage?: (data: CampaignMessagePayload) => void;
  onError?: (data: CampaignErrorPayload) => void;
  onCompleted?: (data: CampaignCompletedPayload) => void;
};

/**
 * Подписка на WebSocket события кампании.
 * Автоматически подписывается на канал campaign:{id} и снимает подписку при размонтировании.
 * Использует ref, чтобы избежать пересоздания подписок при каждом рендере.
 */
export function useCampaignWebSocket(campaignId: string | undefined, handlers: Handlers = {}) {
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!campaignId) return;

    const channel = `campaign:${campaignId}`;
    wsService.joinChannel(channel);

    const { onProgress, onStatus, onMessage, onError, onCompleted } = handlersRef.current;

    if (onProgress) wsService.subscribe('campaign:progress', onProgress);
    if (onStatus) wsService.subscribe('campaign:status', onStatus);
    if (onMessage) wsService.subscribe('campaign:message', onMessage);
    if (onError) wsService.subscribe('campaign:error', onError);
    if (onCompleted) wsService.subscribe('campaign:completed', onCompleted);

    return () => {
      wsService.leaveChannel(channel);
      if (onProgress) wsService.unsubscribe('campaign:progress', onProgress);
      if (onStatus) wsService.unsubscribe('campaign:status', onStatus);
      if (onMessage) wsService.unsubscribe('campaign:message', onMessage);
      if (onError) wsService.unsubscribe('campaign:error', onError);
      if (onCompleted) wsService.unsubscribe('campaign:completed', onCompleted);
    };
  }, [campaignId]);
}

