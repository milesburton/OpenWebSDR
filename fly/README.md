# Fly.io Deployment

Each service maps to a separate Fly app prefixed `next-sdr-`.
Services communicate over Fly's private WireGuard network via `<app>.internal` hostnames.

## Prerequisites

```bash
# Install flyctl
curl -L https://fly.io/install.sh | sh

# Authenticate
fly auth login
```

## Topology

| App | Public? | Internal hostname | VM |
|-----|---------|-------------------|----|
| `next-sdr-receiver-registry` | No | `next-sdr-receiver-registry.internal:3001` | shared-cpu-1x / 256 MB |
| `next-sdr-window-engine` | No | `next-sdr-window-engine.internal:3003` | shared-cpu-1x / 256 MB |
| `next-sdr-scheduler` | No | `next-sdr-scheduler.internal:3002` | shared-cpu-1x / 256 MB |
| `next-sdr-control-api` | Yes | `next-sdr-control-api.internal:3000` | shared-cpu-1x / 256 MB |
| `next-sdr-session-gateway` | Yes | `next-sdr-session-gateway.internal:3004` | shared-cpu-1x / 512 MB |
| `next-sdr-receiver-emulator` | No | `next-sdr-receiver-emulator.internal:8080` | shared-cpu-1x / 512 MB |
| `next-sdr-channel-service` | No | `next-sdr-channel-service.internal` | shared-cpu-2x / 1 GB |
| `next-sdr-waterfall-service` | No | `next-sdr-waterfall-service.internal` | shared-cpu-2x / 512 MB |
| `next-sdr-web-ui` | Yes | — | shared-cpu-1x / 256 MB |

## Deploy All Services

Run from the repository root:

```bash
./fly/deploy.sh
```

## Deploy a Single Service

```bash
./fly/deploy.sh --app scheduler
```

## Manual Deployment (per service)

```bash
fly apps create next-sdr-receiver-registry --org personal
fly deploy --config fly/receiver-registry.toml --remote-only
```

## Change Scenario

To switch the emulator to a fault-injection scenario:

```bash
fly secrets set SCENARIO_ID=block-drops --app next-sdr-receiver-emulator
fly deploy --config fly/receiver-emulator.toml --remote-only
```

Available scenarios: `single-fm`, `dual-fm`, `block-drops`, `stream-stall`, `disconnect`.

## Accessing Services

After deployment:

| Endpoint | URL |
|----------|-----|
| Web UI | https://next-sdr-web-ui.fly.dev |
| REST API | https://next-sdr-control-api.fly.dev/api/v1 |
| WebSocket | wss://next-sdr-session-gateway.fly.dev/ws/control |

## Logs

```bash
fly logs --app next-sdr-scheduler
fly logs --app next-sdr-receiver-emulator
```

## Scaling

```bash
# Scale session-gateway for more WebSocket connections
fly scale count 2 --app next-sdr-session-gateway

# Increase memory for channel-service under load
fly scale memory 2048 --app next-sdr-channel-service
```

## Notes

- All services are deployed to `lhr` (London) by default. Change `primary_region` in the relevant `.toml` or pass `--region` to `deploy.sh`.
- The C++ services (receiver-emulator, channel-service, waterfall-service) compile inside Docker during `fly deploy --remote-only`. First build will be slow; subsequent builds use the remote build cache.
- `auto_stop_machines = false` is set on all services — the emulator must stay running continuously to maintain its IQ stream.
