/**
 * Contract tests for receiver backends.
 *
 * These tests verify that both the emulator and (when available) the real
 * RTL-SDR backend satisfy the identical receiver control contract.
 *
 * Run against the emulator backend by default.
 * Set RECEIVER_BACKEND_URL to point at an rtlsdr backend for hardware testing.
 */

import { describe, it, beforeAll, expect } from 'vitest';
import { ReceiverHttpClient } from '@next-sdr/receiver-sdk';

const BACKEND_URL =
  process.env['RECEIVER_BACKEND_URL'] ?? 'http://localhost:8080';

/**
 * These tests define the contract that every receiver backend must satisfy.
 * Adding a new backend means pointing RECEIVER_BACKEND_URL at it —
 * the tests must pass without modification.
 */
describe('Receiver backend contract', () => {
  const client = new ReceiverHttpClient({ baseUrl: BACKEND_URL });

  beforeAll(async () => {
    // Wait for backend to be healthy
    const { waitForUrl } = await import('../../apps/test-harness/src/wait');
    await waitForUrl(`${BACKEND_URL}/healthz/live`, { timeoutMs: 30_000 });
  }, 60_000);

  it('discoverReceivers returns at least one receiver', async () => {
    const result = await client.discoverReceivers();
    expect(result.receivers.length).toBeGreaterThan(0);
  });

  it('discoverReceivers returns receivers with valid capabilities', async () => {
    const result = await client.discoverReceivers();
    for (const receiver of result.receivers) {
      expect(receiver.capabilities.minFrequencyHz).toBeGreaterThan(0);
      expect(receiver.capabilities.maxFrequencyHz).toBeGreaterThan(
        receiver.capabilities.minFrequencyHz,
      );
      expect(receiver.capabilities.supportedSampleRates.length).toBeGreaterThan(0);
      expect(['emulator', 'rtlsdr']).toContain(receiver.capabilities.backendType);
    }
  });

  it('getCapabilities returns valid capabilities for a discovered receiver', async () => {
    const { receivers } = await client.discoverReceivers();
    const { id } = receivers[0]!;
    const result = await client.getCapabilities({ receiverId: id });
    expect(result.capabilities.maxConcurrentWindows).toBeGreaterThan(0);
  });

  it('claimReceiver succeeds for an available receiver', async () => {
    const { receivers } = await client.discoverReceivers();
    const { id } = receivers[0]!;
    const result = await client.claimReceiver({ receiverId: id });
    expect(result.success).toBe(true);
    // Clean up
    await client.releaseReceiver({ receiverId: id });
  });

  it('configureWindow returns success with applied config', async () => {
    const { receivers } = await client.discoverReceivers();
    const { id } = receivers[0]!;
    await client.claimReceiver({ receiverId: id });

    const result = await client.configureWindow({
      receiverId: id,
      config: {
        centreFrequencyHz: 145_000_000,
        sampleRateHz: 2_048_000,
      },
    });

    expect(result.success).toBe(true);
    expect(result.appliedConfig.centreFrequencyHz).toBe(145_000_000);

    await client.releaseReceiver({ receiverId: id });
  });

  it('getHealth returns a health object', async () => {
    const { receivers } = await client.discoverReceivers();
    const { id } = receivers[0]!;
    const result = await client.getHealth({ receiverId: id });
    expect(['healthy', 'degraded', 'unhealthy']).toContain(result.health.status);
    expect(result.health.lastCheckedAt).toBeTruthy();
  });
});
