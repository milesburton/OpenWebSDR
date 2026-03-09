#!/usr/bin/env bash
# deploy.sh — Deploy all Next SDR services to Fly.io
#
# Prerequisites:
#   flyctl installed and authenticated (fly auth login)
#   Run from the repository root: ./fly/deploy.sh
#
# Options:
#   --app <name>   Deploy a single app (e.g. --app scheduler)
#   --region <r>   Override region (default: lhr)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

REGION="${REGION:-lhr}"
SINGLE_APP=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --app)    SINGLE_APP="$2"; shift 2 ;;
    --region) REGION="$2";     shift 2 ;;
    *) echo "Unknown argument: $1"; exit 1 ;;
  esac
done

cd "$REPO_ROOT"

# Ordered deployment — respects dependency chain
APPS=(
  receiver-registry
  window-engine
  scheduler
  control-api
  session-gateway
  receiver-emulator
  channel-service
  waterfall-service
  web-ui
)

deploy_app() {
  local name="$1"
  local config="${SCRIPT_DIR}/${name}.toml"

  echo ""
  echo "==> Deploying ${name}..."

  fly deploy \
    --config "${config}" \
    --remote-only \
    --region "${REGION}" \
    --wait-timeout 120

  echo "    ${name} deployed."
}

create_app_if_missing() {
  local name="$1"
  if ! fly apps list | grep -q "^${name}"; then
    echo "==> Creating app ${name}..."
    fly apps create "${name}" --org personal
  fi
}

if [[ -n "$SINGLE_APP" ]]; then
  create_app_if_missing "next-sdr-${SINGLE_APP}"
  deploy_app "$SINGLE_APP"
  exit 0
fi

# Full deployment
echo "Deploying Next SDR to Fly.io (region: ${REGION})"
echo ""

for app in "${APPS[@]}"; do
  create_app_if_missing "next-sdr-${app}"
  deploy_app "$app"
done

echo ""
echo "All services deployed."
echo ""
echo "Public endpoints:"
echo "  Web UI:      https://next-sdr-web-ui.fly.dev"
echo "  Control API: https://next-sdr-control-api.fly.dev"
echo "  WS Gateway:  wss://next-sdr-session-gateway.fly.dev"
