/**
 * Window manager — creates and manages receiver windows.
 * For MVP, supports a single window per receiver.
 */

import { randomUUID } from 'crypto';
import type { ReceiverWindow, CreateWindowRequest } from '@next-sdr/contracts';
import type { WindowEngineConfig } from '@next-sdr/config';
import type { Logger } from '../../receiver-registry/src/logger';

export class WindowManager {
  private windows = new Map<string, ReceiverWindow>();

  constructor(
    private readonly config: WindowEngineConfig,
    private readonly logger: Logger,
  ) {}

  create(req: CreateWindowRequest): ReceiverWindow {
    const sampleRateHz = req.sampleRateHz ?? this.config.defaultSampleRateHz;
    const centreFrequencyHz =
      req.centreFrequencyHz ?? this.config.defaultCentreFrequencyHz;
    const halfBand = sampleRateHz / 2;
    const guard = this.config.guardBandHz;

    const window: ReceiverWindow = {
      id: randomUUID(),
      receiverId: req.receiverId,
      centreFrequencyHz,
      sampleRateHz,
      serviceMinFrequencyHz: centreFrequencyHz - halfBand + guard,
      serviceMaxFrequencyHz: centreFrequencyHz + halfBand - guard,
      guardLowerHz: guard,
      guardUpperHz: guard,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    this.windows.set(window.id, window);
    this.logger.info({ windowId: window.id, receiverId: req.receiverId }, 'Window created');
    return window;
  }

  activate(id: string): boolean {
    const window = this.windows.get(id);
    if (!window) return false;
    window.status = 'active';
    this.logger.info({ windowId: id }, 'Window activated');
    return true;
  }

  stop(id: string, reason: string): boolean {
    const window = this.windows.get(id);
    if (!window) return false;
    window.status = 'stopped';
    this.logger.info({ windowId: id, reason }, 'Window stopped');
    return true;
  }

  get(id: string): ReceiverWindow | undefined {
    return this.windows.get(id);
  }

  getAll(): ReceiverWindow[] {
    return Array.from(this.windows.values());
  }

  getActive(): ReceiverWindow[] {
    return this.getAll().filter((w) => w.status === 'active');
  }

  getActiveForReceiver(receiverId: string): ReceiverWindow | undefined {
    return this.getAll().find(
      (w) => w.receiverId === receiverId && w.status === 'active',
    );
  }

  /** Returns the default window (MVP: first active window) */
  getDefault(): ReceiverWindow | undefined {
    return this.getActive()[0];
  }
}
