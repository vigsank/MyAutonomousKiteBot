import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useToastStore } from '@/lib/toast';

/**
 * Maintains a WebSocket connection to the bot's /ws feed. On each `refresh`
 * event the server pushes, every active React Query is invalidated so the
 * dashboard reflects the latest ledger state without a full page reload.
 */
export function useWsRefresh() {
  const queryClient = useQueryClient();

  useEffect(() => {
    let closed = false;
    let ws: WebSocket | null = null;
    let retry: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
      ws = new WebSocket(`${proto}://${window.location.host}/ws`);

      ws.onopen = () => {
        // Connected — do a fresh pull immediately.
        queryClient.invalidateQueries();
      };
      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data as string);
          if (msg.type === 'refresh') {
            queryClient.invalidateQueries();
          } else if (msg.type === 'notification' && msg.data) {
            useToastStore.getState().add({
              title: msg.data.title,
              body: msg.data.body,
              severity: msg.data.severity,
            });
          }
        } catch {
          /* ignore malformed frames */
        }
      };
      ws.onclose = () => {
        if (closed) return;
        retry = setTimeout(connect, 3000);
      };
      ws.onerror = () => ws?.close();
    };

    connect();
    return () => {
      closed = true;
      if (retry) clearTimeout(retry);
      ws?.close();
    };
  }, [queryClient]);
}
