export type DemodulationMode = 'FM' | 'NFM' | 'AM' | 'USB' | 'LSB' | 'RAW';

export type ChannelStatus =
  | 'starting'
  | 'active'
  | 'idle'
  | 'stopping'
  | 'error';

export interface ChannelDefinition {
  frequencyHz: number;
  mode: DemodulationMode;
  bandwidthHz: number;
  squelch: number | null;
  waterfallRequested: boolean;
  audioRequested: boolean;
}

export interface ChannelStreamEndpoints {
  audioWsPath: string | null;
  waterfallWsPath: string | null;
}

export interface ChannelHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  lastCheckedAt: string;
  details?: Record<string, unknown>;
}

export interface Channel {
  id: string;
  windowId: string;
  definition: ChannelDefinition;
  status: ChannelStatus;
  listenerCount: number;
  reusable: boolean;
  streamEndpoints: ChannelStreamEndpoints;
  health: ChannelHealth;
  createdAt: string; // ISO 8601
}

export interface CreateChannelRequest {
  windowId: string;
  definition: ChannelDefinition;
}

export interface CreateChannelResponse {
  channel: Channel;
  reused: boolean;
}
