/**
 * HTTP routes for the scheduler service.
 */

import type { FastifyInstance } from 'fastify';
import type { Scheduler } from './scheduler';
import type { TuneRequest, LivenessResponse, ReadinessResponse } from '@next-sdr/contracts';

export function registerRoutes(app: FastifyInstance, scheduler: Scheduler): void {
  app.get('/healthz/live', async (): Promise<LivenessResponse> => ({
    alive: true,
    timestamp: new Date().toISOString(),
  }));

  app.get('/healthz/ready', async (): Promise<ReadinessResponse> => ({
    ready: true,
    checks: { scheduler: true },
  }));

  app.get('/metrics', async () => scheduler.getMetrics());

  // Tune request
  app.post<{ Body: TuneRequest }>(
    '/tune',
    {
      schema: {
        body: {
          type: 'object',
          required: ['userId', 'frequencyHz', 'mode'],
          properties: {
            userId: { type: 'string' },
            frequencyHz: { type: 'number' },
            mode: { type: 'string' },
            bandwidthHz: { type: 'number' },
            squelch: { type: ['number', 'null'] },
            waterfallRequested: { type: 'boolean' },
            audioRequested: { type: 'boolean' },
          },
        },
      },
    },
    async (request, reply) => {
      const result = await scheduler.tune(request.body);
      if (!result.success) {
        return reply.code(409).send({ error: result.reason });
      }
      return result.response;
    },
  );

  // Close session
  app.delete<{ Params: { sessionId: string } }>(
    '/sessions/:sessionId',
    async (request, reply) => {
      const ok = scheduler.closeSession(request.params.sessionId);
      if (!ok) {
        return reply.code(404).send({ error: 'Session not found' });
      }
      return reply.code(204).send();
    },
  );

  // List channels
  app.get('/channels', async () => ({
    channels: scheduler.getChannels(),
  }));

  // Get channel
  app.get<{ Params: { id: string } }>('/channels/:id', async (request, reply) => {
    const channel = scheduler.getChannel(request.params.id);
    if (!channel) {
      return reply.code(404).send({ error: 'Channel not found' });
    }
    return { channel };
  });

  // List sessions
  app.get('/sessions', async () => ({
    sessions: scheduler.getSessions(),
  }));

  // Get session
  app.get<{ Params: { id: string } }>('/sessions/:id', async (request, reply) => {
    const session = scheduler.getSession(request.params.id);
    if (!session) {
      return reply.code(404).send({ error: 'Session not found' });
    }
    return { session };
  });
}
