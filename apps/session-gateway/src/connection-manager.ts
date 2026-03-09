import type { WebSocket } from 'ws';

export interface ManagedConnection {
  id: string;
  sessionId: string;
  userId: string;
  socket: WebSocket;
  connectedAt: number;
  lastActivityAt: number;
  type: 'audio' | 'waterfall' | 'control';
}

export class ConnectionManager {
  private readonly connections = new Map<string, ManagedConnection>();
  private readonly maxPerUser: number;

  constructor(maxConnectionsPerUser: number) {
    this.maxPerUser = maxConnectionsPerUser;
  }

  canAccept(userId: string): boolean {
    const count = this.getForUser(userId).length;
    return count < this.maxPerUser;
  }

  add(conn: Omit<ManagedConnection, 'connectedAt' | 'lastActivityAt'>): ManagedConnection {
    const now = Date.now();
    const managed: ManagedConnection = {
      ...conn,
      connectedAt: now,
      lastActivityAt: now,
    };
    this.connections.set(conn.id, managed);
    return managed;
  }

  remove(id: string): boolean {
    return this.connections.delete(id);
  }

  get(id: string): ManagedConnection | undefined {
    return this.connections.get(id);
  }

  getForSession(sessionId: string): ManagedConnection[] {
    return Array.from(this.connections.values()).filter(
      (c) => c.sessionId === sessionId,
    );
  }

  getForUser(userId: string): ManagedConnection[] {
    return Array.from(this.connections.values()).filter(
      (c) => c.userId === userId,
    );
  }

  touch(id: string): void {
    const conn = this.connections.get(id);
    if (conn) {
      conn.lastActivityAt = Date.now();
    }
  }

  count(): number {
    return this.connections.size;
  }

  /** Close all connections for a session */
  closeSession(sessionId: string, code: number, reason: string): void {
    for (const conn of this.getForSession(sessionId)) {
      try {
        conn.socket.close(code, reason);
      } catch {
        // Ignore errors on close
      }
      this.connections.delete(conn.id);
    }
  }
}
