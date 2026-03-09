export type ReceiverKind = 'emulator' | 'rtlsdr';

export type ReceiverStatus =
  | 'available'
  | 'claimed'
  | 'streaming'
  | 'error'
  | 'offline';

export interface ReceiverCapabilities {
  minFrequencyHz: number;
  maxFrequencyHz: number;
  supportedSampleRates: number[];
  gainModes: string[];
  nominalBandwidthHz: number;
  maxConcurrentWindows: number;
  backendType: ReceiverKind;
}

export interface ReceiverHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  lastCheckedAt: string; // ISO 8601
  details?: Record<string, unknown>;
}

export interface Receiver {
  id: string;
  kind: ReceiverKind;
  site: string;
  status: ReceiverStatus;
  claimed: boolean;
  capabilities: ReceiverCapabilities;
  currentWindowId: string | null;
  health: ReceiverHealth;
}

export interface ReceiverRegistrationRequest {
  kind: ReceiverKind;
  site: string;
  capabilities: ReceiverCapabilities;
  /** gRPC or HTTP endpoint the receiver-service listens on */
  endpoint: string;
}

export interface ReceiverRegistrationResponse {
  receiverId: string;
  accepted: boolean;
  reason?: string;
}
