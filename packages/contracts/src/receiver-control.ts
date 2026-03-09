/**
 * Receiver control contract.
 * All receiver backends (emulator, rtlsdr) must implement this interface identically.
 */

import type { ReceiverCapabilities, ReceiverHealth } from './receiver';

export interface WindowConfig {
  centreFrequencyHz: number;
  sampleRateHz: number;
  gainDb?: number;
  agcEnabled?: boolean;
}

export interface DiscoverReceiversResponse {
  receivers: Array<{
    id: string;
    kind: string;
    capabilities: ReceiverCapabilities;
  }>;
}

export interface ClaimReceiverRequest {
  receiverId: string;
}

export interface ClaimReceiverResponse {
  success: boolean;
  reason?: string;
}

export interface ReleaseReceiverRequest {
  receiverId: string;
}

export interface ReleaseReceiverResponse {
  success: boolean;
}

export interface GetCapabilitiesRequest {
  receiverId: string;
}

export interface GetCapabilitiesResponse {
  capabilities: ReceiverCapabilities;
}

export interface ConfigureWindowRequest {
  receiverId: string;
  config: WindowConfig;
}

export interface ConfigureWindowResponse {
  success: boolean;
  appliedConfig: WindowConfig;
  reason?: string;
}

export interface StartStreamRequest {
  receiverId: string;
  windowId: string;
}

export interface StartStreamResponse {
  success: boolean;
  streamEndpoint: string;
  reason?: string;
}

export interface StopStreamRequest {
  receiverId: string;
}

export interface StopStreamResponse {
  success: boolean;
}

export interface GetHealthRequest {
  receiverId: string;
}

export interface GetHealthResponse {
  health: ReceiverHealth;
}

/**
 * The canonical receiver control interface.
 * Every backend must satisfy this contract.
 */
export interface IReceiverControlClient {
  discoverReceivers(): Promise<DiscoverReceiversResponse>;
  claimReceiver(req: ClaimReceiverRequest): Promise<ClaimReceiverResponse>;
  releaseReceiver(req: ReleaseReceiverRequest): Promise<ReleaseReceiverResponse>;
  getCapabilities(req: GetCapabilitiesRequest): Promise<GetCapabilitiesResponse>;
  configureWindow(req: ConfigureWindowRequest): Promise<ConfigureWindowResponse>;
  startStream(req: StartStreamRequest): Promise<StartStreamResponse>;
  stopStream(req: StopStreamRequest): Promise<StopStreamResponse>;
  getHealth(req: GetHealthRequest): Promise<GetHealthResponse>;
}
