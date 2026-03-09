import type { FastifyInstance } from 'fastify';
import type { ReceiverRegistry } from './registry';
import type { Logger } from './logger';
import type {
  ReceiverRegistrationRequest,
  ReceiverRegistrationResponse,
  LivenessResponse,
  ReadinessResponse,
} from '@next-sdr/contracts';

export function registerRoutes(
  app: FastifyInstance,
  registry: ReceiverRegistry,
  logger: Logger,
): void {
  // Health endpoints
  app.get('/healthz/live', async (): Promise<LivenessResponse> => {
    return { alive: true, timestamp: new Date().toISOString() };
  });

  app.get('/healthz/ready', async (): Promise<ReadinessResponse> => {
    return {
      ready: true,
      checks: { registry: true },
    };
  });

  // Register a new receiver
  app.post<{ Body: ReceiverRegistrationRequest }>(
    '/receivers/register',
    {
      schema: {
        body: {
          type: 'object',
          required: ['kind', 'site', 'capabilities', 'endpoint'],
          properties: {
            kind: { type: 'string', enum: ['emulator', 'rtlsdr'] },
            site: { type: 'string' },
            capabilities: { type: 'object' },
            endpoint: { type: 'string' },
          },
        },
      },
    },
    async (request): Promise<ReceiverRegistrationResponse> => {
      const id = registry.register(request.body);
      return { receiverId: id, accepted: true };
    },
  );

  // Deregister a receiver
  app.delete<{ Params: { id: string } }>(
    '/receivers/:id',
    async (request, reply): Promise<void> => {
      const ok = registry.deregister(request.params.id);
      if (!ok) {
        await reply.code(404).send({ error: 'Receiver not found' });
        return;
      }
      await reply.code(204).send();
    },
  );

  // Heartbeat
  app.post<{ Params: { id: string } }>(
    '/receivers/:id/heartbeat',
    async (request, reply): Promise<void> => {
      const ok = registry.heartbeat(request.params.id);
      if (!ok) {
        await reply.code(404).send({ error: 'Receiver not found' });
        return;
      }
      await reply.code(204).send();
    },
  );

  // Get all receivers
  app.get('/receivers', async () => {
    return { receivers: registry.getAll() };
  });

  // Get available receivers
  app.get('/receivers/available', async () => {
    return { receivers: registry.getAvailable() };
  });

  // Get single receiver
  app.get<{ Params: { id: string } }>(
    '/receivers/:id',
    async (request, reply) => {
      const receiver = registry.get(request.params.id);
      if (!receiver) {
        await reply.code(404).send({ error: 'Receiver not found' });
        return;
      }
      return { receiver };
    },
  );

  // Claim a receiver
  app.post<{ Params: { id: string }; Body: { windowId: string } }>(
    '/receivers/:id/claim',
    async (request, reply) => {
      const ok = registry.claim(request.params.id, request.body.windowId);
      if (!ok) {
        await reply.code(409).send({ error: 'Receiver not available or already claimed' });
        return;
      }
      return { success: true };
    },
  );

  // Release a receiver
  app.post<{ Params: { id: string } }>(
    '/receivers/:id/release',
    async (request, reply) => {
      const ok = registry.release(request.params.id);
      if (!ok) {
        await reply.code(404).send({ error: 'Receiver not found' });
        return;
      }
      return { success: true };
    },
  );

  // Update receiver health
  app.put<{
    Params: { id: string };
    Body: { health: { status: string; lastCheckedAt: string } };
  }>(
    '/receivers/:id/health',
    async (request, reply) => {
      const health = request.body.health as Parameters<
        typeof registry.updateHealth
      >[1];
      const ok = registry.updateHealth(request.params.id, health);
      if (!ok) {
        await reply.code(404).send({ error: 'Receiver not found' });
        return;
      }
      return { success: true };
    },
  );

  logger.info({}, 'Routes registered');
}
