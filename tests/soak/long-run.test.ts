import { describe, it, beforeAll, expect } from 'vitest';
import { TestHarness, defaultConfig } from '../../apps/test-harness/src';

const RUN_SOAK = process.env['SOAK_TEST'] === '1';
const DURATION_MS =
  (parseInt(process.env['SOAK_DURATION_MINUTES'] ?? '10', 10)) * 60_000;

describe.skipIf(!RUN_SOAK)('Long-run soak', () => {
  const harness = new TestHarness(defaultConfig());

  beforeAll(async () => {
    await harness.waitForStack();
  }, 120_000);

  it('platform remains stable over an extended run', async () => {
    const deadline = Date.now() + DURATION_MS;
    let iteration = 0;
    const sessionIds: string[] = [];

    while (Date.now() < deadline) {
      // Create a session
      const result = await harness.tune({
        userId: `soak-user-${iteration % 8}`,
        frequencyHz: 145_500_000,
        mode: 'NFM',
      }) as { session: { id: string } };

      sessionIds.push(result.session.id);

      // After a few sessions, close the oldest
      if (sessionIds.length > 4) {
        const oldest = sessionIds.shift()!;
        await harness.closeSession(oldest);
      }

      // Check metrics periodically
      if (iteration % 20 === 0) {
        const metrics = await harness.getMetrics() as {
          scheduler: { activeChannels: number; activeSessions: number } | null
        };
        console.log(
          `[soak] Iteration ${iteration}: ` +
          `channels=${metrics.scheduler?.activeChannels ?? 'n/a'} ` +
          `sessions=${metrics.scheduler?.activeSessions ?? 'n/a'}`,
        );

        // Verify session count is not growing unboundedly
        if (metrics.scheduler) {
          expect(metrics.scheduler.activeSessions).toBeLessThan(32);
        }
      }

      await new Promise((resolve) => setTimeout(resolve, 500));
      ++iteration;
    }

    // Clean up all remaining sessions
    await Promise.allSettled(sessionIds.map((id) => harness.closeSession(id)));

    expect(iteration).toBeGreaterThan(0);
    console.log(`[soak] Completed ${iteration} iterations over ${DURATION_MS / 1000}s`);
  }, DURATION_MS + 120_000);
});
