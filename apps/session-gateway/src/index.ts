import Fastify from 'fastify';
import FastifyWebsocket from '@fastify/websocket';
import { randomUUID } from 'crypto';
import { loadSessionGatewayConfig } from '@next-sdr/config';
import { createLogger } from '../../receiver-registry/src/logger';
import { ConnectionManager } from './connection-manager';
import type { LivenessResponse, ReadinessResponse } from '@next-sdr/contracts';

const SCHEDULER_URL = process.env['SCHEDULER_URL'] ?? 'http://scheduler:3002';

async function main(): Promise<void> {
  const config = loadSessionGatewayConfig();
  const logger = createLogger(config.logLevel, config.serviceName);
  const connections = new ConnectionManager(config.maxConnectionsPerUser);

  const app = Fastify({ disableRequestLogging: true });
  await app.register(FastifyWebsocket);

  app.get('/healthz/live', async (): Promise<LivenessResponse> => ({
    alive: true,
    timestamp: new Date().toISOString(),
  }));

  app.get('/healthz/ready', async (): Promise<ReadinessResponse> => ({
    ready: true,
    checks: { gateway: true },
  }));

  app.get('/metrics', async () => ({
    websocketConnections: connections.count(),
  }));

  /**
   * Control WebSocket — carries tune requests and session management.
   * Query params: userId
   */
  app.get(
    '/ws/control',
    { websocket: true },
    (socket, request) => {
      const userId = (request.query as Record<string, string>)['userId'] ?? 'anonymous';
      const connId = randomUUID();

      if (!connections.canAccept(userId)) {
        socket.close(1008, 'Connection limit reached');
        return;
      }

      connections.add({
        id: connId,
        sessionId: '',
        userId,
        socket,
        type: 'control',
      });

      logger.info({ connId, userId }, 'Control WebSocket connected');

      socket.on('message', (rawMsg) => {
        connections.touch(connId);
        let msg: Record<string, unknown>;
        try {
          msg = JSON.parse(rawMsg.toString()) as Record<string, unknown>;
        } catch {
          socket.send(JSON.stringify({ error: 'Invalid JSON' }));
          return;
        }

        void handleControlMessage(msg, userId, socket);
      });

      socket.on('close', () => {
        connections.remove(connId);
        logger.info({ connId, userId }, 'Control WebSocket disconnected');
      });

      socket.on('error', (err) => {
        logger.error({ connId, err: err.message }, 'WebSocket error');
      });

      // Ping/pong keepalive
      const pingTimer = setInterval(() => {
        if (socket.readyState === socket.OPEN) {
          socket.ping();
        }
      }, config.pingIntervalMs);

      socket.on('close', () => clearInterval(pingTimer));
    },
  );

  /**
   * Audio WebSocket — streams demodulated audio to the client.
   * Query params: sessionId, token
   */
  app.get(
    '/ws/audio/:channelId',
    { websocket: true },
    (socket, request) => {
      const { channelId } = request.params as { channelId: string };
      const connId = randomUUID();

      logger.info({ connId, channelId }, 'Audio WebSocket connected');

      // In production, this would attach to the channel-service audio stream.
      // For the skeleton, we acknowledge and hold the connection.

      socket.on('close', () => {
        connections.remove(connId);
        logger.info({ connId, channelId }, 'Audio WebSocket disconnected');
      });

      socket.send(JSON.stringify({ type: 'ready', channelId }));
    },
  );

  /**
   * Waterfall WebSocket — streams FFT waterfall data to the client.
   * Query params: sessionId, token
   */
  app.get(
    '/ws/waterfall/:channelId',
    { websocket: true },
    (socket, request) => {
      const { channelId } = request.params as { channelId: string };
      const connId = randomUUID();

      logger.info({ connId, channelId }, 'Waterfall WebSocket connected');

      socket.on('close', () => {
        connections.remove(connId);
        logger.info({ connId, channelId }, 'Waterfall WebSocket disconnected');
      });

      socket.send(JSON.stringify({ type: 'ready', channelId }));
    },
  );

  async function handleControlMessage(
    msg: Record<string, unknown>,
    userId: string,
    socket: import('ws').WebSocket,
  ): Promise<void> {
    const type = msg['type'] as string;

    if (type === 'tune') {
      const response = await fetch(`${SCHEDULER_URL}/tune`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...msg['payload'], userId }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({ error: 'Unknown error' }));
        socket.send(JSON.stringify({ type: 'tune_error', payload: body }));
        return;
      }

      const data = await response.json();
      socket.send(JSON.stringify({ type: 'tune_ok', payload: data }));
    } else {
      socket.send(JSON.stringify({ type: 'error', message: `Unknown message type: ${type}` }));
    }
  }

  const shutdown = async (): Promise<void> => {
    logger.info({}, 'Shutting down session-gateway');
    await app.close();
    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown());
  process.on('SIGINT', () => void shutdown());

  await app.listen({ host: config.host, port: config.port });
  logger.info({ port: config.port }, 'session-gateway listening');
}

main().catch((err) => {
  console.error('Fatal error in session-gateway', err);
  process.exit(1);
});
