import { describe, it, expect } from 'vitest';
import { SchedulerPolicy } from '../../../apps/scheduler/src/policy';
import { buildReceiverWindow, buildChannelDefinition } from '@next-sdr/test-utils';
import type { SchedulerConfig } from '@next-sdr/config';

const config: SchedulerConfig = {
  serviceName: 'scheduler',
  host: '0.0.0.0',
  port: 3002,
  logLevel: 'info',
  metricsPort: 9092,
  maxUniqueChannels: 4,
  maxSessionsPerChannel: 8,
  maxTotalSessions: 16,
  channelIdleTimeoutMs: 30_000,
  waterfallQuota: 2,
};

describe('SchedulerPolicy', () => {
  const policy = new SchedulerPolicy(config);
  const window = buildReceiverWindow();

  function baseCtx() {
    return {
      activeChannels: 0,
      activeSessions: 0,
      activeWaterfallChannels: 0,
      definition: buildChannelDefinition(),
      window,
    };
  }

  it('allows a valid request', () => {
    const result = policy.evaluate(baseCtx());
    expect(result.allowed).toBe(true);
  });

  it('rejects frequency outside window', () => {
    const ctx = {
      ...baseCtx(),
      definition: buildChannelDefinition({ frequencyHz: 200_000_000 }),
    };
    const result = policy.evaluate(ctx);
    expect(result.allowed).toBe(false);
    expect((result as { allowed: false; reason: string }).reason).toMatch(/outside/i);
  });

  it('rejects when channel limit is reached', () => {
    const ctx = { ...baseCtx(), activeChannels: config.maxUniqueChannels };
    const result = policy.evaluate(ctx);
    expect(result.allowed).toBe(false);
    expect((result as { allowed: false; reason: string }).reason).toMatch(/channel/i);
  });

  it('rejects when session limit is reached', () => {
    const ctx = { ...baseCtx(), activeSessions: config.maxTotalSessions };
    const result = policy.evaluate(ctx);
    expect(result.allowed).toBe(false);
    expect((result as { allowed: false; reason: string }).reason).toMatch(/session/i);
  });

  it('rejects waterfall when quota is exhausted', () => {
    const ctx = {
      ...baseCtx(),
      activeWaterfallChannels: config.waterfallQuota,
      definition: buildChannelDefinition({ waterfallRequested: true }),
    };
    const result = policy.evaluate(ctx);
    expect(result.allowed).toBe(false);
    expect((result as { allowed: false; reason: string }).reason).toMatch(/waterfall/i);
  });

  it('allows waterfall when quota not yet reached', () => {
    const ctx = {
      ...baseCtx(),
      activeWaterfallChannels: config.waterfallQuota - 1,
      definition: buildChannelDefinition({ waterfallRequested: true }),
    };
    const result = policy.evaluate(ctx);
    expect(result.allowed).toBe(true);
  });
});
