import { randomUUID } from 'crypto';
import type { Receiver, ReceiverRegistrationRequest } from '@next-sdr/contracts';
import type { Logger } from './logger';

export interface RegisteredReceiver extends Receiver {
  endpoint: string;
  lastHeartbeatAt: number;
}

export class ReceiverRegistry {
  private readonly receivers = new Map<string, RegisteredReceiver>();
  private readonly timeoutMs: number;

  constructor(
    private readonly logger: Logger,
    timeoutMs: number,
  ) {
    this.timeoutMs = timeoutMs;
  }

  register(req: ReceiverRegistrationRequest): string {
    const id = randomUUID();
    const now = Date.now();

    const receiver: RegisteredReceiver = {
      id,
      kind: req.kind,
      site: req.site,
      status: 'available',
      claimed: false,
      capabilities: req.capabilities,
      currentWindowId: null,
      health: {
        status: 'healthy',
        lastCheckedAt: new Date(now).toISOString(),
      },
      endpoint: req.endpoint,
      lastHeartbeatAt: now,
    };

    this.receivers.set(id, receiver);
    this.logger.info({ receiverId: id, kind: req.kind, site: req.site }, 'Receiver registered');
    return id;
  }

  deregister(id: string): boolean {
    const existed = this.receivers.has(id);
    this.receivers.delete(id);
    if (existed) {
      this.logger.info({ receiverId: id }, 'Receiver deregistered');
    }
    return existed;
  }

  heartbeat(id: string): boolean {
    const receiver = this.receivers.get(id);
    if (!receiver) return false;
    receiver.lastHeartbeatAt = Date.now();
    return true;
  }

  updateHealth(
    id: string,
    health: Receiver['health'],
  ): boolean {
    const receiver = this.receivers.get(id);
    if (!receiver) return false;
    receiver.health = health;
    return true;
  }

  claim(id: string, windowId: string): boolean {
    const receiver = this.receivers.get(id);
    if (!receiver || receiver.claimed) return false;
    receiver.claimed = true;
    receiver.status = 'claimed';
    receiver.currentWindowId = windowId;
    this.logger.info({ receiverId: id, windowId }, 'Receiver claimed');
    return true;
  }

  release(id: string): boolean {
    const receiver = this.receivers.get(id);
    if (!receiver) return false;
    receiver.claimed = false;
    receiver.status = 'available';
    receiver.currentWindowId = null;
    this.logger.info({ receiverId: id }, 'Receiver released');
    return true;
  }

  get(id: string): RegisteredReceiver | undefined {
    return this.receivers.get(id);
  }

  getAll(): RegisteredReceiver[] {
    return Array.from(this.receivers.values());
  }

  getAvailable(): RegisteredReceiver[] {
    return this.getAll().filter((r) => !r.claimed && r.status === 'available');
  }

  /** Remove receivers that have not sent a heartbeat within the timeout window */
  pruneStale(): string[] {
    const cutoff = Date.now() - this.timeoutMs;
    const pruned: string[] = [];

    for (const [id, receiver] of this.receivers) {
      if (receiver.lastHeartbeatAt < cutoff) {
        this.receivers.delete(id);
        pruned.push(id);
        this.logger.warn({ receiverId: id }, 'Receiver pruned — heartbeat timeout');
      }
    }

    return pruned;
  }
}
