/**
 * Performance test: channel scaling.
 *
 * Measures how the platform behaves as the number of concurrent channels grows.
 * Run with: PERF_TEST=1 pnpm --filter @next-sdr/test-harness test:integration
 */

import { describe, it, beforeAll, afterAll, expect } from 'vitest';
import { TestHarness, defaultConfig } from '../../apps/test-harness/src';

const RUN_PERF = process.env['PERF_TEST'] === '1';

describe.skipIf(!RUN_PERF)('Channel scaling', () => {
  const harness = new TestHarness(defaultConfig());
  const sessionIds: string[] = [];

  beforeAll(async () => {
    await harness.waitForStack();
  }, 120_000);

  afterAll(async () => {
    await Promise.allSettled(sessionIds.map((id) => harness.closeSession(id)));
  });

  const CHANNEL_COUNTS = [1, 2, 4, 8, 16];

  for (const count of CHANNEL_COUNTS) {
    it(`handles ${count} simultaneous unique channels`, async () => {
      const start = Date.now();

      const results = await Promise.all(
        Array.from({ length: count }, (_, i) =>
          harness.tune({
            userId: `perf-user-${i}`,
            frequencyHz: 144_100_000 + i * 50_000,
            mode: 'NFM',
            waterfallRequested: false,
          }),
        ),
      ) as Array<{ session: { id: string } }>;

      const elapsed = Date.now() - start;

      for (const result of results) {
        sessionIds.push(result.session.id);
      }

      console.log(`${count} channels: ${elapsed}ms`);

      // All channels should be created
      expect(results.length).toBe(count);
      // Latency should scale sub-linearly (rough check)
      expect(elapsed).toBeLessThan(count * 2000);
    }, 60_000);
  }
});
