import type { TuneRequest, TuneResponse, ReceiverWindow } from '@next-sdr/contracts';
import type { SchedulerConfig } from '@next-sdr/config';
import type { Logger } from '../../receiver-registry/src/logger';
import { ChannelStore } from './channel-store';
import { SessionStore } from './session-store';
import { SchedulerPolicy } from './policy';

export interface SchedulerDependencies {
  getActiveWindow(): ReceiverWindow | undefined;
  provisionChannel(
    windowId: string,
    channelId: string,
    definition: import('@next-sdr/contracts').ChannelDefinition,
  ): Promise<void>;
}

export type TuneResult =
  | { success: true; response: TuneResponse }
  | { success: false; reason: string };

export class Scheduler {
  private readonly channels: ChannelStore;
  private readonly sessions: SessionStore;
  private readonly policy: SchedulerPolicy;

  constructor(
    private readonly config: SchedulerConfig,
    private readonly deps: SchedulerDependencies,
    private readonly logger: Logger,
  ) {
    this.channels = new ChannelStore();
    this.sessions = new SessionStore();
    this.policy = new SchedulerPolicy(config);
  }

  async tune(req: TuneRequest): Promise<TuneResult> {
    const window = this.deps.getActiveWindow();
    if (!window) {
      return { success: false, reason: 'No active receiver window available' };
    }

    const definition = {
      frequencyHz: req.frequencyHz,
      mode: req.mode,
      bandwidthHz: req.bandwidthHz ?? 12_500,
      squelch: req.squelch ?? null,
      waterfallRequested: req.waterfallRequested ?? true,
      audioRequested: req.audioRequested ?? true,
    };

    const existing = this.channels.findReusable(window.id, definition);

    if (existing) {
      this.logger.info(
        { channelId: existing.id, frequencyHz: req.frequencyHz },
        'Reusing existing channel',
      );

      const session = this.sessions.create(existing.id, req.userId, {
        supportsAudio: req.audioRequested ?? true,
        supportsWaterfall: req.waterfallRequested ?? true,
      });
      this.channels.incrementListeners(existing.id);

      return {
        success: true,
        response: {
          session,
          channel: existing,
          audioToken: session.capabilities.supportsAudio ? session.id : null,
          waterfallToken: session.capabilities.supportsWaterfall ? session.id : null,
        },
      };
    }

    const policyResult = this.policy.evaluate({
      activeChannels: this.channels.countActive(),
      activeSessions: this.sessions.countActive(),
      activeWaterfallChannels: this.channels.countWaterfall(),
      definition,
      window,
    });

    if (!policyResult.allowed) {
      this.logger.warn(
        { reason: policyResult.reason, frequencyHz: req.frequencyHz },
        'Tune request rejected by policy',
      );
      return { success: false, reason: policyResult.reason };
    }

    const channel = this.channels.createPlaceholder(window.id, definition);

    try {
      await this.deps.provisionChannel(window.id, channel.id, definition);
      this.channels.activate(channel.id);
    } catch (err) {
      this.channels.remove(channel.id);
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error({ channelId: channel.id, err: message }, 'Channel provisioning failed');
      return { success: false, reason: `Channel provisioning failed: ${message}` };
    }

    const session = this.sessions.create(channel.id, req.userId, {
      supportsAudio: req.audioRequested ?? true,
      supportsWaterfall: req.waterfallRequested ?? true,
    });
    this.channels.incrementListeners(channel.id);

    this.logger.info(
      { channelId: channel.id, sessionId: session.id, frequencyHz: req.frequencyHz },
      'Channel created and session attached',
    );

    return {
      success: true,
      response: {
        session,
        channel,
        audioToken: session.capabilities.supportsAudio ? session.id : null,
        waterfallToken: session.capabilities.supportsWaterfall ? session.id : null,
      },
    };
  }

  closeSession(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    const closed = this.sessions.close(sessionId);
    if (!closed) return false;

    this.channels.decrementListeners(session.channelId);

    const channel = this.channels.get(session.channelId);
    if (channel && channel.listenerCount === 0) {
      this.logger.info({ channelId: channel.id }, 'Channel has no listeners, marking idle');
    }

    return true;
  }

  getChannel(id: string) {
    return this.channels.get(id);
  }

  getSession(id: string) {
    return this.sessions.get(id);
  }

  getChannels() {
    return this.channels.getAll();
  }

  getSessions() {
    return this.sessions.getAll();
  }

  getMetrics() {
    return {
      activeChannels: this.channels.countActive(),
      activeSessions: this.sessions.countActive(),
      activeWaterfallChannels: this.channels.countWaterfall(),
    };
  }
}
