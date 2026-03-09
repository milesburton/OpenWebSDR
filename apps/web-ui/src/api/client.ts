/**
 * HTTP client for the control-api.
 */

const BASE_URL = '/api/v1';

async function get<T>(path: string): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`);
  if (!response.ok) {
    throw new Error(`API error ${response.status} at ${path}`);
  }
  return response.json() as Promise<T>;
}

export interface ReceiverInfo {
  id: string;
  kind: string;
  site: string;
  status: string;
  health: { status: string };
}

export interface ChannelInfo {
  id: string;
  definition: {
    frequencyHz: number;
    mode: string;
    bandwidthHz: number;
  };
  status: string;
  listenerCount: number;
}

export interface SystemMetrics {
  scheduler: {
    activeChannels: number;
    activeSessions: number;
    activeWaterfallChannels: number;
  } | null;
}

export const api = {
  getReceivers: () => get<{ receivers: ReceiverInfo[] }>('/receivers'),
  getChannels: () => get<{ channels: ChannelInfo[] }>('/channels'),
  getMetrics: () => get<SystemMetrics>('/metrics'),
  getHealth: () =>
    fetch('/healthz/ready').then((r) => r.json() as Promise<{ ready: boolean }>),
};
