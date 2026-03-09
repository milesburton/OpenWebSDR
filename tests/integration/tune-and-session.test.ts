/**
 * Integration test: tune request and session lifecycle.
 */

import { describe, it, beforeAll, afterEach, expect } from 'vitest';
import { TestHarness, defaultConfig } from '../../apps/test-harness/src';

interface TuneResult {
  session: { id: string; status: string; channelId: string };
  channel: { id: string; status: string; listenerCount: number };
}

describe('Tune and session lifecycle', () => {
  const harness = new TestHarness(defaultConfig());
  const createdSessions: string[] = [];

  beforeAll(async () => {
    await harness.waitForStack();
  }, 120_000);

  afterEach(async () => {
    // Clean up sessions created during tests
    await Promise.allSettled(
      createdSessions.splice(0).map((id) => harness.closeSession(id)),
    );
  });

  it('tune request creates a session and channel', async () => {
    const result = await harness.tune({
      userId: 'test-user-1',
      frequencyHz: 145_500_000,
      mode: 'NFM',
      waterfallRequested: true,
      audioRequested: true,
    }) as TuneResult;

    expect(result.session.id).toBeDefined();
    expect(result.channel.id).toBeDefined();
    createdSessions.push(result.session.id);
  });

  it('two users tuning the same frequency reuse the same channel', async () => {
    const result1 = await harness.tune({
      userId: 'user-A',
      frequencyHz: 144_800_000,
      mode: 'NFM',
    }) as TuneResult;

    const result2 = await harness.tune({
      userId: 'user-B',
      frequencyHz: 144_800_000,
      mode: 'NFM',
    }) as TuneResult;

    expect(result1.channel.id).toBe(result2.channel.id);
    createdSessions.push(result1.session.id, result2.session.id);
  });

  it('tune request to out-of-band frequency is rejected', async () => {
    await expect(
      harness.tune({
        userId: 'user-C',
        frequencyHz: 900_000_000,
        mode: 'NFM',
      }),
    ).rejects.toThrow();
  });
});
