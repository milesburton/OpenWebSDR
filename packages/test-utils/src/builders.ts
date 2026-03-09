import type {
  Receiver,
  ReceiverCapabilities,
  ReceiverHealth,
  ReceiverWindow,
  Channel,
  ChannelDefinition,
  Session,
} from '@next-sdr/contracts';
import { randomUUID } from 'crypto';

export function buildCapabilities(
  overrides: Partial<ReceiverCapabilities> = {},
): ReceiverCapabilities {
  return {
    minFrequencyHz: 144_000_000,
    maxFrequencyHz: 146_000_000,
    supportedSampleRates: [1_024_000, 2_048_000],
    gainModes: ['auto', 'manual'],
    nominalBandwidthHz: 2_048_000,
    maxConcurrentWindows: 1,
    backendType: 'emulator',
    ...overrides,
  };
}

export function buildReceiverHealth(
  overrides: Partial<ReceiverHealth> = {},
): ReceiverHealth {
  return {
    status: 'healthy',
    lastCheckedAt: new Date().toISOString(),
    ...overrides,
  };
}

export function buildReceiver(overrides: Partial<Receiver> = {}): Receiver {
  return {
    id: randomUUID(),
    kind: 'emulator',
    site: 'test-site',
    status: 'available',
    claimed: false,
    capabilities: buildCapabilities(),
    currentWindowId: null,
    health: buildReceiverHealth(),
    ...overrides,
  };
}

export function buildReceiverWindow(
  overrides: Partial<ReceiverWindow> = {},
): ReceiverWindow {
  return {
    id: randomUUID(),
    receiverId: randomUUID(),
    centreFrequencyHz: 145_000_000,
    sampleRateHz: 2_048_000,
    serviceMinFrequencyHz: 144_100_000,
    serviceMaxFrequencyHz: 145_900_000,
    guardLowerHz: 100_000,
    guardUpperHz: 100_000,
    status: 'active',
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

export function buildChannelDefinition(
  overrides: Partial<ChannelDefinition> = {},
): ChannelDefinition {
  return {
    frequencyHz: 145_500_000,
    mode: 'NFM',
    bandwidthHz: 12_500,
    squelch: null,
    waterfallRequested: true,
    audioRequested: true,
    ...overrides,
  };
}

export function buildChannel(overrides: Partial<Channel> = {}): Channel {
  return {
    id: randomUUID(),
    windowId: randomUUID(),
    definition: buildChannelDefinition(),
    status: 'active',
    listenerCount: 0,
    reusable: true,
    streamEndpoints: {
      audioWsPath: '/ws/audio/test',
      waterfallWsPath: '/ws/waterfall/test',
    },
    health: {
      status: 'healthy',
      lastCheckedAt: new Date().toISOString(),
    },
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

export function buildSession(overrides: Partial<Session> = {}): Session {
  return {
    id: randomUUID(),
    channelId: randomUUID(),
    userId: `user-${Math.floor(Math.random() * 1000)}`,
    createdAt: new Date().toISOString(),
    lastActivityAt: new Date().toISOString(),
    capabilities: {
      supportsAudio: true,
      supportsWaterfall: true,
    },
    status: 'active',
    ...overrides,
  };
}
