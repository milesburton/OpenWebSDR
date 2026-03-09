/**
 * Mock implementations of receiver contracts for unit testing.
 */

import type {
  IReceiverControlClient,
  DiscoverReceiversResponse,
  ClaimReceiverRequest,
  ClaimReceiverResponse,
  ReleaseReceiverRequest,
  ReleaseReceiverResponse,
  GetCapabilitiesRequest,
  GetCapabilitiesResponse,
  ConfigureWindowRequest,
  ConfigureWindowResponse,
  StartStreamRequest,
  StartStreamResponse,
  StopStreamRequest,
  StopStreamResponse,
  GetHealthRequest,
  GetHealthResponse,
} from '@next-sdr/contracts';
import { buildCapabilities } from './builders';

/**
 * A mock receiver control client that returns configurable responses.
 * Used in unit tests to avoid network calls.
 */
export class MockReceiverControlClient implements IReceiverControlClient {
  public calls: Record<string, unknown[]> = {
    discoverReceivers: [],
    claimReceiver: [],
    releaseReceiver: [],
    getCapabilities: [],
    configureWindow: [],
    startStream: [],
    stopStream: [],
    getHealth: [],
  };

  public responses = {
    discoverReceivers: (): DiscoverReceiversResponse => ({
      receivers: [
        {
          id: 'mock-receiver-1',
          kind: 'emulator',
          capabilities: buildCapabilities(),
        },
      ],
    }),
    claimReceiver: (_req: ClaimReceiverRequest): ClaimReceiverResponse => ({
      success: true,
    }),
    releaseReceiver: (_req: ReleaseReceiverRequest): ReleaseReceiverResponse => ({
      success: true,
    }),
    getCapabilities: (_req: GetCapabilitiesRequest): GetCapabilitiesResponse => ({
      capabilities: buildCapabilities(),
    }),
    configureWindow: (req: ConfigureWindowRequest): ConfigureWindowResponse => ({
      success: true,
      appliedConfig: req.config,
    }),
    startStream: (_req: StartStreamRequest): StartStreamResponse => ({
      success: true,
      streamEndpoint: 'udp://localhost:5005',
    }),
    stopStream: (_req: StopStreamRequest): StopStreamResponse => ({
      success: true,
    }),
    getHealth: (_req: GetHealthRequest): GetHealthResponse => ({
      health: {
        status: 'healthy',
        lastCheckedAt: new Date().toISOString(),
      },
    }),
  };

  async discoverReceivers(): Promise<DiscoverReceiversResponse> {
    (this.calls['discoverReceivers'] as unknown[]).push(null);
    return this.responses.discoverReceivers();
  }

  async claimReceiver(req: ClaimReceiverRequest): Promise<ClaimReceiverResponse> {
    (this.calls['claimReceiver'] as ClaimReceiverRequest[]).push(req);
    return this.responses.claimReceiver(req);
  }

  async releaseReceiver(req: ReleaseReceiverRequest): Promise<ReleaseReceiverResponse> {
    (this.calls['releaseReceiver'] as ReleaseReceiverRequest[]).push(req);
    return this.responses.releaseReceiver(req);
  }

  async getCapabilities(req: GetCapabilitiesRequest): Promise<GetCapabilitiesResponse> {
    (this.calls['getCapabilities'] as GetCapabilitiesRequest[]).push(req);
    return this.responses.getCapabilities(req);
  }

  async configureWindow(req: ConfigureWindowRequest): Promise<ConfigureWindowResponse> {
    (this.calls['configureWindow'] as ConfigureWindowRequest[]).push(req);
    return this.responses.configureWindow(req);
  }

  async startStream(req: StartStreamRequest): Promise<StartStreamResponse> {
    (this.calls['startStream'] as StartStreamRequest[]).push(req);
    return this.responses.startStream(req);
  }

  async stopStream(req: StopStreamRequest): Promise<StopStreamResponse> {
    (this.calls['stopStream'] as StopStreamRequest[]).push(req);
    return this.responses.stopStream(req);
  }

  async getHealth(req: GetHealthRequest): Promise<GetHealthResponse> {
    (this.calls['getHealth'] as GetHealthRequest[]).push(req);
    return this.responses.getHealth(req);
  }

  resetCalls(): void {
    for (const key of Object.keys(this.calls)) {
      this.calls[key] = [];
    }
  }
}
