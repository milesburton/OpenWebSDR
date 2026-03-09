/**
 * Unit tests for ChannelStore.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ChannelStore } from '../../../apps/scheduler/src/channel-store';
import { buildChannelDefinition } from '@next-sdr/test-utils';
import { randomUUID } from 'crypto';

describe('ChannelStore', () => {
  let store: ChannelStore;

  beforeEach(() => {
    store = new ChannelStore();
  });

  it('creates a placeholder channel', () => {
    const windowId = randomUUID();
    const definition = buildChannelDefinition();
    const channel = store.createPlaceholder(windowId, definition);
    expect(channel.status).toBe('starting');
    expect(channel.windowId).toBe(windowId);
    expect(channel.definition.frequencyHz).toBe(definition.frequencyHz);
  });

  it('activates a channel', () => {
    const channel = store.createPlaceholder(randomUUID(), buildChannelDefinition());
    store.activate(channel.id);
    expect(store.get(channel.id)?.status).toBe('active');
  });

  it('finds reusable channels by definition', () => {
    const windowId = randomUUID();
    const definition = buildChannelDefinition({ frequencyHz: 145_500_000 });
    const channel = store.createPlaceholder(windowId, definition);
    store.activate(channel.id);

    const found = store.findReusable(windowId, definition);
    expect(found?.id).toBe(channel.id);
  });

  it('does not reuse channel from different window', () => {
    const definition = buildChannelDefinition();
    const channel = store.createPlaceholder('window-A', definition);
    store.activate(channel.id);

    const found = store.findReusable('window-B', definition);
    expect(found).toBeUndefined();
  });

  it('does not reuse channel with different frequency', () => {
    const windowId = randomUUID();
    const channel = store.createPlaceholder(windowId, buildChannelDefinition({ frequencyHz: 145_000_000 }));
    store.activate(channel.id);

    const found = store.findReusable(windowId, buildChannelDefinition({ frequencyHz: 144_800_000 }));
    expect(found).toBeUndefined();
  });

  it('increments and decrements listener count', () => {
    const channel = store.createPlaceholder(randomUUID(), buildChannelDefinition());
    store.incrementListeners(channel.id);
    store.incrementListeners(channel.id);
    expect(store.get(channel.id)?.listenerCount).toBe(2);

    store.decrementListeners(channel.id);
    expect(store.get(channel.id)?.listenerCount).toBe(1);
  });

  it('listener count does not go below zero', () => {
    const channel = store.createPlaceholder(randomUUID(), buildChannelDefinition());
    store.decrementListeners(channel.id);
    expect(store.get(channel.id)?.listenerCount).toBe(0);
  });
});
