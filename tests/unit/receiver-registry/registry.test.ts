/**
 * Unit tests for ReceiverRegistry.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ReceiverRegistry } from '../../../apps/receiver-registry/src/registry';
import type { Logger } from '../../../apps/receiver-registry/src/logger';
import { buildCapabilities } from '@next-sdr/test-utils';

function makeLogger(): Logger {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: () => makeLogger(),
  };
}

function makeRegistrationRequest() {
  return {
    kind: 'emulator' as const,
    site: 'test-site',
    capabilities: buildCapabilities(),
    endpoint: 'http://localhost:8080',
  };
}

describe('ReceiverRegistry', () => {
  let registry: ReceiverRegistry;
  let logger: Logger;

  beforeEach(() => {
    logger = makeLogger();
    registry = new ReceiverRegistry(logger, 15_000);
  });

  describe('register', () => {
    it('assigns a unique id on registration', () => {
      const id1 = registry.register(makeRegistrationRequest());
      const id2 = registry.register(makeRegistrationRequest());
      expect(id1).not.toBe(id2);
    });

    it('stores the receiver so it can be retrieved', () => {
      const id = registry.register(makeRegistrationRequest());
      const receiver = registry.get(id);
      expect(receiver).toBeDefined();
      expect(receiver?.kind).toBe('emulator');
      expect(receiver?.site).toBe('test-site');
    });

    it('starts with status available and not claimed', () => {
      const id = registry.register(makeRegistrationRequest());
      const receiver = registry.get(id);
      expect(receiver?.status).toBe('available');
      expect(receiver?.claimed).toBe(false);
    });
  });

  describe('deregister', () => {
    it('removes the receiver', () => {
      const id = registry.register(makeRegistrationRequest());
      registry.deregister(id);
      expect(registry.get(id)).toBeUndefined();
    });

    it('returns false for unknown receiver', () => {
      expect(registry.deregister('nonexistent')).toBe(false);
    });
  });

  describe('claim and release', () => {
    it('marks receiver as claimed', () => {
      const id = registry.register(makeRegistrationRequest());
      const ok = registry.claim(id, 'window-1');
      expect(ok).toBe(true);
      expect(registry.get(id)?.claimed).toBe(true);
      expect(registry.get(id)?.currentWindowId).toBe('window-1');
    });

    it('cannot claim an already-claimed receiver', () => {
      const id = registry.register(makeRegistrationRequest());
      registry.claim(id, 'window-1');
      const ok = registry.claim(id, 'window-2');
      expect(ok).toBe(false);
    });

    it('releases a claimed receiver', () => {
      const id = registry.register(makeRegistrationRequest());
      registry.claim(id, 'window-1');
      registry.release(id);
      expect(registry.get(id)?.claimed).toBe(false);
      expect(registry.get(id)?.currentWindowId).toBeNull();
    });
  });

  describe('getAvailable', () => {
    it('only returns unclaimed receivers', () => {
      const id1 = registry.register(makeRegistrationRequest());
      const id2 = registry.register(makeRegistrationRequest());
      registry.claim(id1, 'window-1');
      const available = registry.getAvailable();
      expect(available.map((r) => r.id)).toContain(id2);
      expect(available.map((r) => r.id)).not.toContain(id1);
    });
  });

  describe('pruneStale', () => {
    it('removes receivers whose heartbeat has expired', () => {
      vi.useFakeTimers();
      const id = registry.register(makeRegistrationRequest());

      vi.advanceTimersByTime(20_000);
      const pruned = registry.pruneStale();

      expect(pruned).toContain(id);
      expect(registry.get(id)).toBeUndefined();
      vi.useRealTimers();
    });

    it('keeps receivers that heartbeated recently', () => {
      vi.useFakeTimers();
      const id = registry.register(makeRegistrationRequest());

      vi.advanceTimersByTime(5_000);
      registry.heartbeat(id);
      vi.advanceTimersByTime(10_000);
      const pruned = registry.pruneStale();

      expect(pruned).not.toContain(id);
      expect(registry.get(id)).toBeDefined();
      vi.useRealTimers();
    });
  });
});
