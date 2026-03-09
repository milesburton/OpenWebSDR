/**
 * window-engine service entry point.
 */

import Fastify from 'fastify';
import { loadWindowEngineConfig } from '@next-sdr/config';
import { createLogger } from '../../receiver-registry/src/logger';
import { WindowManager } from './window-manager';
import type { CreateWindowRequest, LivenessResponse, ReadinessResponse } from '@next-sdr/contracts';

async function main(): Promise<void> {
  const config = loadWindowEngineConfig();
  const logger = createLogger(config.logLevel, config.serviceName);
  const manager = new WindowManager(config, logger);

  const app = Fastify({ disableRequestLogging: true });

  app.get('/healthz/live', async (): Promise<LivenessResponse> => ({
    alive: true,
    timestamp: new Date().toISOString(),
  }));

  app.get('/healthz/ready', async (): Promise<ReadinessResponse> => ({
    ready: true,
    checks: { windowEngine: true },
  }));

  app.post<{ Body: CreateWindowRequest }>('/windows', async (request) => {
    const window = manager.create(request.body);
    // Auto-activate for MVP
    manager.activate(window.id);
    return { window };
  });

  app.get('/windows', async () => ({ windows: manager.getAll() }));

  app.get<{ Params: { id: string } }>('/windows/:id', async (request, reply) => {
    const window = manager.get(request.params.id);
    if (!window) return reply.code(404).send({ error: 'Window not found' });
    return { window };
  });

  app.get('/windows/active', async () => ({ windows: manager.getActive() }));

  app.get('/windows/default', async (_request, reply) => {
    const window = manager.getDefault();
    if (!window) return reply.code(404).send({ error: 'No active window' });
    return { window };
  });

  app.delete<{ Params: { id: string }; Body: { reason?: string } }>(
    '/windows/:id',
    async (request, reply) => {
      const ok = manager.stop(request.params.id, request.body?.reason ?? 'manual stop');
      if (!ok) return reply.code(404).send({ error: 'Window not found' });
      return reply.code(204).send();
    },
  );

  const shutdown = async (): Promise<void> => {
    logger.info({}, 'Shutting down window-engine');
    await app.close();
    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown());
  process.on('SIGINT', () => void shutdown());

  await app.listen({ host: config.host, port: config.port });
  logger.info({ port: config.port }, 'window-engine listening');
}

main().catch((err) => {
  console.error('Fatal error in window-engine', err);
  process.exit(1);
});
