import { describe, it, beforeAll, expect } from 'vitest';
import { TestHarness, defaultConfig } from '../../apps/test-harness/src';

describe('Receiver registration', () => {
  const harness = new TestHarness(defaultConfig());

  beforeAll(async () => {
    await harness.waitForStack();
  }, 120_000);

  it('at least one emulator receiver is registered', async () => {
    const result = await harness.getReceivers() as {
      receivers: Array<{ kind: string; status: string; health: { status: string } }>;
    };

    const emulators = result.receivers.filter((r) => r.kind === 'emulator');
    expect(emulators.length).toBeGreaterThan(0);
  });

  it('registered emulator reports healthy status', async () => {
    const result = await harness.getReceivers() as {
      receivers: Array<{ kind: string; health: { status: string } }>;
    };
    const emulator = result.receivers.find((r) => r.kind === 'emulator');
    expect(emulator?.health.status).toBe('healthy');
  });
});
