export type SampleFormat = 'CS8' | 'CU8' | 'CS16' | 'CF32';

export interface IQBlockFlags {
  dropped: boolean;
  corrupt: boolean;
  overflow: boolean;
  endOfStream: boolean;
}

export interface IQBlock {
  receiverId: string;
  windowId: string;
  sequenceNumber: number;
  /** Unix epoch milliseconds */
  timestamp: number;
  sampleFormat: SampleFormat;
  sampleRateHz: number;
  centreFrequencyHz: number;
  /** Raw sample payload — binary in transport, base64 in JSON representations */
  payload: Uint8Array | string;
  flags: IQBlockFlags;
}

/** Fixed block size in samples (I+Q pairs) */
export const IQ_BLOCK_SAMPLES = 65536;

/** Wire format constants */
export const IQ_BLOCK_HEADER_SIZE_BYTES = 64;
