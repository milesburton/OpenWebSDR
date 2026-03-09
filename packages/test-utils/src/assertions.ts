/**
 * Custom assertion helpers for Next SDR tests.
 */

import type { Channel, Session, ReceiverWindow } from '@next-sdr/contracts';

export function assertChannelActive(channel: Channel): void {
  if (channel.status !== 'active') {
    throw new Error(
      `Expected channel ${channel.id} to be active, got: ${channel.status}`,
    );
  }
}

export function assertSessionActive(session: Session): void {
  if (session.status !== 'active') {
    throw new Error(
      `Expected session ${session.id} to be active, got: ${session.status}`,
    );
  }
}

export function assertWindowActive(window: ReceiverWindow): void {
  if (window.status !== 'active') {
    throw new Error(
      `Expected window ${window.id} to be active, got: ${window.status}`,
    );
  }
}

export function assertFrequencyInWindow(
  frequencyHz: number,
  window: ReceiverWindow,
): void {
  if (
    frequencyHz < window.serviceMinFrequencyHz ||
    frequencyHz > window.serviceMaxFrequencyHz
  ) {
    throw new Error(
      `Frequency ${frequencyHz} Hz is outside window service range ` +
        `[${window.serviceMinFrequencyHz}, ${window.serviceMaxFrequencyHz}]`,
    );
  }
}

export function assertWithinBand(
  frequencyHz: number,
  minHz: number,
  maxHz: number,
  label: string,
): void {
  if (frequencyHz < minHz || frequencyHz > maxHz) {
    throw new Error(
      `${label}: frequency ${frequencyHz} Hz is outside band [${minHz}, ${maxHz}]`,
    );
  }
}
