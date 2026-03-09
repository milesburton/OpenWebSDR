import Fastify from 'fastify';
import { loadControlApiConfig } from '@next-sdr/config';
import { createLogger } from '../../receiver-registry/src/logger';
import type {
  TuneRequest,
  LivenessResponse,
  ReadinessResponse,
  ServiceHealth,
} from '@next-sdr/contracts';

const REGISTRY_URL = process.env['REGISTRY_URL'] ?? 'http://receiver-registry:3001';
const SCHEDULER_URL = process.env['SCHEDULER_URL'] ?? 'http://scheduler:3002';
const WINDOW_ENGINE_URL = process.env['WINDOW_ENGINE_URL'] ?? 'http://window-engine:3003';

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  if (!response.ok) {
    throw new Error(`Upstream error ${response.status} from ${url}`);
  }
  return response.json() as Promise<T>;
}

async function main(): Promise<void> {
  const config = loadControlApiConfig();
  const logger = createLogger(config.logLevel, config.serviceName);

  const app = Fastify({ disableRequestLogging: true });

  // Health endpoints
  app.get('/healthz/live', async (): Promise<LivenessResponse> => ({
    alive: true,
    timestamp: new Date().toISOString(),
  }));

  app.get('/healthz/ready', async (): Promise<ReadinessResponse> => ({
    ready: true,
    checks: { api: true },
  }));

  app.get('/health', async (): Promise<ServiceHealth> => ({
    status: 'ok',
    service: 'control-api',
    version: '0.1.0',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    checks: {},
  }));

  // Receiver inventory
  app.get('/api/v1/receivers', async () => {
    return fetchJson(`${REGISTRY_URL}/receivers`);
  });

  app.get<{ Params: { id: string } }>('/api/v1/receivers/:id', async (request, reply) => {
    try {
      return await fetchJson(`${REGISTRY_URL}/receivers/${request.params.id}`);
    } catch {
      return reply.code(404).send({ error: 'Receiver not found' });
    }
  });

  // Windows
  app.get('/api/v1/windows', async () => {
    return fetchJson(`${WINDOW_ENGINE_URL}/windows`);
  });

  app.get('/api/v1/windows/default', async (_request, reply) => {
    try {
      return await fetchJson(`${WINDOW_ENGINE_URL}/windows/default`);
    } catch {
      return reply.code(404).send({ error: 'No active window' });
    }
  });

  // Channels
  app.get('/api/v1/channels', async () => {
    return fetchJson(`${SCHEDULER_URL}/channels`);
  });

  app.get<{ Params: { id: string } }>('/api/v1/channels/:id', async (request, reply) => {
    try {
      return await fetchJson(`${SCHEDULER_URL}/channels/${request.params.id}`);
    } catch {
      return reply.code(404).send({ error: 'Channel not found' });
    }
  });

  // Sessions
  app.get('/api/v1/sessions', async () => {
    return fetchJson(`${SCHEDULER_URL}/sessions`);
  });

  // Tune request
  app.post<{ Body: TuneRequest }>('/api/v1/tune', async (request, reply) => {
    try {
      return await fetchJson(`${SCHEDULER_URL}/tune`, {
        method: 'POST',
        body: JSON.stringify(request.body),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return reply.code(409).send({ error: message });
    }
  });

  // Close session
  app.delete<{ Params: { sessionId: string } }>(
    '/api/v1/sessions/:sessionId',
    async (request, reply) => {
      try {
        const response = await fetch(
          `${SCHEDULER_URL}/sessions/${request.params.sessionId}`,
          { method: 'DELETE' },
        );
        if (response.status === 404) {
          return reply.code(404).send({ error: 'Session not found' });
        }
        return reply.code(204).send();
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return reply.code(500).send({ error: message });
      }
    },
  );

  // Metrics aggregation
  app.get('/api/v1/metrics', async () => {
    const [schedulerMetrics] = await Promise.allSettled([
      fetchJson<Record<string, number>>(`${SCHEDULER_URL}/metrics`),
    ]);
    return {
      scheduler: schedulerMetrics.status === 'fulfilled' ? schedulerMetrics.value : null,
    };
  });

  const shutdown = async (): Promise<void> => {
    logger.info({}, 'Shutting down control-api');
    await app.close();
    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown());
  process.on('SIGINT', () => void shutdown());

  await app.listen({ host: config.host, port: config.port });
  logger.info({ port: config.port }, 'control-api listening');
}

main().catch((err) => {
  console.error('Fatal error in control-api', err);
  process.exit(1);
});
