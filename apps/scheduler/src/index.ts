/**
 * scheduler service entry point.
 */

import Fastify from 'fastify';
import { loadSchedulerConfig } from '@next-sdr/config';
import { createLogger } from '../../receiver-registry/src/logger';
import { Scheduler } from './scheduler';
import { registerRoutes } from './routes';
import type { ReceiverWindow } from '@next-sdr/contracts';

async function main(): Promise<void> {
  const config = loadSchedulerConfig();
  const logger = createLogger(config.logLevel, config.serviceName);

  // In production this will be populated from the window-engine service.
  // For now, a stub that holds the current window in memory.
  let activeWindow: ReceiverWindow | undefined;

  const scheduler = new Scheduler(
    config,
    {
      getActiveWindow: () => activeWindow,
      provisionChannel: async (_windowId, _channelId, _definition) => {
        // In production, this calls channel-service to start a new channel worker.
        // For the skeleton, it resolves immediately.
        await Promise.resolve();
      },
    },
    logger,
  );

  const app = Fastify({ disableRequestLogging: true });
  registerRoutes(app, scheduler);

  // Accept window updates from window-engine
  app.put<{ Body: ReceiverWindow }>('/window', async (request) => {
    activeWindow = request.body;
    return { accepted: true };
  });

  const shutdown = async (): Promise<void> => {
    logger.info({}, 'Shutting down scheduler');
    await app.close();
    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown());
  process.on('SIGINT', () => void shutdown());

  await app.listen({ host: config.host, port: config.port });
  logger.info({ port: config.port }, 'Scheduler listening');
}

main().catch((err) => {
  console.error('Fatal error in scheduler', err);
  process.exit(1);
});
