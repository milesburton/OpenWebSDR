/**
 * Session domain types.
 * A session represents a listener attached to a channel.
 */

export type SessionStatus = 'connecting' | 'active' | 'idle' | 'closed';

export interface SessionCapabilities {
  supportsAudio: boolean;
  supportsWaterfall: boolean;
}

export interface Session {
  id: string;
  channelId: string;
  userId: string;
  createdAt: string; // ISO 8601
  lastActivityAt: string; // ISO 8601
  capabilities: SessionCapabilities;
  status: SessionStatus;
}

export interface CreateSessionRequest {
  channelId: string;
  userId: string;
  capabilities: SessionCapabilities;
}

export interface CreateSessionResponse {
  session: Session;
  audioToken: string | null;
  waterfallToken: string | null;
}

export interface TuneRequest {
  userId: string;
  frequencyHz: number;
  mode: import('./channel').DemodulationMode;
  bandwidthHz?: number;
  squelch?: number | null;
  waterfallRequested?: boolean;
  audioRequested?: boolean;
}

export interface TuneResponse {
  session: Session;
  channel: import('./channel').Channel;
  audioToken: string | null;
  waterfallToken: string | null;
}
