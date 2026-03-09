# Next SDR

A hardened, multi-user SDR platform for the 2 m amateur band.

## Overview

Next SDR serves multiple browser-based listeners from a single wideband SDR capture.
Wideband IQ is acquired once; virtual channels are carved from it on demand.
The browser never touches signal processing — all DSP runs server-side.

```
Browser ── WebSocket ──► session-gateway ──► channel-service ──► IQ stream
                │                               │
                └──► control-api ──► scheduler ──► window-engine ──► receiver-registry
                                                                          │
                                                               receiver-emulator / receiver-rtlsdr
```

## Architecture

| Layer | Services |
|---|---|
| Receiver | `receiver-emulator` (C++), `receiver-rtlsdr` (C++) |
| DSP / Data | `channel-service` (C++), `waterfall-service` (C++), `dsp-core` (C++ lib) |
| Control | `receiver-registry` (TS), `window-engine` (TS), `scheduler` (TS), `control-api` (TS) |
| Presentation | `session-gateway` (TS), `web-ui` (TS/React) |

## Quick Start

**Requirements:** Docker, Docker Compose v2

```bash
# Start the full stack with emulator backend
cd docker/compose
docker compose up

# Open the UI
open http://localhost:8888
```

The API is available at `http://localhost:3000/api/v1`.

## Development

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build:packages

# Run TypeScript unit tests
pnpm test:unit

# Start a specific service in watch mode
pnpm --filter @next-sdr/scheduler dev
```

### C++ components

```bash
# Build receiver-emulator with tests
cd native/receiver-emulator
cmake -B build -DCMAKE_BUILD_TYPE=Debug -DBUILD_TESTS=ON -G Ninja
cmake --build build
cd build && ctest --output-on-failure

# Build dsp-core with tests
cd native/dsp-core
cmake -B build -DCMAKE_BUILD_TYPE=Debug -DBUILD_TESTS=ON -G Ninja
cmake --build build
cd build && ctest --output-on-failure
```

## Testing

| Suite | Command | Notes |
|---|---|---|
| TypeScript unit | `pnpm test:unit` | Always runs |
| C++ emulator unit | `ctest` in `native/receiver-emulator/build` | Requires CMake build |
| C++ DSP unit | `ctest` in `native/dsp-core/build` | Requires CMake build |
| Integration | `pnpm --filter @next-sdr/test-harness test:integration` | Requires running stack |
| Contract | `RECEIVER_BACKEND_URL=http://... pnpm test:integration` | Point at any backend |
| Performance | `PERF_TEST=1 pnpm test:integration` | Optional |
| Soak | `SOAK_TEST=1 SOAK_DURATION_MINUTES=60 pnpm test:integration` | Long-running |
| E2E | `pnpm playwright test` in `tests/e2e` | Requires running stack + Playwright |

## Emulator Scenarios

Set `SCENARIO_ID` on the `receiver-emulator` container:

| ID | Description |
|---|---|
| `single-fm` | Single NFM signal at 145.500 MHz (default) |
| `dual-fm` | Two NFM signals |
| `block-drops` | 5 % block drop rate |
| `stream-stall` | Periodic 500 ms stream stalls |
| `disconnect` | Planned disconnect after 10 s |

```bash
cd docker/compose
SCENARIO_ID=block-drops docker compose up receiver-emulator
```

## API Reference

| Method | Path | Description |
|---|---|---|
| GET | `/api/v1/receivers` | List all receivers |
| GET | `/api/v1/windows` | List receiver windows |
| GET | `/api/v1/windows/default` | Get default window |
| POST | `/api/v1/tune` | Request a channel |
| GET | `/api/v1/channels` | List active channels |
| DELETE | `/api/v1/sessions/:id` | Close a session |
| GET | `/api/v1/metrics` | Platform metrics |

## Receiver Control Contract

Every receiver backend must implement:

```
GET  /receivers                            → list available receivers
POST /receivers/:id/claim                  → claim receiver
POST /receivers/:id/release                → release receiver
GET  /receivers/:id/capabilities           → get capabilities
PUT  /receivers/:id/window                 → configure capture window
POST /receivers/:id/stream/start           → start IQ stream
POST /receivers/:id/stream/stop            → stop IQ stream
GET  /receivers/:id/health                 → health status
GET  /healthz/live                         → liveness
GET  /healthz/ready                        → readiness
```

The emulator and RTL-SDR backend expose identical endpoints.
Contract tests in `tests/integration/contract-receiver.test.ts` verify compliance.

## Repository Structure

```
.devcontainer/          Dev container configuration
.github/workflows/      CI pipeline
apps/
  control-api/          Public-facing HTTP API
  receiver-registry/    Receiver inventory
  scheduler/            Tune request handling
  session-gateway/      WebSocket bridge
  web-ui/               React browser client
  window-engine/        Wideband capture management
  test-harness/         Integration test utilities
docker/
  compose/              Docker Compose files
  images/               Dockerfiles
  config/               nginx config
native/
  receiver-emulator/    Synthetic SDR backend (C++)
  receiver-rtlsdr/      Real hardware backend (C++)
  dsp-core/             DSP library (C++)
  channel-service/      Channelisation and demodulation (C++)
  waterfall-service/    FFT and waterfall generation (C++)
packages/
  contracts/            Shared TypeScript types
  config/               Configuration loaders
  receiver-sdk/         Receiver HTTP client
  scenario-definitions/ Emulator test scenarios
  test-utils/           Test builders and mocks
tests/
  unit/                 TypeScript unit tests
  integration/          Docker Compose integration tests
  e2e/                  Playwright end-to-end tests
  performance/          Load and scaling tests
  soak/                 Long-duration stability tests
  fixtures/             IQ file fixtures
```

## Implementation Status

| Phase | Status | Description |
|---|---|---|
| Phase 0 | ✅ Complete | Foundations — repo, contracts, Docker skeleton |
| Phase 1 | 🔨 In progress | Emulator receiver, registry, window, scheduler |
| Phase 2 | Pending | Channels, gateway, basic UI |
| Phase 3 | Pending | Hardening — fault injection, metrics, logging |
| Phase 4 | Pending | Real RTL-SDR hardware backend |
| Phase 5 | Pending | Multi-receiver preparation |

## Security

- All containers run as non-root
- Internal services are isolated on `sdr-internal` network
- Only `control-api`, `session-gateway`, and `web-ui` are reachable from `sdr-external`
- RTL-SDR container requests minimal capabilities only
- Tune requests are validated by the scheduler before reaching DSP layers

## Licence

MIT
