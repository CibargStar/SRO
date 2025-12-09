import { useEffect, useState } from 'react';
import { wsService } from '@/utils/websocket';
import { useAuthStore } from '@/store';

export function useWebSocket() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const [status, setStatus] = useState<'connected' | 'disconnected'>(wsService.status);

  useEffect(() => {
    if (accessToken) {
      wsService.connect(accessToken);
    } else {
      wsService.disconnect();
    }

    const handleOpen = () => setStatus('connected');
    const handleClose = () => setStatus('disconnected');

    wsService.subscribe('open', handleOpen);
    wsService.subscribe('close', handleClose);

    return () => {
      wsService.unsubscribe('open', handleOpen);
      wsService.unsubscribe('close', handleClose);
    };
  }, [accessToken]);

  return {
    status,
    service: wsService,
  };
}


