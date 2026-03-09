/**
 * In-memory channel store.
 * Tracks all active channels and handles reuse logic.
 */

import { randomUUID } from 'crypto';
import type { Channel, ChannelDefinition } from '@next-sdr/contracts';

function definitionsMatch(a: ChannelDefinition, b: ChannelDefinition): boolean {
  return (
    a.frequencyHz === b.frequencyHz &&
    a.mode === b.mode &&
    a.bandwidthHz === b.bandwidthHz
  );
}

export class ChannelStore {
  private readonly channels = new Map<string, Channel>();

  add(channel: Channel): void {
    this.channels.set(channel.id, channel);
  }

  get(id: string): Channel | undefined {
    return this.channels.get(id);
  }

  remove(id: string): boolean {
    return this.channels.delete(id);
  }

  getAll(): Channel[] {
    return Array.from(this.channels.values());
  }

  getActive(): Channel[] {
    return this.getAll().filter((c) => c.status === 'active');
  }

  findReusable(
    windowId: string,
    definition: ChannelDefinition,
  ): Channel | undefined {
    return this.getAll().find(
      (c) =>
        c.windowId === windowId &&
        c.reusable &&
        c.status === 'active' &&
        definitionsMatch(c.definition, definition),
    );
  }

  incrementListeners(id: string): boolean {
    const channel = this.channels.get(id);
    if (!channel) return false;
    channel.listenerCount += 1;
    return true;
  }

  decrementListeners(id: string): boolean {
    const channel = this.channels.get(id);
    if (!channel) return false;
    channel.listenerCount = Math.max(0, channel.listenerCount - 1);
    return true;
  }

  countActive(): number {
    return this.getActive().length;
  }

  countWaterfall(): number {
    return this.getActive().filter((c) => c.definition.waterfallRequested).length;
  }

  createPlaceholder(windowId: string, definition: ChannelDefinition): Channel {
    const id = randomUUID();
    const channel: Channel = {
      id,
      windowId,
      definition,
      status: 'starting',
      listenerCount: 0,
      reusable: true,
      streamEndpoints: {
        audioWsPath: definition.audioRequested ? `/ws/audio/${id}` : null,
        waterfallWsPath: definition.waterfallRequested ? `/ws/waterfall/${id}` : null,
      },
      health: {
        status: 'healthy',
        lastCheckedAt: new Date().toISOString(),
      },
      createdAt: new Date().toISOString(),
    };
    this.channels.set(id, channel);
    return channel;
  }

  activate(id: string): boolean {
    const channel = this.channels.get(id);
    if (!channel) return false;
    channel.status = 'active';
    return true;
  }
}
