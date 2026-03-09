/**
 * Scheduler policy rules.
 * Validates tune requests and enforces platform limits.
 */

import type { ChannelDefinition, ReceiverWindow } from '@next-sdr/contracts';
import type { SchedulerConfig } from '@next-sdr/config';

export type PolicyResult =
  | { allowed: true }
  | { allowed: false; reason: string };

export interface PolicyContext {
  activeChannels: number;
  activeSessions: number;
  activeWaterfallChannels: number;
  definition: ChannelDefinition;
  window: ReceiverWindow;
}

export class SchedulerPolicy {
  constructor(private readonly config: SchedulerConfig) {}

  evaluate(ctx: PolicyContext): PolicyResult {
    const checks: Array<() => PolicyResult> = [
      () => this.checkFrequencyInWindow(ctx),
      () => this.checkChannelLimit(ctx),
      () => this.checkSessionLimit(ctx),
      () => this.checkWaterfallQuota(ctx),
    ];

    for (const check of checks) {
      const result = check();
      if (!result.allowed) return result;
    }

    return { allowed: true };
  }

  private checkFrequencyInWindow(ctx: PolicyContext): PolicyResult {
    const { frequencyHz } = ctx.definition;
    const { serviceMinFrequencyHz, serviceMaxFrequencyHz } = ctx.window;

    if (frequencyHz < serviceMinFrequencyHz || frequencyHz > serviceMaxFrequencyHz) {
      return {
        allowed: false,
        reason:
          `Frequency ${frequencyHz} Hz is outside the service window ` +
          `[${serviceMinFrequencyHz}, ${serviceMaxFrequencyHz}]`,
      };
    }

    return { allowed: true };
  }

  private checkChannelLimit(ctx: PolicyContext): PolicyResult {
    if (ctx.activeChannels >= this.config.maxUniqueChannels) {
      return {
        allowed: false,
        reason: `Maximum unique channels reached (${this.config.maxUniqueChannels})`,
      };
    }
    return { allowed: true };
  }

  private checkSessionLimit(ctx: PolicyContext): PolicyResult {
    if (ctx.activeSessions >= this.config.maxTotalSessions) {
      return {
        allowed: false,
        reason: `Maximum total sessions reached (${this.config.maxTotalSessions})`,
      };
    }
    return { allowed: true };
  }

  private checkWaterfallQuota(ctx: PolicyContext): PolicyResult {
    if (
      ctx.definition.waterfallRequested &&
      ctx.activeWaterfallChannels >= this.config.waterfallQuota
    ) {
      return {
        allowed: false,
        reason: `Waterfall quota exhausted (${this.config.waterfallQuota})`,
      };
    }
    return { allowed: true };
  }
}
