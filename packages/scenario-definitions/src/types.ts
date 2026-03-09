export type SignalType = 'fm' | 'nfm' | 'am' | 'tone' | 'noise' | 'iq_file';

export interface ToneSignal {
  type: 'tone';
  frequencyHz: number;
  amplitudeDbfs: number;
}

export interface FMSignal {
  type: 'fm';
  centreFrequencyHz: number;
  deviationHz: number;
  modulationFrequencyHz: number;
  amplitudeDbfs: number;
}

export interface NFMSignal {
  type: 'nfm';
  centreFrequencyHz: number;
  deviationHz: number;
  modulationFrequencyHz: number;
  amplitudeDbfs: number;
}

export interface NoiseFloor {
  type: 'noise';
  powerDbfs: number;
}

export interface IQFileReplay {
  type: 'iq_file';
  filePath: string;
  loopEnabled: boolean;
  sampleRateHz: number;
  centreFrequencyHz: number;
}

export type ScenarioSignal = ToneSignal | FMSignal | NFMSignal | NoiseFloor | IQFileReplay;

export interface FaultInjection {
  /** Probability per block of dropping it (0–1) */
  dropProbability?: number;
  /** Probability per block of marking it corrupt (0–1) */
  corruptProbability?: number;
  /** Probability per second of simulating a stream stall */
  stallProbability?: number;
  /** Duration of each stall in milliseconds */
  stallDurationMs?: number;
  /** If set, emulator will disconnect after this many seconds */
  disconnectAfterSeconds?: number;
}

export interface EmulatorScenario {
  id: string;
  name: string;
  description: string;
  centreFrequencyHz: number;
  sampleRateHz: number;
  signals: ScenarioSignal[];
  faultInjection?: FaultInjection;
  durationSeconds?: number;
}
