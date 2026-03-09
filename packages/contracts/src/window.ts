export type WindowStatus =
  | 'pending'
  | 'active'
  | 'degraded'
  | 'stopped'
  | 'error';

export interface ReceiverWindow {
  id: string;
  receiverId: string;
  centreFrequencyHz: number;
  sampleRateHz: number;
  /** Lowest frequency reliably serviced within this window */
  serviceMinFrequencyHz: number;
  /** Highest frequency reliably serviced within this window */
  serviceMaxFrequencyHz: number;
  /** Guard band at lower edge (Hz) */
  guardLowerHz: number;
  /** Guard band at upper edge (Hz) */
  guardUpperHz: number;
  status: WindowStatus;
  createdAt: string; // ISO 8601
}

export interface CreateWindowRequest {
  receiverId: string;
  centreFrequencyHz: number;
  sampleRateHz: number;
}

export interface CreateWindowResponse {
  window: ReceiverWindow;
}
