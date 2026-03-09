import { waitForAllServices } from './wait';

export interface HarnessConfig {
  controlApiUrl: string;
  registryUrl: string;
  schedulerUrl: string;
  windowEngineUrl: string;
  sessionGatewayUrl: string;
}

export function defaultConfig(): HarnessConfig {
  return {
    controlApiUrl: process.env['CONTROL_API_URL'] ?? 'http://localhost:3000',
    registryUrl: process.env['REGISTRY_URL'] ?? 'http://localhost:3001',
    schedulerUrl: process.env['SCHEDULER_URL'] ?? 'http://localhost:3002',
    windowEngineUrl: process.env['WINDOW_ENGINE_URL'] ?? 'http://localhost:3003',
    sessionGatewayUrl: process.env['SESSION_GATEWAY_URL'] ?? 'http://localhost:3004',
  };
}

export class TestHarness {
  constructor(private readonly config: HarnessConfig) {}

  async waitForStack(): Promise<void> {
    await waitForAllServices([
      { name: 'control-api', url: `${this.config.controlApiUrl}/healthz/live` },
      { name: 'receiver-registry', url: `${this.config.registryUrl}/healthz/live` },
      { name: 'scheduler', url: `${this.config.schedulerUrl}/healthz/live` },
      { name: 'window-engine', url: `${this.config.windowEngineUrl}/healthz/live` },
      { name: 'session-gateway', url: `${this.config.sessionGatewayUrl}/healthz/live` },
    ]);
  }

  async getReceivers(): Promise<unknown> {
    return this.get('/api/v1/receivers');
  }

  async tune(params: {
    userId: string;
    frequencyHz: number;
    mode: string;
    bandwidthHz?: number;
    waterfallRequested?: boolean;
    audioRequested?: boolean;
  }): Promise<unknown> {
    return this.post('/api/v1/tune', params);
  }

  async closeSession(sessionId: string): Promise<void> {
    const response = await fetch(`${this.config.controlApiUrl}/api/v1/sessions/${sessionId}`, {
      method: 'DELETE',
    });
    if (!response.ok && response.status !== 404) {
      throw new Error(`Failed to close session: ${response.status}`);
    }
  }

  async getChannels(): Promise<unknown> {
    return this.get('/api/v1/channels');
  }

  async getMetrics(): Promise<unknown> {
    return this.get('/api/v1/metrics');
  }

  private async get(path: string): Promise<unknown> {
    const response = await fetch(`${this.config.controlApiUrl}${path}`);
    if (!response.ok) throw new Error(`GET ${path} failed: ${response.status}`);
    return response.json();
  }

  private async post(path: string, body: unknown): Promise<unknown> {
    const response = await fetch(`${this.config.controlApiUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`POST ${path} failed: ${response.status} ${text}`);
    }
    return response.json();
  }
}
