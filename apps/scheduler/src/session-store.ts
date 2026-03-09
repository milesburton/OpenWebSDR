import { randomUUID } from 'crypto';
import type { Session, SessionCapabilities } from '@next-sdr/contracts';

export class SessionStore {
  private readonly sessions = new Map<string, Session>();

  create(channelId: string, userId: string, capabilities: SessionCapabilities): Session {
    const now = new Date().toISOString();
    const session: Session = {
      id: randomUUID(),
      channelId,
      userId,
      createdAt: now,
      lastActivityAt: now,
      capabilities,
      status: 'active',
    };
    this.sessions.set(session.id, session);
    return session;
  }

  get(id: string): Session | undefined {
    return this.sessions.get(id);
  }

  close(id: string): boolean {
    const session = this.sessions.get(id);
    if (!session) return false;
    session.status = 'closed';
    this.sessions.delete(id);
    return true;
  }

  getAll(): Session[] {
    return Array.from(this.sessions.values());
  }

  getForChannel(channelId: string): Session[] {
    return this.getAll().filter((s) => s.channelId === channelId);
  }

  countActive(): number {
    return this.getAll().filter((s) => s.status === 'active').length;
  }

  touch(id: string): void {
    const session = this.sessions.get(id);
    if (session) {
      session.lastActivityAt = new Date().toISOString();
    }
  }
}
