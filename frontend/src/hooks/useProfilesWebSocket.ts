import { useEffect } from 'react';
import { wsService } from '@/utils/websocket';
import type { ProfileStatus, ProfileHealthStatus, AlertType, AlertSeverity } from '@/types';

/**
 * Payload для события статуса профиля
 */
type ProfileStatusPayload = {
  profileId: string;
  status: ProfileStatus;
  lastActiveAt: string | null;
};

/**
 * Payload для события ресурсов профиля
 */
type ProfileResourcesPayload = {
  profileId: string;
  pid: number;
  cpuUsage: number;
  memoryUsage: number;
  memoryUsagePercent: number;
  timestamp: string;
};

/**
 * Payload для события здоровья профиля
 */
type ProfileHealthPayload = {
  profileId: string;
  status: ProfileHealthStatus;
  details: {
    processRunning: boolean;
    browserConnected: boolean;
    cpuUsage?: number;
    memoryUsage?: number;
    resourceLimitsExceeded?: boolean;
  };
  timestamp: string;
};

/**
 * Payload для алерта профиля
 */
type ProfileAlertPayload = {
  id: string;
  profileId: string;
  userId: string;
  type: AlertType;
  severity: AlertSeverity;
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




