/**
 * Built-in test scenarios.
 * These are deterministic scenarios used in integration and contract tests.
 */

import type { EmulatorScenario } from './types';

/** Quiet 2 m band with a single FM signal at 145.500 MHz */
export const SCENARIO_SINGLE_FM: EmulatorScenario = {
  id: 'single-fm',
  name: 'Single FM signal',
  description: 'Single NFM voice signal at 145.500 MHz, representative of a 2 m simplex channel.',
  centreFrequencyHz: 145_000_000,
  sampleRateHz: 2_048_000,
  signals: [
    {
      type: 'noise',
      powerDbfs: -80,
    },
    {
      type: 'nfm',
      centreFrequencyHz: 145_500_000,
      deviationHz: 5_000,
      modulationFrequencyHz: 1_000,
      amplitudeDbfs: -40,
    },
  ],
};

/** Two simultaneous FM signals */
export const SCENARIO_DUAL_FM: EmulatorScenario = {
  id: 'dual-fm',
  name: 'Dual FM signals',
  description: 'Two NFM signals to exercise channel multiplexing.',
  centreFrequencyHz: 145_000_000,
  sampleRateHz: 2_048_000,
  signals: [
    {
      type: 'noise',
      powerDbfs: -80,
    },
    {
      type: 'nfm',
      centreFrequencyHz: 144_800_000,
      deviationHz: 5_000,
      modulationFrequencyHz: 800,
      amplitudeDbfs: -40,
    },
    {
      type: 'nfm',
      centreFrequencyHz: 145_500_000,
      deviationHz: 5_000,
      modulationFrequencyHz: 1_200,
      amplitudeDbfs: -45,
    },
  ],
};

/** Fault injection scenario — dropped blocks */
export const SCENARIO_BLOCK_DROPS: EmulatorScenario = {
  id: 'block-drops',
  name: 'Block drop fault injection',
  description: 'Normal signal with intermittent block drops for resilience testing.',
  centreFrequencyHz: 145_000_000,
  sampleRateHz: 2_048_000,
  signals: [
    {
      type: 'noise',
      powerDbfs: -75,
    },
    {
      type: 'nfm',
      centreFrequencyHz: 145_500_000,
      deviationHz: 5_000,
      modulationFrequencyHz: 1_000,
      amplitudeDbfs: -40,
    },
  ],
  faultInjection: {
    dropProbability: 0.05,
  },
};

/** Fault injection scenario — stream stalls */
export const SCENARIO_STREAM_STALL: EmulatorScenario = {
  id: 'stream-stall',
  name: 'Stream stall fault injection',
  description: 'Periodic stream stalls to test backpressure and recovery.',
  centreFrequencyHz: 145_000_000,
  sampleRateHz: 2_048_000,
  signals: [
    {
      type: 'noise',
      powerDbfs: -75,
    },
  ],
  faultInjection: {
    stallProbability: 0.1,
    stallDurationMs: 500,
  },
};

/** Fault injection scenario — disconnect */
export const SCENARIO_DISCONNECT: EmulatorScenario = {
  id: 'disconnect',
  name: 'Planned disconnect',
  description: 'Emulator disconnects after 10 seconds to test reconnect handling.',
  centreFrequencyHz: 145_000_000,
  sampleRateHz: 2_048_000,
  signals: [
    {
      type: 'noise',
      powerDbfs: -75,
    },
  ],
  faultInjection: {
    disconnectAfterSeconds: 10,
  },
};

export const BUILT_IN_SCENARIOS: EmulatorScenario[] = [
  SCENARIO_SINGLE_FM,
  SCENARIO_DUAL_FM,
  SCENARIO_BLOCK_DROPS,
  SCENARIO_STREAM_STALL,
  SCENARIO_DISCONNECT,
];

export function findScenario(id: string): EmulatorScenario | undefined {
  return BUILT_IN_SCENARIOS.find((s) => s.id === id);
}
