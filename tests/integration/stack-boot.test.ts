import { describe, it, beforeAll } from 'vitest';
import { TestHarness, defaultConfig } from '../../apps/test-harness/src';

describe('Stack boot', () => {
  const harness = new TestHarness(defaultConfig());

  beforeAll(async () => {
    await harness.waitForStack();
  }, 120_000);

  it('all services report liveness', async () => {
    await harness.waitForStack();
  });

  it('receiver inventory is accessible', async () => {
    const result = await harness.getReceivers() as { receivers: unknown[] };
    // Should return an array (possibly empty at startup)
    expect(Array.isArray(result.receivers)).toBe(true);
  });

  it('channel list is accessible', async () => {
    const result = await harness.getChannels() as { channels: unknown[] };
    expect(Array.isArray(result.channels)).toBe(true);
  });

  it('metrics endpoint is accessible', async () => {
    const result = await harness.getMetrics() as { scheduler: unknown };
    expect(result).toBeDefined();
  });
});
