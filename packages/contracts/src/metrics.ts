export const METRIC_NAMES = {
  activeReceivers: 'sdr_active_receivers',
  activeWindows: 'sdr_active_windows',
  activeChannels: 'sdr_active_channels',
  activeSessions: 'sdr_active_sessions',
  tuneRequests: 'sdr_tune_requests_total',
  tuneRejects: 'sdr_tune_rejects_total',
  iqBlocksReceived: 'sdr_iq_blocks_received_total',
  iqBlocksDropped: 'sdr_iq_blocks_dropped_total',
  fftLatency: 'sdr_fft_latency_seconds',
  channelStartupLatency: 'sdr_channel_startup_latency_seconds',
  websocketConnections: 'sdr_websocket_connections',
  queueDepths: 'sdr_queue_depth',
} as const;

export type MetricName = (typeof METRIC_NAMES)[keyof typeof METRIC_NAMES];
