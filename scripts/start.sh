#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info()  { echo -e "${GREEN}[INFO]${NC}  $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC}  $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }
log_step()  { echo -e "${BLUE}[STEP]${NC}  $1"; }

# Parse arguments
SKIP_BUILD=false

for arg in "$@"; do
  case $arg in
    --skip-build)
      SKIP_BUILD=true
      ;;
    --help)
      echo "Usage: start.sh [OPTIONS]"
      echo ""
      echo "Start Harness in production mode (Docker services + PM2 processes)."
      echo ""
      echo "Options:"
      echo "  --skip-build    Skip pnpm build (use existing artifacts)"
      echo "  --help          Show this help message"
      exit 0
      ;;
    *)
      log_error "Unknown argument: $arg"
      exit 1
      ;;
  esac
done

cd "$PROJECT_ROOT"

# --- Prerequisites ---

if ! command -v node &>/dev/null; then
  log_error "node is required but not installed"
  exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 22 ]; then
  log_error "Node.js >= 22 required, found v$NODE_VERSION"
  exit 1
fi

if ! command -v pnpm &>/dev/null; then
  log_error "pnpm is required but not installed"
  exit 1
fi

if ! command -v pm2 &>/dev/null; then
  log_error "pm2 is required but not installed. Run: npm install -g pm2"
  exit 1
fi

if ! command -v docker &>/dev/null; then
  log_error "docker is required but not installed"
  exit 1
fi

# --- Environment checks ---

if [ ! -f "$PROJECT_ROOT/.env" ]; then
  log_warn ".env file not found at project root"
fi

if [ ! -f "$PROJECT_ROOT/packages/database/.env" ]; then
  log_warn "packages/database/.env not found — DATABASE_URL may not be set"
fi

# --- Create logs directory ---

mkdir -p "$PROJECT_ROOT/logs"

# --- Docker services ---

log_step "Checking Docker containers..."

CONTAINERS=("harness-postgres" "harness-qdrant" "harness-loki" "harness-grafana" "harness-po-token")
ALL_RUNNING=true

for container in "${CONTAINERS[@]}"; do
  if ! docker ps --format '{{.Names}}' | grep -q "^${container}$"; then
    ALL_RUNNING=false
    break
  fi
done

if [ "$ALL_RUNNING" = true ]; then
  log_info "All Docker containers already running"
else
  log_step "Starting Docker containers..."
  docker compose up -d
  log_info "Docker containers started"
fi

# --- Build ---

if [ "$SKIP_BUILD" = false ]; then
  log_step "Generating Prisma client..."
  pnpm db:generate

  log_step "Pushing database schema..."
  pnpm db:push

  log_step "Building all packages..."
  NODE_ENV=production pnpm build
else
  log_info "Skipping build (--skip-build flag)"
fi

# --- PM2 ---

log_step "Starting PM2 processes..."

# Stop existing processes if running (ignore errors)
pm2 stop ecosystem.config.cjs 2>/dev/null || true
pm2 delete ecosystem.config.cjs 2>/dev/null || true

# Start fresh
pm2 start ecosystem.config.cjs --env production

# Save process list for auto-restart on reboot
pm2 save --force 2>/dev/null || true

# --- Health check ---

log_step "Waiting for health check on :4002/health..."

RETRIES=0
MAX_RETRIES=30

while [ $RETRIES -lt $MAX_RETRIES ]; do
  if curl -sf "http://localhost:4002/health" >/dev/null 2>&1; then
    log_info "Health check passed"
    break
  fi
  RETRIES=$((RETRIES + 1))
  sleep 1
done

if [ $RETRIES -eq $MAX_RETRIES ]; then
  log_warn "Health check did not pass within ${MAX_RETRIES}s — check logs with: scripts/logs.sh"
fi

# --- Status ---

echo ""
log_info "Harness is running"
echo ""
pm2 status
echo ""
log_info "Dashboard:    http://localhost:4000"
log_info "Orchestrator: http://localhost:4001"
log_info "Health:       http://localhost:4002/health"
log_info "Grafana:      http://localhost:3200"
echo ""
log_info "Commands:"
echo "  scripts/status.sh     — Full status overview"
echo "  scripts/logs.sh       — View logs"
echo "  scripts/restart.sh    — Rebuild and restart"
echo "  scripts/stop.sh       — Stop everything"
