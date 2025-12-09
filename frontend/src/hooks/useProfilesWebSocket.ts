import { useEffect } from 'react';
import { wsService } from '@/utils/websocket';

type ProfileStatusPayload = {
  profileId: string;
  status: string;
  lastActiveAt: string | null;
};

type ProfileResourcesPayload = {
  profileId: string;
  pid: number;
  cpuUsage: number;
  memoryUsage: number;
  memoryUsagePercent: number;
  timestamp: string;
};

type ProfileHealthPayload = {
  profileId: string;
  status: string;
  details: Record<string, unknown>;
  timestamp: string;
};

type ProfileAlertPayload = {
  id: string;
  profileId: string;
  userId: string;
  type: string;
  severity: string;
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
  timestamp: string;
  read: boolean;
};

interface Handlers {
  onStatus?: (payload: ProfileStatusPayload) => void;
  onResources?: (payload: ProfileResourcesPayload) => void;
  onHealth?: (payload: ProfileHealthPayload) => void;
  onAlert?: (payload: ProfileAlertPayload) => void;
}

export function useProfilesWebSocket(handlers: Handlers = {}) {
  useEffect(() => {
    const { onStatus, onResources, onHealth, onAlert } = handlers;

    if (onStatus) wsService.subscribe('profile:status', onStatus);
    if (onResources) wsService.subscribe('profile:resources', onResources);
    if (onHealth) wsService.subscribe('profile:health', onHealth);
    if (onAlert) wsService.subscribe('profile:alert', onAlert);

    return () => {
      if (onStatus) wsService.unsubscribe('profile:status', onStatus);
      if (onResources) wsService.unsubscribe('profile:resources', onResources);
      if (onHealth) wsService.unsubscribe('profile:health', onHealth);
      if (onAlert) wsService.unsubscribe('profile:alert', onAlert);
    };
  }, [handlers]);
}

export default useProfilesWebSocket;


