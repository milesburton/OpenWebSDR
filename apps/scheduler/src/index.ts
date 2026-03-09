import Fastify from 'fastify';
import { loadSchedulerConfig } from '@next-sdr/config';
import { createLogger } from '../../receiver-registry/src/logger';
import { Scheduler } from './scheduler';
import { registerRoutes } from './routes';
import type { ChannelDefinition, ReceiverWindow } from '@next-sdr/contracts';

const CHANNEL_SERVICE_URL = process.env.CHANNEL_SERVICE_URL ?? 'http://channel-service:9100';

async function provisionChannel(
  windowId: string,
  channelId: string,
  definition: ChannelDefinition,
): Promise<void> {
  const res = await fetch(`${CHANNEL_SERVICE_URL}/channels`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ windowId, channelId, definition }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`channel-service returned ${res.status}: ${text}`);
  }
}

async function main(): Promise<void> {
  const config = loadSchedulerConfig();
  const logger = createLogger(config.logLevel, config.serviceName);

  let activeWindow: ReceiverWindow | undefined;

  const scheduler = new Scheduler(
    config,
    {
      getActiveWindow: () => activeWindow,
      provisionChannel,
    },
    logger,
  );

  const app = Fastify({ disableRequestLogging: true });
  registerRoutes(app, scheduler);

  app.put<{ Body: ReceiverWindow }>('/window', async (request) => {
    activeWindow = request.body;
    logger.info({ windowId: activeWindow.id }, 'Active window updated');
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
