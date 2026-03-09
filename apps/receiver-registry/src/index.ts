/**
 * receiver-registry service entry point.
 *
 * Tracks all registered receivers, monitors health, and exposes
 * an inventory API used by the scheduler and window-engine.
 */

import Fastify from 'fastify';
import { loadReceiverRegistryConfig } from '@next-sdr/config';
import { createLogger } from './logger';
import { ReceiverRegistry } from './registry';
import { registerRoutes } from './routes';

async function main(): Promise<void> {
  const config = loadReceiverRegistryConfig();
  const logger = createLogger(config.logLevel, config.serviceName);

  const registry = new ReceiverRegistry(logger, config.receiverTimeoutMs);

  const app = Fastify({
    logger: false,
    disableRequestLogging: true,
  });

  registerRoutes(app, registry, logger);

  // Prune stale receivers on interval
  const pruneInterval = setInterval(
    () => {
      const pruned = registry.pruneStale();
      if (pruned.length > 0) {
        logger.warn({ pruned }, 'Pruned stale receivers');
      }
    },
    Math.floor(config.receiverTimeoutMs / 3),
  );

  const shutdown = async (): Promise<void> => {
    logger.info({}, 'Shutting down receiver-registry');
    clearInterval(pruneInterval);
    await app.close();
    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown());
  process.on('SIGINT', () => void shutdown());

  await app.listen({ host: config.host, port: config.port });
  logger.info({ host: config.host, port: config.port }, 'receiver-registry listening');
}

main().catch((err) => {
  console.error('Fatal error in receiver-registry', err);
  process.exit(1);
});
