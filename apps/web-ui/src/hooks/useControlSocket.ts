import { useState, useEffect, useCallback, useRef } from 'react';

export interface TuneParams {
  frequencyHz: number;
  mode: string;
  bandwidthHz?: number;
  squelch?: number | null;
  waterfallRequested?: boolean;
  audioRequested?: boolean;
}

export interface TuneResponse {
  session: { id: string };
  channel: { id: string; streamEndpoints: { audioWsPath: string | null; waterfallWsPath: string | null } };
}

export function useControlSocket() {
  const [connected, setConnected] = useState(false);
  const [lastTuneResponse, setLastTuneResponse] = useState<TuneResponse | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const userId = useRef(`user-${Math.random().toString(36).slice(2, 10)}`);

  useEffect(() => {
    const wsUrl = `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws/control?userId=${userId.current}`;

    function connect() {
      const ws = new WebSocket(wsUrl);
      socketRef.current = ws;

      ws.onopen = () => setConnected(true);
      ws.onclose = () => {
        setConnected(false);
        setTimeout(connect, 3000);
      };
      ws.onerror = () => ws.close();

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data as string) as { type: string; payload?: unknown };
          if (msg.type === 'tune_ok') {
            setLastTuneResponse(msg.payload as TuneResponse);
          }
        } catch {
          // Ignore parse errors
        }
      };
    }

    connect();

    return () => {
      socketRef.current?.close();
    };
  }, []);

  const tune = useCallback((params: TuneParams) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(
        JSON.stringify({ type: 'tune', payload: params }),
      );
    }
  }, []);

  return { connected, tune, lastTuneResponse };
}
