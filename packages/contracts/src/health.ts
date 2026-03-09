/**
 * Health check types.
 * All services must expose readiness and liveness endpoints conforming to this contract.
 */

export type HealthStatus = 'ok' | 'degraded' | 'unavailable';

export interface ServiceHealth {
  status: HealthStatus;
  service: string;
  version: string;
  uptime: number; // seconds
  timestamp: string; // ISO 8601
  checks: Record<string, ComponentHealth>;
}

export interface ComponentHealth {
  status: HealthStatus;
  message?: string;
  details?: Record<string, unknown>;
}

export interface ReadinessResponse {
  ready: boolean;
  checks: Record<string, boolean>;
}

export interface LivenessResponse {
  alive: boolean;
  timestamp: string;
}
