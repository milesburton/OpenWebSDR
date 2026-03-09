/**
 * @next-sdr/config
 *
 * Shared configuration loading utilities for Next SDR services.
 * Reads from environment variables with typed defaults.
 */

export interface ServiceConfig {
  serviceName: string;
  host: string;
  port: number;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  metricsPort: number;
}

export interface ReceiverRegistryConfig extends ServiceConfig {
  receiverHeartbeatIntervalMs: number;
  receiverTimeoutMs: number;
}

export interface SchedulerConfig extends ServiceConfig {
  maxUniqueChannels: number;
  maxSessionsPerChannel: number;
  maxTotalSessions: number;
  channelIdleTimeoutMs: number;
  waterfallQuota: number;
}

export interface WindowEngineConfig extends ServiceConfig {
  defaultCentreFrequencyHz: number;
  defaultSampleRateHz: number;
  guardBandHz: number;
}

export interface SessionGatewayConfig extends ServiceConfig {
  maxConnectionsPerUser: number;
  pingIntervalMs: number;
  pongTimeoutMs: number;
}

function requireEnv(name: string): string {
  const val = process.env[name];
  if (!val) {
    throw new Error(`Required environment variable ${name} is not set`);
  }
  return val;
}

function envString(name: string, defaultValue: string): string {
  return process.env[name] ?? defaultValue;
}

function envInt(name: string, defaultValue: number): number {
  const val = process.env[name];
  if (!val) return defaultValue;
  const parsed = parseInt(val, 10);
  if (isNaN(parsed)) {
    throw new Error(`Environment variable ${name} must be an integer, got: ${val}`);
  }
  return parsed;
}

function envLogLevel(name: string): 'debug' | 'info' | 'warn' | 'error' {
  const val = envString(name, 'info');
  if (!['debug', 'info', 'warn', 'error'].includes(val)) {
    throw new Error(`Environment variable ${name} must be one of debug|info|warn|error`);
  }
  return val as 'debug' | 'info' | 'warn' | 'error';
}

export function loadReceiverRegistryConfig(): ReceiverRegistryConfig {
  return {
    serviceName: 'receiver-registry',
    host: envString('HOST', '0.0.0.0'),
    port: envInt('PORT', 3001),
    logLevel: envLogLevel('LOG_LEVEL'),
    metricsPort: envInt('METRICS_PORT', 9091),
    receiverHeartbeatIntervalMs: envInt('RECEIVER_HEARTBEAT_INTERVAL_MS', 5000),
    receiverTimeoutMs: envInt('RECEIVER_TIMEOUT_MS', 15000),
  };
}

export function loadSchedulerConfig(): SchedulerConfig {
  return {
    serviceName: 'scheduler',
    host: envString('HOST', '0.0.0.0'),
    port: envInt('PORT', 3002),
    logLevel: envLogLevel('LOG_LEVEL'),
    metricsPort: envInt('METRICS_PORT', 9092),
    maxUniqueChannels: envInt('MAX_UNIQUE_CHANNELS', 32),
    maxSessionsPerChannel: envInt('MAX_SESSIONS_PER_CHANNEL', 16),
    maxTotalSessions: envInt('MAX_TOTAL_SESSIONS', 64),
    channelIdleTimeoutMs: envInt('CHANNEL_IDLE_TIMEOUT_MS', 30000),
    waterfallQuota: envInt('WATERFALL_QUOTA', 8),
  };
}

export function loadWindowEngineConfig(): WindowEngineConfig {
  // 2 m band: 144–146 MHz, centre at 145 MHz
  return {
    serviceName: 'window-engine',
    host: envString('HOST', '0.0.0.0'),
    port: envInt('PORT', 3003),
    logLevel: envLogLevel('LOG_LEVEL'),
    metricsPort: envInt('METRICS_PORT', 9093),
    defaultCentreFrequencyHz: envInt('DEFAULT_CENTRE_FREQUENCY_HZ', 145_000_000),
    defaultSampleRateHz: envInt('DEFAULT_SAMPLE_RATE_HZ', 2_048_000),
    guardBandHz: envInt('GUARD_BAND_HZ', 100_000),
  };
}

export function loadSessionGatewayConfig(): SessionGatewayConfig {
  return {
    serviceName: 'session-gateway',
    host: envString('HOST', '0.0.0.0'),
    port: envInt('PORT', 3004),
    logLevel: envLogLevel('LOG_LEVEL'),
    metricsPort: envInt('METRICS_PORT', 9094),
    maxConnectionsPerUser: envInt('MAX_CONNECTIONS_PER_USER', 4),
    pingIntervalMs: envInt('PING_INTERVAL_MS', 10000),
    pongTimeoutMs: envInt('PONG_TIMEOUT_MS', 5000),
  };
}

export function loadControlApiConfig(): ServiceConfig {
  return {
    serviceName: 'control-api',
    host: envString('HOST', '0.0.0.0'),
    port: envInt('PORT', 3000),
    logLevel: envLogLevel('LOG_LEVEL'),
    metricsPort: envInt('METRICS_PORT', 9090),
  };
}

export { requireEnv, envString, envInt };
