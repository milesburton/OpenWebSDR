import { useState, useEffect } from 'react';
import { api } from '../api/client';

export interface SystemHealth {
  ready: boolean;
  lastChecked: string;
}

export function useSystemHealth(intervalMs = 10_000) {
  const [health, setHealth] = useState<SystemHealth>({ ready: false, lastChecked: '' });

  useEffect(() => {
    async function check() {
      try {
        const result = await api.getHealth();
        setHealth({ ready: result.ready, lastChecked: new Date().toISOString() });
      } catch {
        setHealth({ ready: false, lastChecked: new Date().toISOString() });
      }
    }

    void check();
    const timer = setInterval(() => void check(), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);

  return { health };
}
