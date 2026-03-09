import type {
  IReceiverControlClient,
  DiscoverReceiversResponse,
  ClaimReceiverRequest,
  ClaimReceiverResponse,
  ReleaseReceiverRequest,
  ReleaseReceiverResponse,
  GetCapabilitiesRequest,
  GetCapabilitiesResponse,
  ConfigureWindowRequest,
  ConfigureWindowResponse,
  StartStreamRequest,
  StartStreamResponse,
  StopStreamRequest,
  StopStreamResponse,
  GetHealthRequest,
  GetHealthResponse,
} from '@next-sdr/contracts';

export interface ReceiverHttpClientOptions {
  baseUrl: string;
  timeoutMs?: number;
}

export class ReceiverHttpClient implements IReceiverControlClient {
  private readonly baseUrl: string;
  private readonly timeoutMs: number;

  constructor(options: ReceiverHttpClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
    this.timeoutMs = options.timeoutMs ?? 5000;
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        ...init,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...(init?.headers ?? {}),
        },
      });

      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new ReceiverClientError(
          `Receiver backend returned ${response.status}: ${text}`,
          response.status,
        );
      }

      return response.json() as Promise<T>;
    } finally {
      clearTimeout(timeout);
    }
  }

  async discoverReceivers(): Promise<DiscoverReceiversResponse> {
    return this.request<DiscoverReceiversResponse>('/receivers');
  }

  async claimReceiver(req: ClaimReceiverRequest): Promise<ClaimReceiverResponse> {
    return this.request<ClaimReceiverResponse>(`/receivers/${req.receiverId}/claim`, {
      method: 'POST',
    });
  }

  async releaseReceiver(req: ReleaseReceiverRequest): Promise<ReleaseReceiverResponse> {
    return this.request<ReleaseReceiverResponse>(`/receivers/${req.receiverId}/release`, {
      method: 'POST',
    });
  }

  async getCapabilities(req: GetCapabilitiesRequest): Promise<GetCapabilitiesResponse> {
    return this.request<GetCapabilitiesResponse>(`/receivers/${req.receiverId}/capabilities`);
  }

  async configureWindow(req: ConfigureWindowRequest): Promise<ConfigureWindowResponse> {
    return this.request<ConfigureWindowResponse>(`/receivers/${req.receiverId}/window`, {
      method: 'PUT',
      body: JSON.stringify(req.config),
    });
  }

  async startStream(req: StartStreamRequest): Promise<StartStreamResponse> {
    return this.request<StartStreamResponse>(`/receivers/${req.receiverId}/stream/start`, {
      method: 'POST',
      body: JSON.stringify({ windowId: req.windowId }),
    });
  }

  async stopStream(req: StopStreamRequest): Promise<StopStreamResponse> {
    return this.request<StopStreamResponse>(`/receivers/${req.receiverId}/stream/stop`, {
      method: 'POST',
    });
  }

  async getHealth(req: GetHealthRequest): Promise<GetHealthResponse> {
    return this.request<GetHealthResponse>(`/receivers/${req.receiverId}/health`);
  }
}

export class ReceiverClientError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = 'ReceiverClientError';
  }
}
